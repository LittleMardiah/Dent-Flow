# MIGRATION PLAN - PHASE 2: EXPRESS → SERVERLESS

> Dokumen ini memetakan seluruh endpoint Express yang perlu dimigrate ke
> Vercel Serverless Functions (Supabase sebagai backend DB).
>
> **Status**: Draft, dibuat 2026-09-12
> **Referensi**: ROADMAP TAMBAHAN.txt (Phase 2)
> **Sumber Audit**: dentflow-backend/src/routes/*.ts + dentflow-backend/src/index.ts
> **Log Session**: task_2_1_0.log

---

## 0. RINGKASAN AUDIT

| Metrik | Nilai |
|---|---|
| Total file router Express | 21 |
| Total endpoint terdaftar (router) | 69 |
| Total endpoint TERMOUNT di `index.ts` | 63 |
| Endpoint orphan (file ada, TIDAK di-mount) | 6 (docs×2, invoicePayment×2, notification×2) |
| Router termount | 19 kali app.use(...) — beberapa router dimount 2x (mis. auth: /auth + /api/auth) |
| Endpoint public (tanpa auth) | 11 |
| Endpoint wajib auth+role | 52 dari 63 |
| Dependency infra | Postgres (pg), Redis (ioredis), Socket.IO, node-cron, Midtrans webhook |
| MinIO | DIKONFIGURASI tapi TIDAK dipakai endpoint manapun (dead config) |

### VERDICT LOCKED — Endpoint Orphan

**Keputusan FINAL** untuk 3 router orphan (file ada, tidak di-mount di index.ts):

| Router | Verdict | Alasan | Task Assignment |
|---|---|---|---|
| `docs.routes.ts` | ❌ **DROP** | Serverless tidak pakai Swagger UI di runtime. Dokumentasi API via `api/*.ts` JSDoc + README. | Tidak ada task — hapus file di cleanup Batch 10. |
| `invoicePayment.routes.ts` | ❌ **DROP** | Overlap 100% dengan `invoice.routes.ts` (mark-paid) + `invoiceWeb.routes.ts` (detail). Handler/service duplicate. | Tidak ada task — hapus file di cleanup Batch 10. |
| `notification.routes.ts` | ✅ **MIGRATE** | Handler + service aktif. Fitur send-reminder + send-confirmation masih dipakai admin. | **Batch 4.5 (NEW)**: migrate 2 endpoint ini di Task 2.4.5. |

**Konsekuensi:**
- Orphan termount berkurang jadi **63 endpoint** (dari 69 terdaftar).
- Setelah cleanup: repo Express terakhir akan berisi **19 router aktif** (bukan 21).
- Batch 4.5 ditambahin di §3 URUTAN MIGRATE setelah Batch 4.4.

---

## 1. INVENTARIS ROUTER EXPRESS

> Data = hasil `grep -c "router.(get|post|put|delete|patch)("` per file + mount point dari index.ts.
> Auth: 💛 = mix (public + auth/role per endpoint), 🔒 = semua endpoint wajib auth+role,
> ⚠️ = public (no auth).

| Router File | Mount Path | Jumlah Endpoint | Auth | Dependensi |
|---|---|---|---|---|
| health.routes.ts | `/health` | 1 | ⚠️ | Redis (checkRedis), node-cron (job status) |
| auth.routes.ts | `/auth` + `/api/auth` | 7 | 💛 | Postgres (users, tokens) |
| patients.routes.ts | `/api/patients` | 7 | 🔒 | Postgres (tenant isolation) |
| encounter.routes.ts | `/api/encounters` | 5 | 🔒 | Postgres + validation zod |
| doctorSlot.routes.ts | `/api/doctors` | 7 | 🔒 | Postgres (schedules, leave) |
| doctorQueue.routes.ts | `/api` | 6 | 🔒 | Postgres + Socket.IO broadcast + Redis (status) |
| queue (via doctorQueue) | `/api` | — | 🔒 | Redis INCR (queue.service) |
| booking.routes.ts | `/api` | 4 | 🔒 | Postgres |
| patientHistory.routes.ts | `/api` | 3 | 🔒 | Postgres |
| attendance.routes.ts | `/api` | 2 | 🔒 | Postgres |
| noShow.routes.ts | `/api/no-shows` | 2 | 🔒 | Postgres |
| invoice.routes.ts | `/api/admin/invoices` | 3 | 🔒 | Postgres |
| invoiceWeb.routes.ts | `/api/invoices` | 4 | 🔒 | Postgres |
| invoicePayment.routes.ts | — (orphan) | 2 | 🔒 | Postgres — TIDAK di-mount |
| paymentReconciliation.routes.ts | `/api/payments` | 2 | 🔒 | Postgres |
| admin.routes.ts | `/api/admin` | 3 | 🔒 | Postgres + Socket.IO broadcast |
| adminWebhook.routes.ts | `/api/admin` | 2 | 🔒 | Postgres (webhook_outbox) |
| audit.routes.ts | `/api/admin` | 1 | 🔒 | Postgres |
| walkIn.routes.ts | `/walk-in` | 3 | 💛 | Postgres + rate limiter |
| webhook.routes.ts | `/webhooks` | 1 | ⚠️ | Midtrans signature + Postgres |
| notification.routes.ts | — (orphan) | 2 | 🔒 | Postgres — TIDAK di-mount |
| docs.routes.ts | — (orphan) | 2 | ⚠️ | swagger-ui-express — TIDAK di-mount |

**Akar URI per router** (dari index.ts, setelah middleware global `/api` auth+tenant):

```
/health                                     → health.routes
/auth  +  /api/auth                         → auth.routes
/api/patients                               → patients.routes
/api/encounters                             → encounter.routes
/api/doctors                                → doctorSlot.routes
/api/doctors/:id/queue, /queue/status, dll  → doctorQueue.routes (mount /api)
/api/patient/bookings, /patient/bookings/:id→ booking.routes (mount /api)
/api/patients/:id/history|quick-view|medical-records → patientHistory.routes
/api/patients/:id/attendance, /api/reports/no-show-summary → attendance.routes
/api/no-shows/admin/no-shows, /api/no-shows/admin/bookings/:id/mark-no-show → noShow.routes
/api/admin/invoices                          → invoice.routes
/api/invoices                               → invoiceWeb.routes
/api/payments/reconciliation                → paymentReconciliation.routes
/api/admin/queues, /api/admin/check-in...   → admin.routes
/api/admin/webhook-errors, /webhooks/:id/replay → adminWebhook.routes
/api/admin/audit-logs                       → audit.routes
/walk-in/create-profile, ...                → walkIn.routes
/webhooks/midtrans                          → webhook.routes
```

---

## 2. KLASIFIKASI ENDPOINT

### 2.1 Pure Read-Only (Paling Mudah Dimigrate)
`SELECT` Postgres saja, tanpa Redis/Socket/cron. Pattern: route file + handler → query Supabase.

| Endpoint | Method | Auth | Dekomposisi |
|---|---|---|---|
| `/api/doctors` | GET | 🔒 | list doctors |
| `/api/doctors/me` | GET | 🔒 | profile dokter |
| `/api/doctors/:id/patients` | GET | 🔒 | pasien per dokter |
| `/api/doctors/:id/availability` | GET | 🔒 | availability schedule |
| `/api/patients` | GET | 🔒 | list pasien (scoped branch) |
| `/api/patients/branches` | GET | 🔒 | daftar branch akses |
| `/api/patients/:id` | GET | 🔒 | detail pasien |
| `/api/patients/:id/audit-trail` | GET | 🔒 | audit trail pasien |
| `/api/patients/:id/history` | GET | 🔒 | history pasien |
| `/api/patients/:id/quick-view` | GET | 🔒 | quick view (queue board) |
| `/api/patients/:id/medical-records` | GET | 🔒 | rekam medis |
| `/api/patients/:id/attendance` | GET | 🔒 | statistik kunjungan |
| `/api/reports/no-show-summary` | GET | 🔒 | summary no-show |
| `/api/no-shows/admin/no-shows` | GET | 🔒 | list no-show |
| `/api/admin/audit-logs` | GET | 🔒 | audit log admin |
| `/api/admin/webhook-errors` | GET | 🔒 | log error webhook |
| `/api/admin/queues` | GET | 🔒 | queue board cabang |
| `/api/admin/invoices/:id` | GET | 🔒 | detail invoice (admin) |
| `/api/invoices/summary` | GET | 🔒 | summary invoice |
| `/api/invoices` | GET | 🔒 | list invoice |
| `/api/invoices/:id` | GET | 🔒 | detail invoice |
| `/api/payments/reconciliation` | GET | 🔒 | rekonsiliasi harian |
| `/api/payments/reconciliation/summary` | GET | 🔒 | summary rekonsiliasi |
| `/api/patient/bookings` | GET | 🔒 | daftar booking pasien |
| `/api/patient/bookings/:id` | GET | 🔒 | detail booking |
| `/api/encounters` | GET | 🔒 | list encounter |
| `/api/encounters/:id` | GET | 🔒 | detail encounter |
| `/api/doctors/:id/queue` | GET | 🔒 | queue dokter (Postgres) |
| `/api/doctors/:id/queue-today` | GET | 🔒 | queue hari ini dokter |
| `/api/doctors/:id/queue/stats` | GET | 🔒 | statistik queue |

Total: **30 endpoint read-only** (mayoritas yang harus migrasi pertama).

### 2.2 Write + Transaction (Medium)
`INSERT/UPDATE/DELETE` + validasi zod. Tanpa Redis/Socket/cron.

| Endpoint | Method | Auth | Dekomposisi |
|---|---|---|---|
| `/api/patients/:id` | PUT | 🔒 | update pasien |
| `/api/patients/merge` | POST | 🔒 | merge pasien duplikat |
| `/api/patients/:id` | DELETE | 🔒 | soft delete pasien |
| `/api/encounters` | POST | 🔒 | start encounter |
| `/api/encounters/:id` | PUT | 🔒 | update encounter |
| `/api/encounters/:id/complete` | POST | 🔒 | selesaikan encounter |
| `/api/patient/bookings` | POST | 🔒 | create booking |
| `/api/patient/bookings/:id/cancel` | PUT | 🔒 | cancel booking |
| `/api/admin/invoices/:id/mark-paid` | POST | 🔒 | mark paid |
| `/api/admin/invoices/:id/undo-payment` | POST | 🔒 | undo payment |
| `/api/invoices/:id/payments` | POST | 🔒 | tambah pembayaran |
| `/api/no-shows/admin/bookings/:id/mark-no-show` | PUT | 🔒 | mark no-show manual |
| `/walk-in/create-profile` | POST | ⚠️ | temp profile (rate-limit) |
| `/walk-in/book-appointment` | POST | 🔒 | booking walk-in |
| `/walk-in/convert-to-patient` | POST | ⚠️ | temp → patient |
| `/api/admin/webhooks/:id/replay` | POST | 🔒 | replay webhook |
| `/api/doctors/me` | PUT | 🔒 | update profile dokter |
| `/api/doctors/:id/leave` | PUT | 🔒 | set leave |
| `/api/doctors/:id/leave` | DELETE | 🔒 | hapus leave |

Total: **19 endpoint write** (Postgres transaction).

### 2.3 Butuh Redis (Complex)
`ioredis` → INCR / queue number. Source: `services/queue.service.ts` (`new Redis(config.redis.url)`).

| Endpoint | Method | Redis usage |
|---|---|---|
| `/api/queue/status` | GET | INCR / nomor antrian (queue.service) |
| queue reset via `queueManagement.service` | — | resetAllQueuesForDate |

Migrasi: Redis INCR → **Postgres sequence** (Task 2.7). Catatan: grep di handler
menunjuk `queue.handler` sebagai pemakai `queueService`. Endpoint queue lain
(`doctorQueue.service`) sudah Postgres murni → aman deteksi Redis hanya di
`/api/queue/status` + `queueManagement.service`.

### 2.4 Butuh Socket.IO (Complex)
Broadcast `broadcastQueueUpdated` saat queue berubah. File pemanggil:
`admin.handler.ts`, `adminWalkIn.handler.ts`, `doctorQueue.handler.ts`,
`queue.handler.ts`. Ini mempengaruhi endpoint (percikan broadcast setelah aksi
POST):

| Endpoint | Method | Broadcast event |
|---|---|---|
| `/api/admin/check-in` | POST | `queue:updated` |
| `/api/admin/check-in/walk-in` | POST | `queue:updated` |
| `/api/doctors/:id/ready-next` | POST | `queue:updated` |
| `/api/queue/:id/check-in` | POST | `queue:updated` |
| handler socket-driven (check-in selesai / complete) | — | `queue:updated`, `tv:display:refresh` |

Migrasi: Socket.IO → **Supabase Realtime** (Task 2.6). Frontend consumer:
`dentflow-web/src/app/tv-display` & admin/doctor queue, `dentflow-web/src/lib/websocket.ts`.

### 2.5 Butuh node-cron (Complex)
Dari `jobs/jobScheduler.ts`:

| Job | Schedule | Fungsi | Migrasi |
|---|---|---|---|
| cleanup-temp-patients | `0 3 * * *` (03:00) | hapus temp profile basi | Supabase pg_cron / Vercel Cron |
| no-show-detection | `*/30 * * * *` | auto-mark no-show | pg_cron / Vercel Cron |
| reset-queue | `0 0 * * *` (midnight) | reset nomor antrian | pg_cron / Vercel Cron |
| webhook-retry | `*/5 * * * *` | retry webhook gagal (max 3x) | pg_cron / Vercel Cron |

Endpoint: `/health` membaca `jobScheduler.getStatus()` — di serverless, hapus
bagian ini / ganti dgn status pg_cron (bila perlu).

### 2.6 Butuh Midtrans Webhook (Complex)
| Endpoint | Auth | Ketergantungan |
|---|---|---|
| `/webhooks/midtrans` | ⚠️ (public) | validasi `x-midtrans-signature`, `paymentWebhook.service`, tabel `webhook_outbox` |

Migrasi: Vercel Edge Function (Task 2.9). Env yang dibutuhkan: `MIDTRANS_SERVER_KEY`
— TANPA logout value di log (lihat TD-VERCEL-007).

### 2.7 Butuh MinIO / Storage (Medium)
`config/index.ts` punya blok `minio` (endpoint/accessKey/secretKey/bucket), tapi
**TIDAK ada handler/service yang memakainya** (grep `minio` → hanya config).
→ Langsung skip; cosmetik upload bisa ke **Supabase Storage** di Task 2.10.

---


### 2.8 Authentication + Health (8 endpoint)
Endpoint auth (public + mix auth) dan health check. Auth tidak butuh Redis/Socket/cron, tapi butuh JWT sign + bcrypt.

| Endpoint | Method | Auth | Dekomposisi |
|---|---|---|---|
| `/auth/patient/register` | POST | ⚠️ | register pasien (bcrypt + JWT) |
| `/auth/login` | POST | ⚠️ | auto-detect role login |
| `/auth/patient/login` | POST | ⚠️ | patient login |
| `/auth/admin/login` | POST | ⚠️ | admin login |
| `/auth/doctor/login` | POST | ⚠️ | doctor login |
| `/auth/forgot-password` | POST | ⚠️ | generate reset token |
| `/auth/reset-password` | POST | ⚠️ | reset password |
| `/health` | GET | ⚠️ | health check (Postgres + Redis + jobs) |

Total: **8 endpoint** (7 auth + 1 health).

### 2.9 Rekapitulasi Klasifikasi
| Kategori | Jumlah |
|---|---|
| Read-only (Postgres) | 30 |
| Write (Postgres transaction) | 19 |
| Auth + Health | 8 |
| Redis INCR | 1 |
| Socket.IO broadcast | 4 |
| Midtrans webhook | 1 |
| **Total termount** | **63** |
| Orphan (tidak termount) | 6 |
| **Grand Total** | **69** |

## 3. URUTAN MIGRATE (Sequential)

> Prioritas: read-only → auth → write → infra-complex → testing.

### Batch 1: Foundation (Task 2.1.0 - 2.1.3) — ✅ DONE
- [x] `/api/health` — DONE (commit f6dbed1, region sin1)
- [x] `/api/doctors` (GET list) — DONE (Task 2.1.1, commit aafd1d4)
- [x] `/api/doctors/:id/patients` (GET) — DONE (Task 2.1.2, commit 12500d6)
- [x] Branch scope fix — DONE (Task 2.1.2 fix, commit 92014ec, A/B proof in TD-MIGRATE-006)
- [x] Validasi pattern: auth + supabase + response + branch scope + A/B proof

**Pattern established (reusable untuk Batch berikutnya):**
1. Auth: `extractBearerToken` + `verifyJwt` + `requireRole` (lib/auth.ts)
2. Query: `getSupabase()` factory + select with join
3. Response: `success(res, data)` / `error(res, msg, code, status)`
4. **Branch scope check:** `.eq('branch_id', user.branchId)` — WAJIB untuk endpoint per-resource
5. **A/B proof methodology:** reproduce leak → fix → verify blocked
6. Deploy: `git push origin main` → auto-deploy Vercel (~60-90s)
7. Verify: local harness (real Supabase) + production HTTP test

**Tech debt dari Batch 1:**
- TD-MIGRATE-003: `/api/doctors` response shape `{count, doctors}` vs frontend flat array — pending decision
- TD-MIGRATE-005: seed user Express hilang di prod DB — gunakan self-signed JWT untuk verify
- TD-MIGRATE-006: branch scope missing → FIXED dengan A/B proof

**Next:** Batch 2 — Auth Foundation (`/auth/login`, `/auth/register` + lib/auth middleware helper lanjutan)

### Batch 2: Auth Foundation (Task 2.2.x) — ✅ DONE
- [x] lib/auth.ts extended: `extractBearerToken`, `verifyJwt`, `requireRole`, `enforceTenant`, `signAccessToken`, `signRefreshToken`, `comparePassword`, `hashPassword` (Task 2.2.1, commit 8f74f0d)
- [x] `/api/auth/patient/login` (Task 2.2.2, commit 2a4773e)
- [x] `/api/auth/admin/login` + `/api/auth/doctor/login` (Task 2.2.3, commit 3b45a90)
- [x] `/api/auth/login` (auto-detect role) (Task 2.2.4, commit 964976a)
- [x] `/api/auth/patient/register` (Task 2.2.5, commit b831954)
- [x] `/api/auth/forgot-password` + `/api/auth/reset-password` (Task 2.2.6, commit 6e3e86f)

**Endpoints live: 8** (patient/admin/doctor login, auto-login, register, forgot, reset)
**Total endpoint serverless: 11** (health + 2 doctors + 8 auth)

**Pattern established:**
- Zod validation → 400 (parity PatientRegisterSchema)
- Duplicate email → 409 EMAIL_ALREADY_EXISTS
- Wrong password → 401 INVALID_CREDENTIALS
- Token reset flow: crypto hex 32-byte + reset_tokens table (IMPROVEMENT vs Express JWT-based)
- Security: forgot-password tidak reveal user existence
- Token single-use: reset_tokens.used = true

**Parity deviations (documented):**
- TD-MIGRATE-007: Express forgotPassword pakai JWT tanpa tabel; serverless pakai reset_tokens (single-use). Serverless lebih baik, tapi devToken format berbeda (JWT vs hex).

**Next: Batch 3 — Read endpoints**

### Batch 3: Core Read (Task 2.3.x) — ✅ DONE

**Task 2.3.1 s/d 2.3.5 — DONE (all read endpoints consolidated):**

- [x] `/api/patients` GET list (Task 2.3.1, commit 358adfc)
- [x] `/api/patients` search fix (Task 2.3.1b, commit db03fb0)
- [x] `/api/patients/:id` + `/branches` + `/audit-trail` (Task 2.3.2, commit 8f5bcaf — deploy FAILED: limit 12)
- [x] Verify 404 root cause (Task 2.3.2b, log task_2_3_2b.log)
- [x] Verify 3 routing approaches (Task 2.3.2c, log task_2_3_2c.log)
- [x] **Consolidate patients** (Task 2.3.2d, commit 6379b91) — 4 → 1 function
- [x] **Consolidate doctors** (Task 2.3.2e, commit a529b45) — 2 → 1 function
- [x] **Consolidate auth** (Task 2.3.2f, commit 838770e) — 7 → 1 function
- [x] **ARCHITECTURE LOCKED:** B+C pattern = 4 function total
- [x] `/api/encounters` read (Task 2.3.3, commit c8ca685) — 5 function
- [x] `/api/invoices` read (Task 2.3.4, commit 533e98c) — 6 function
- [x] **invoice_date phantom fix** (Task 2.3.4c, commits 774b43a + 0efb4c0)
- [x] **Close Batch 3** (Task 2.3.5) — this task

**ARCHITECTURE STANDARD (LOCKED, reused Batch 4-8):**

**Problem:** Vercel Hobby limit 12 serverless functions per deployment.
**Fix:** B+C pattern — 1 function per DOMAIN (MODULITH preserved).

| Approach | Status | Detail |
|---|---|---|
| A: Catch-all `api/[...path].ts` | ❌ TIDAK VIABLE | Vercel compile non-recursive, nested 404 |
| B: `vercel.json` rewrites | ✅ VIABLE | Recursive route semua depth → 1 function |
| C: Express Router mount prefix | ✅ VIABLE | Vercel kirim FULL URL, mount at '/api/<domain>' |

**Pattern final per domain:**
1. File `api/<domain>.ts` = Express app + `express.json()` + `app.use('/api/<domain>', router)` + 404 fallback JSON
2. `vercel.json` rewrites: `{ "source": "/api/<domain>/:path*", "destination": "/api/<domain>?path=$1" }`
3. Auth middleware di level router (kecuali auth domain — public)
4. Route order: static SEBELUM dynamic (`/summary` sebelum `/:id`, `/branches` sebelum `/:id`)

**Function count progression:**
- Sebelum konsolidasi: 14 function (limit crossed, deploy 8f5bcaf FAILED)
- Setelah patients: 11
- Setelah doctors: 10
- Setelah auth: 4
- Setelah encounters: 5
- Setelah invoices: **6** (current)

**TD-MIGRATE-009:** CRLF .env.local (LOW, debug only)
**TD-MIGRATE-010:** invoice_date phantom (FIXED, legacy schema mismatch)

**Next: Batch 4 — Core Write (Task 2.4.x)**

---

### Batch 4: Core Write (Task 2.4.x)
- [ ] `/api/patient/bookings` (POST create, PUT cancel)
- [ ] `/api/encounters` (POST, PUT, POST complete)
- [ ] `/api/admin/invoices/:id/mark-paid` + undo-payment
- [ ] `/api/patients/:id` PUT + DELETE (soft delete) + `/api/patients/merge`
- [ ] Walk-in endpoints (rate-limit: `@upstash/ratelimit` atau vercel kv tanpa log value)

### Batch 4.5: Notification (Task 2.4.5) — NEW dari verdict orphan
- [ ] `/api/admin/bookings/:id/send-reminder` (POST)
- [ ] `/api/admin/bookings/:id/send-confirmation` (POST)
- Source: `notification.routes.ts` (orphan) — handler + service aktif.

### Batch 5: Redis Replacement (Task 2.7)
- [ ] `/api/queue/status` — Redis INCR → Postgres `nextval()` sequence
- [ ] queueManagement.resetAllQueuesForDate → SQL reset

### Batch 6: Realtime (Task 2.6)
- [ ] Socket.IO → Supabase Realtime (`channel` per `branch:{id}`)
- [ ] Broadcast `queue:updated` → supabase channel emit / polling fallback
- [ ] Frontend `dentflow-web/src/lib/websocket.ts` switch ke supabase realtime

### Batch 7: Cron (Task 2.8)
- [ ] node-cron → Supabase pg_cron (4 job: cleanup, no-show, reset-queue, webhook-retry)

### Batch 8: Webhook (Task 2.9)
- [ ] `/webhooks/midtrans` → Vercel Edge Function (signature verify)
- [ ] Admin webhook replay + webhook-errors (ada di Batch 3/4 bila lebih dulu)

### Batch 9: Storage (Task 2.10)
- [ ] MinIO (jika nanti dibutuhkan) → Supabase Storage

### Batch 10: Testing (Task 2.11 - 2.14)
- [ ] E2E Cypress + Jest (>70%)
- [ ] Load test k6
- [ ] Tech Inspector Mode (fetch wrapper + Zustand)
- [ ] Final polish + cleanup (hapus Express route legacy setelah verified)

---

## 4. ACCEPTANCE CRITERIA PER TASK

**Task 2.1.x** (Foundation):
- Endpoint respond 200 dengan data Supabase
- Health + regression check tetap 200
- rootDirectory Vercel tetap stabil (cek via Vercel API setiap deploy)
- LOGBOOK + TECHNICAL DEBT update
- Commit + push

**Task 2.2.x** (Auth middleware → helper):
- Semua protected route tolak request tanpa/token invalid → 401
- role check salah → 403
- Tenant isolation tetap berjalan (test cross-branch → 403)
- Login/register flow identik dengan Express (bandingkan response shape)

**Task 2.3.x** (Core Read):
- Response JSON shape SAMA dengan Express (contract test)
- Filter/query param (branchId, status, dll) berfungsi sama

**Task 2.4.x** (Core Write):
- INSERT/UPDATE jalan dengan transaction; rollback saat error
- Validasi zod sama (pesan error identik)
- Soft delete tidak menghilangkan row

**Task 2.5** dst — diisi per task saat dimulai (ikuti template di atas).

---

## 5. RISK & MITIGATION

| Risk | Mitigation |
|---|---|
| rootDirectory Vercel ke-reset → empty lambda 404 | Monitor via API tiap deploy (pelajaran TD-VERCEL-008) |
| Supabase free tier 500MB | Audit ukuran tabel, cleanup job temp data |
| Vercel timeout 10s (functions) | Optimasi query, tambah index, reduce payload |
| Express masih live (parallel run) | Frontend pointing switch manual (`NEXT_PUBLIC_API_URL`) |
| Runtime Node <22 (supabase-js butuh WebSocket native) | Dependency `ws`, passthrough transport (TD-VERCEL-006) |
| Response contract drift (Express vs serverless) | Contract test: bandingkan JSON shape endpoint-by-endpoint |
| Env tidak tersedia di Vercel serverless | Audit var env: `DATABASE_URL`, `JWT_SECRET`, `MIDTRANS_SERVER_KEY` (TANPA login value) |
| Endpoint orphan terlewat (docs, invoicePayment, notification) | Verdict eksplisit di §0 sebelum dikerjakan |

---

**Last Updated**: 2026-09-12
**Version**: 1.1 (Patched 2026-09-12) — fix 5 gap dari review