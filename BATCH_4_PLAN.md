# BATCH 4 PLAN - CORE WRITE (Phase 2)

> Hasil pre-decision audit Task 2.4.0 (2026-09-13).
> Referensi: ROADMAP TAMBAHAN.txt Phase 2, MIGRATION_PLAN.md §3.
> Log: `task_2_4_0.log`; verifikasi konsistensi: `task_2_4_0b.log`

---

## 0. RINGKASAN AUDIT

**Total write endpoint Express:** 34
**Trigger status (verified 2026-09-13 via SQL `pg_trigger`):** `trg_generate_invoice_on_encounter_complete` AKTIF (enabled='O'), `invoice_status_reversal_trigger` AKTIF, `trg_log_invoice_payment` AKTIF, `trg_invoice_payments_immutable` AKTIF.
- Auth endpoints (already migrated Batch 3 / Task 2.3.2f): 7
- **Non-auth write endpoints (Batch 4 scope): 27**
- Orphan/unmounted routes (N1 N2 notification): 2 (defined but not mounted in `index.ts`)

**Klasifikasi per kategori:**
| Kategori | Count | Endpoint |
|---|---|---|
| A. Simple Write (single INSERT/UPDATE/DELETE, no tx, no audit) | 5 | B2 (cancel), W1 (temp profile), D2 (removeLeave), N1 (sendReminder orphan), N2 (sendConfirmation orphan) |
| B. Write + Audit Log (single-table state change, row-level FOR UPDATE) | 3 | I1 (markPaid admin), I2 (undoPayment), I3 (invoicePayment markPaid) |
| C. Write + Transaction (multi-table BEGIN/COMMIT, primary complexity) | 14 | B1 (createScheduledBooking), E1 (startEncounter), E2 (updateEncounter), I4 (addInvoicePayment), P1 (updatePatient), P2 (softDeletePatient), P3 (mergePatients), C2 (adminWalkInCheckin), W3 (convertTemporaryToPatient), D1 (setLeave), D0 (updateDoctorProfile), D3 (readyNextDoctor), D4 (queue check-in nested), S1 (markNoShowManual) — *E3 pindah ke kategori D (lihat D3), konsisten: sum 5+3+14+1+2+2=27* |
| D. Write + DB Trigger (E3 depends trigger for invoice gen) | 1 | **E3 `POST /encounters/:id/complete`** — trigger `trg_generate_invoice_on_encounter_complete` AKTIF (verified 2026-09-13 via SQL `pg_trigger`). Serverless UPDATE status → trigger INSERT invoice shell (amount=0) → service ENRICH amount. |
| E. Write + Redis (queue INCR at check-in time) | 2 | C1 (adminCheckin), W2 (bookWalkInAppointment) |
| F. Write + Midtrans Webhook | 2 | S2 (handleMidtransWebhook), S3 (adminWebhook replay) |

---

## 1. INVENTARIS WRITE ENDPOINT

### Group 2 — Booking

| # | Method | Path (relative to mount) | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| B1 | POST | `/patient/bookings` | `createScheduledBooking` | `BookingService.createScheduledBooking` | ✅ (multi-table) | ✅ | ❌ | C | 0.5 hari |
| B2 | PUT | `/patient/bookings/:id/cancel` | inline raw SQL | — (pool.query) | ❌ (single UPDATE) | ❌ | ❌ | A | 0.25 hari |

### Group 3 — Encounter

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| E1 | POST | `/encounters/` | `startEncounter` | `EncounterService.startEncounter` | ✅ | ✅ | ❌ | C | 0.5 hari |
| E2 | PUT | `/encounters/:id` | `updateEncounter` | `EncounterService.updateEncounter` | ✅ | ✅ | ❌ | C | 0.5 hari |
| E3 | POST | `/encounters/:id/complete` | `completeEncounter` | `EncounterService.completeEncounter` → `InvoiceGenerationService.generateInvoiceForEncounter` (ENRICH shell dari trigger) | ✅ + nested (2nd conn) | ✅ | ❌ | D | 1 hari (highest risk) — depend trigger, lihat D3 |

### Group 4 — Invoice / Payment

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| I1 | POST | `/admin/invoices/:id/mark-paid` | `InvoiceHandler.markPaid` | `InvoiceService.markPaid` (FOR UPDATE) | ✅ (FOR UPDATE) | ✅ | ❌ | B | 0.5 hari |
| I2 | POST | `/admin/invoices/:id/undo-payment` | `InvoiceHandler.undoPayment` | `InvoiceService.undoPayment` (FOR UPDATE) | ✅ (FOR UPDATE) | ✅ | ❌ | B | 0.5 hari |
| I3 | PUT | `/invoices/:id/mark-paid` | `InvoicePaymentHandler.markPaid` | `InvoicePaymentService.markInvoicePaid` → `invoiceStateMachineService.transitionToPaid` | ✅ | ✅ | ❌ | B | 0.5 hari |
| I4 | POST | `/invoices/:id/payments` | `addInvoicePayment` | `invoiceStateMachineService.transitionToPaid` + raw post-commit UPDATE | ✅ | ✅ | ❌ | C | 0.5 hari |

### Group 5 — Patient CRUD

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| P1 | PUT | `/patients/:id` | `updatePatient` | inline raw SQL | ✅ | ❌ | ❌ | C | 0.25 hari |
| P2 | DELETE | `/patients/:id` | `softDeletePatient` | inline raw SQL | ✅ | ❌ | ❌ | C | 0.25 hari |
| P3 | POST | `/patients/merge` | `mergePatients` | inline raw SQL | ✅ (multi-table) | ❌ | ❌ | C | 0.5 hari |

### Group 6 — Admin / Check-in

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| C1 | POST | `/admin/check-in` | `adminCheckin` | `CheckinService.checkinPatient` | ✅ | ✅ | ✅ (Redis INCR) | E | 0.5 hari |
| C2 | POST | `/admin/check-in/walk-in` | `adminWalkInCheckin` | inline raw SQL | ✅ | ❌ | ❌ | C | 0.5 hari |

### Group 7 — Walk-in

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| W1 | POST | `/walk-in/create-profile` | `createTemporaryProfile` | `WalkInService.createTemporaryProfile` | ❌ (single INSERT) | ❌ | ❌ | A | 0.25 hari |
| W2 | POST | `/walk-in/book-appointment` | `bookWalkInAppointment` | `WalkInService.bookAppointment` | ✅ | ✅ | ✅ (Redis INCR) | E | 0.5 hari |
| W3 | POST | `/walk-in/convert-to-patient` | `convertTemporaryToPatient` | `WalkInService.convertTemporaryToPatient` | ✅ | ✅ | ❌ | C | 0.5 hari |

### Group 8 — Doctor Slot / Queue

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| D0 | PUT | `/doctors/me` | `updateDoctorProfile` | inline raw SQL | ✅ (email dup check) | ❌ | ❌ | C | 0.25 hari |
| D1 | PUT | `/doctors/:id/leave` | `setLeave` | `DoctorScheduleService.setDoctorLeave` | ✅ | ❌ | ❌ | C | 0.25 hari |
| D2 | DELETE | `/doctors/:id/leave` | `removeLeave` | `DoctorScheduleService.removeDoctorLeave` | ❌ (single DELETE) | ❌ | ❌ | A | 0.25 hari |
| D3 | POST | `/doctors/:id/ready-next` | `readyNextDoctor` | `DoctorQueueService.callNextPatient` → `QueueManagementService.callNextPatient` | ✅ | ❌ | ❌ | C | 0.5 hari |
| D4 | POST | `/queue/:id/check-in` | `checkInPatient` | `DoctorQueueService.checkInPatient` → `QueueManagementService.completePatient` + `EncounterService.startEncounter` | ✅ nested (2 conn, 2 tx) | ✅ (encounter part) | ❌ | C | 0.75 hari |

### Group 9 — Notification (ORPHAN routes)

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| N1 | POST | `/bookings/:id/send-reminder` | `NotificationHandler.sendReminder` | `NotificationService.sendReminderSMS` | ❌ (single INSERT) | ❌ | ❌ | A (orphan) | 0.25 hari |
| N2 | POST | `/bookings/:id/send-confirmation` | `NotificationHandler.sendConfirmation` | `NotificationService.sendBookingConfirmation` | ❌ (single INSERT) | ❌ | ❌ | A (orphan) | 0.25 hari |

### Group 10 — No-show + Webhook

| # | Method | Path | Handler | Service | Tx | Audit | Redis | Kategori | Estimasi |
|---|---|---|---|---|---|---|---|---|---|
| S1 | PUT | `/no-shows/admin/bookings/:id/mark-no-show` | `markNoShowManual` | inline raw SQL | ✅ | ✅ | ❌ | C | 0.25 hari |
| S2 | POST | `/webhooks/midtrans` | `handleMidtransWebhook` | `PaymentWebhookService.processPaymentWebhook` | ❌ (multi-stmt autocommit) | ✅ | ❌ | F | 0.75 hari |
| S3 | POST | `/admin/webhooks/:id/replay` | `AdminWebhookHandler.replayWebhook` | `PaymentWebhookService.processPaymentWebhook` (skipValidation) | ❌ | ✅ | ❌ | F | 0.5 hari |

---

## 2. DECISION LOCK (D1–D5)

### D1: Redis Queue Handling
**Problem:** `C1 adminCheckin` dan `W2 bookWalkInAppointment` pakai `redis.incr(queue:{branchId}:{doctorId})` untuk queue number. Redis belum migrate ke serverless. Batch 5 (Task 2.7) handle Redis → Postgres `nextval()`.

**Options:**
- A) **Skip queue number** di Batch 4 — frontend kirim dummy, ganti di Batch 5
- B) **Ad-hoc Postgres sequence** — `CREATE SEQUENCE queue_number_seq` + `nextval()` (mini-migration)
- C) **Temp: MAX()+1** — work tapi race condition risk di concurrent

**DECISION: B — Postgres sequence**
**Rationale:**
- Mini-migration `CREATE SEQUENCE IF NOT EXISTS queue_seq_{branchId}_{doctorId}` sudah jadi pattern wajar di Postgres.
- `nextval()` atomic, zero race condition, persis seperti yang Batch 5 rencanakan.
- Migrasi awal ini mengurangi techn debt + konsisten dengan final architecture.
- Race condition di MAX()+1 (C) terlalu riskan untuk production concurrent check-in.
- Skip queue number (A) breaking change untuk frontend yang render nomor antrian.

---

### D2: Transaction Strategy
**Problem:** PostgREST (Supabase) gak support multi-statement transaction. Express pakai `pool.connect()` → `client.query('BEGIN')...COMMIT`. 15 endpoint pakai transaction.

**Nested tx risk yang ditemukan:**
- E3: `completeEncounter` → `generateInvoiceForEncounter` buka connection ke-2 di dalam outer tx → COMMIT inner invoice dulu, outer bisa gagal → non-atomic.
- D4: `checkInPatient` → 2 tx terpisah (queue complete + encounter start) — non-atomic.
- B1: `createScheduledBooking` panggil `sendBookingConfirmation` di connection ke-3 di dalam open tx — READ COMMITTED, booking uncommitted → invisible.

**Options:**
- A) **Compensating rollback** — kalau step 2 gagal, delete step 1 (pattern register patient Task 2.2.5)
- B) **Postgres RPC function** — Supabase `rpc()` call, satu function handle multi-statement
- C) **Skip transaction** — single-table write only, hindari multi-table atomic

**DECISION: B — Postgres RPC function**
**Rationale:**
- Supabase `rpc()` menjalankan PL/pgSQL di database, atomic by default.
- Multi-statement tx cocok di dalam RPC karena database handle BEGIN/COMMIT sendiri.
- Compensating rollback (A) terlalu fragile — manual cleanup belum tentu benar di edge case.
- "Skip tx" (C) tidak feasible — booking → encounter → invoice harus atomic.
- RPC approach juga menyelesaikan nested tx problem: E3 completeEncounter bisa jadi satu RPC `complete_encounter_and_invoice`.
- Sebagai backup, compensating rollback (A) bisa digunakan untuk edge case yang gak bisa di-RPC.
- **RPC grouping (verifikasi 2.4.0b, update 2.4.0c):** 14 endpoint C (+ E3 pindah ke D) TIDAK perlu 15 RPC sendiri. Hanya multi-table atomic yang wajib dedicated RPC: **B1, P3, W3, D4, I4** (5) + E3 sebatas enrich/polling (trigger sudah handle atomic invoice shell). Sisanya (E1 E2 P1 P2 C2 D0 D1 D3 S1) = single-table + audit opsional → bisa plain REST statement + audit di try/catch, atau dikelompokkan 1 RPC per domain agar jumlah function tetap kecil.

---

### D3: Trigger Database
**Problem:** Encounter complete → trigger `trg_generate_invoice_on_encounter_complete` auto-gen invoice. Handler E3 (`completeEncounter`) generate invoice programmatic via `InvoiceGenerationService` — perlu strategi agar tidak double-run / double-amount.

**VERIFIED (2026-09-13 via SQL `pg_trigger` di Supabase):**
- `trg_generate_invoice_on_encounter_complete` on `encounters` — **enabled = 'O' (AKTIF)** — 🔴 konfirmasi SQL: trigger benar-benar AKTIF (sebelumnya v1.1 hanya "diduga aktif", posisi terbalik sekarang).
- Fire `AFTER UPDATE OF status` saat status → `COMPLETED`.
- Action: INSERT invoice shell (`amount_due = 0`, `ON CONFLICT (encounter_id) DO NOTHING`) — migration 011.
- Guard anti double-invoice: `invoices.encounter_id UNIQUE` (migration 001:111) + `ON CONFLICT DO NOTHING`.
- **Trigger lain yang juga verified AKTIF:** `invoice_status_reversal_trigger` (invoices), `trg_log_invoice_payment` (invoices), `trg_invoice_payments_immutable` (invoice_payments) — semua `enabled = 'O'`.

**Implikasi flow E3 (serverless):**
1. Client POST `/api/encounters/:id/complete`
2. Serverless UPDATE encounter status → `COMPLETED` (+ diagnosis/treatment kalau ada)
3. **Trigger fire** → INSERT invoice shell (amount=0) ke `invoices`
4. Serverless panggil `InvoiceGenerationService.generateInvoiceForEncounter()` → **ENRICH** amount (`amount_due = dp + treatment_cost`)
5. Serverless audit log `ENCOUNTER_COMPLETED`

**Bukan**: serverless CREATE invoice from scratch (trigger udah handle shell). Ini REVERSAL dari asumsi v1.1/Express (programmatic create) → serverless harus shell + enrich.

**Risiko dual-run:** Kalau Express + serverless sama-sama update encounter → trigger fire 2x. Karena `ON CONFLICT DO NOTHING` idempotent, row aman. Tapi service enrich 2x → amount double? **Mitigasi:** guard by invoice exists check + atomic UPDATE amount (bukan ADD), atau ganti seluruh flow ke trigger-only enrichment di RPC.

**Options:**
- A) **Biarkan trigger** handle invoice insert — serverless UPDATE status → trigger create shell → serverless update `amount_due`
- B) **Disable trigger** — handle di service layer, lebih controllable
- C) **Hybrid** — trigger sebagai backup, service sebagai primary

**DECISION: A — Biarkan trigger handle (dengan enrichment amount di serverless)**
**Rationale:**
- Trigger verified AKTIF (bukan asumsi). `ON CONFLICT DO NOTHING` non-destructive → tidak butuh migration disable.
- Disable trigger (B) perlu migration `ALTER TABLE encounters DROP TRIGGER ...` — risk migrasi + menyimpang dari realita DB.
- Serverless E3 = 2 statement terpisah (atomic per statement, aman dari self-deadlock):
  1. `UPDATE encounters SET status='COMPLETED', completed_at=NOW() WHERE id=$1` → trigger create shell invoice.
  2. `UPDATE invoices SET amount_due = COALESCE((SELECT dp_amount FROM bookings WHERE id = ...),0) + treatment_price WHERE encounter_id=$1` → enrichment.
- Single responsibility: trigger = DB integrity (invoice PASTI ada), application = business logic (hitung amount).
- Klasifikasi: E3 pindah dari C (current, programmatic) → D (serverless, depend trigger) — konsisten dengan baris "D=1" di §0.
- **Catatan penting:** Express E3 (legacy) generate invoice DI LUAR trigger → JANGAN dibawa ke serverless; di serverless update status saja, sisanya trigger + enrich.

**⚠️ Trigger reversal `invoice_status_reversal_trigger` AKTIF (untuk Batch 4b):**
- Trigger ini prevent `PAID → UNPAID` reversal di `invoices` (verifikasi user, 2026-09-13).
- Dampak ke Task 2.4.10 `I2 undoPayment (admin override)`: UPDATE status invoice langsung akan DITOLAK trigger.
- Handle (defer detail ke Task 2.4.10/2.4.11):
  - Opsi A: `SET session_replication_role = replica` (bypass semua trigger — RISKY, jangan)
  - Opsi B: **Soft approach — RECOMMENDED:** INSERT row baru `UNDO` di `invoice_payments` / state machine, JANGAN UPDATE status langsung
  - Opsi C: Drop trigger sementara (bad)
- **Decision: Opsi B (soft undo)** — defer detail ke Task 2.4.10 (undo-payment).

---

### D4: Audit Log Pattern
**Problem:** Express log ke `audit_logs` via `auditService.logEvent()` di 14 write endpoints.

**Temuan audit:**
- Pattern: `await auditService.logEvent({ userId, eventType, description, metadata, branchId }, client?)` — konsisten semua handler.
- Service INSERT ke table `audit_logs` (event type → JSON description).
- 13 dari 27 non-auth endpoint pakai audit. Tidak pakai: B2, P1, P2, P3, C2, D0, D1, D2, D3, W1.

**Options:**
- A) **INSERT langsung** di handler serverless (pattern established)
- B) **Async queue** — over-engineering untuk demo

**DECISION: A — INSERT langsung di handler**
**Rationale:**
- Pattern sudah established di 13 endpoint → konsistensi, mudah di-review.
- Audit INSERT gagal tidak seharusnya memblokir write utama (bisa wrapped di try/catch).
- Async queue (B) over-engineering untuk skala demo.
- Di serverless, audit INSERT pakai `supabase.from('audit_logs').insert(...)` — simple, sudah terbukti.

---

### D5: Scope Batch 4
**Problem:** 27 endpoint terlalu banyak untuk 1 batch. Perlu split.

**Rumusan estimasi berdasarkan klasifikasi:**
- A (Simple): 5 × 0.25 = 1.25 hari
- B (Audit + row lock): 3 × 0.5 = 1.5 hari
- C (Transaction): 14 × 0.37 avg = 5.2 hari
- D (Trigger-based): 1 × 1 = 1 hari (E3, pindah dari C — update 2.4.0c)
- E (Redis queue): 2 × 0.5 = 1 hari
- F (Midtrans webhook): 2 × 0.625 = 1.25 hari
- **Total: ~11.2 hari** (rough estimate)
*Verifikasi 2.4.0b (diupdate 2.4.0c): E3 pindah C→D (5.2 + 1 = 6.2 hari kategori transaksi/trigger, total flat 11.2 vs 11.5 breakdown §3) = +0.3 hari buffer infra (RPC setup, Postgres sequence mini-migration) + regression QA.*

**Options:**
- A) **Migrate semua** (~11.2 hari, > 2 minggu kerja) — aggressive, risk burnout
- B) **Prioritas kritis** — booking + EMR + invoice (4-5 hari)
- C) **Split 4a + 4b** — 4a booking+EMR+queue+patient CRUD, 4b payment+webhook+misc

**DECISION: C — Split 4a + 4b**
**Rationale:**
- **Batch 4a (Core Write):** B1 B2 + E1 E2 E3 + C1 C2 + P1 P2 P3 + D0 D1 D2 D3 D4 + S1 + W1 W2 W3 + N1 N2 = 21 endpoint, ~8 hari
  - Focus: booking → encounter → invoice flow (critical path), queue system, patient CRUD
  - Risiko: E3 nested tx + D4 nested tx (tinggi) — selesaikan awal
- **Batch 4b (Payment & Webhook):** I1 I2 I3 I4 + S2 S3 = 6 endpoint, ~3.5 hari
  - Focus: invoice payment state machine + Midtrans webhook
  - Risiko: webhook Hanya 1 endpoint tapi flow sangat kompleks
- A (migrate semua) tidak realistis untuk 1 batch — lebih dari 2 minggu.
- B (prioritas kritis) tidak cukup detail — Batch 4a/b lebih actionable.
- **Approach:** 4a dan 4b tetap satu batch logika, tapi 4a dikerjakan dulu. 4b sebagai follow-up immediate.

---

## 3. TASK BREAKDOWN

### Batch 4a — Core Write (21 endpoint, ~8 hari)

#### Wave 1: Infrastructure + Simple Writes (hari 1–2)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.1 | D2 (removeLeave) + W1 (tempProfile) + B2 (cancelBooking) + N1 (sendReminder) + N2 (sendConfirmation) — 5 simple writes | A | 0.5 hari | Batch 3 done |
| Task 2.4.2 | D0 (updateDoctorProfile) + D1 (setLeave) + P1 (updatePatient) + P2 (softDeletePatient) + S1 (markNoShowManual) — simple tx writes | C | 1 hari | — |

#### Wave 2: Queue + Check-in (hari 3–4)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.3 | Postgres sequence setup + C1 (adminCheckin) + C2 (adminWalkInCheckin) + W2 (bookWalkInAppointment) — queue migration | E | 1.5 hari | Postgres sequence mini-migration |
| Task 2.4.4 | W3 (convertTemporaryToPatient) | C | 0.5 hari | — |

#### Wave 3: Encounter Flow — Critical Path (hari 5–6)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.5 | E1 (startEncounter) + E2 (updateEncounter) — encounter CRUD | C | 1 hari | — |
| Task 2.4.6 | E3 (completeEncounter) — highest risk: nested tx → trigger strategy | C | 1.5 hari | D3 decision (trigger strategy); D2 decision (RPC approach) |

#### Wave 4: Booking + Patient Merge + Queue Check-in (hari 7–8)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.7 | B1 (createScheduledBooking) — tx + notification side-effect | C | 1 hari | — |
| Task 2.4.8 | P3 (mergePatients) + D3 (readyNextDoctor) + D4 (queue check-in) — complex multi-table tx | C | 1.5 hari | D4 nested tx needs care |

---

### Batch 4b — Payment & Webhook (6 endpoint, ~3.5 hari)

#### Wave 5: Invoice Payment State Machine (hari 9–10)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.9 | I3 (invoicePayment markPaid) — state machine core | B | 1 hari | State machine lib |
| Task 2.4.10 | I1 (markPaid admin) + I2 (undoPayment admin) — admin overrides | B | 0.5 hari | — |
| Task 2.4.11 | I4 (addInvoicePayment) — state machine + post-commit fix | C | 0.5 hari | — |

#### Wave 6: Midtrans Webhook (hari 11)
| Task | Endpoint(s) | Kategori | Estimasi | Dependencies |
|---|---|---|---|---|
| Task 2.4.12 | S2 (midtransWebhook) — HMAC verify + multi-branch routing | F | 1 hari | — |
| Task 2.4.13 | S3 (adminWebhookReplay) — admin replay + skip validation | F | 0.5 hari | — |

---

## 4. KNOWN TECHNICAL DEBT (TEMUAN AUDIT)

| ID | Severity | Description | Status | Action |
|---|---|---|---|---|
| TD-2.4.0 | HIGH | **Nested tx non-atomic:** E3 completeEncounter + generateInvoiceForEncounter buka 2 connection, 2 tx → invoice COMMIT sebelum encounter COMMIT | Open | Batch 4a: ganti dengan trigger-based (D3 decision) atau RPC (D2 decision) |
| TD-2.4.1 | HIGH | **Nested tx non-atomic:** D4 queue checkInPatient → completePatient + startEncounter = 2 tx terpisah | Open | Batch 4a: RPC `checkin_patient_and_start_encounter` atau compensating rollback |
| TD-2.4.2 | MEDIUM | **Redis key collision:** `adminCheckin` key = `queue:{branchId}:{doctorId}` (no date suffix), `queueService` key = `queue:{branchId}:{doctorId}:{date}` → collision across days | Open | Batch 4a: Postgres sequence per (branchId, doctorId, date) |
| TD-2.4.3 | MEDIUM | **DB COUNT vs Redis counter inconsistency:** `adminWalkInCheckin` pakai DB COUNT(*) untuk queue number, `adminCheckin` pakai Redis INCR → inconsistent numbers | Open | Batch 4a: ganti ke Postgres sequence (both) |
| TD-2.4.4 | LOW | **Notification orphan routes:** N1 N2 defined in `notification.routes.ts` but NOT mounted in `index.ts` → unreachable | Open | Batch 4a: mount routes or migrate to serverless as orphan endpoints |
| TD-2.4.5 | LOW | **B1 notification side-effect:** `createScheduledBooking` panggil `sendBookingConfirmation` di open tx dengan connection terpisah → READ COMMITTED, booking row uncommitted → likely BOOKING_NOT_FOUND | Open | Batch 4a: post-commit notification or move outside tx |
| TD-2.4.6 | HIGH | **(BARU) Trigger `trg_generate_invoice_on_encounter_complete` verified AKTIF** (2026-09-13). Serverless E3 WAJIB handle shell + enrich (bukan create). Test idempotency dual-run Express + serverless sebelum cutover | Open | Task 2.4.6: D3 decision — trigger-based + enrich (blocking E3) |

---

## 5. RISK REGISTER

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| E3 nested tx (TD-2.4.0) causes invoice without encounter commit | MEDIUM | HIGH | D3: trigger-based invoice gen (atomic) |
| D4 nested tx causes encounter without queue complete | MEDIUM | MEDIUM | D2: RPC or compensating rollback |
| Redis queue key collision across days | HIGH | LOW | D1: Postgres sequence with date component |
| Midtrans webhook HMAC fails in serverless | LOW | HIGH | Edge function for HMAC, fallback to serverless function |
| Batch 4a takes > 8 days → timeline slip | MEDIUM | MEDIUM | Strict wave boundary, ship 4a first, defer 4b |
| Walk-in Redis → Postgres migration affects concurrent check-in | LOW | MEDIUM | Sequence is atomic, test concurrent load |

---

## 6. URUTAN MIGRATE (SEQUENTIAL)

### Batch 4a — Core Write
1. Task 2.4.1 — Simple writes (D2 W1 B2 N1 N2) — 0.5 hari
2. Task 2.4.2 — Simple tx writes (D0 D1 P1 P2 S1) — 1 hari
3. Task 2.4.3 — Queue + check-in (C1 C2 W2 + Postgres sequence) — 1.5 hari
4. Task 2.4.4 — Walk-in convert (W3) — 0.5 hari
5. Task 2.4.5 — Encounter CRUD (E1 E2) — 1 hari
6. Task 2.4.6 — Complete encounter (E3 + trigger strategy) — 1.5 hari
7. Task 2.4.7 — Create booking (B1) — 1 hari
8. Task 2.4.8 — Patient merge + queue ops (P3 D3 D4) — 1.5 hari

### Batch 4b — Payment & Webhook
9. Task 2.4.9 — Invoice state machine (I3) — 1 hari
10. Task 2.4.10 — Admin invoice ops (I1 I2) — 0.5 hari
11. Task 2.4.11 — Invoice payment (I4) — 0.5 hari
12. Task 2.4.12 — Midtrans webhook (S2) — 1 hari
13. Task 2.4.13 — Admin webhook replay (S3) — 0.5 hari

**Total estimasi Batch 4a:** 8 hari
**Total estimasi Batch 4b:** 3.5 hari
**Total estimasi Batch 4 (full):** 11.5 hari

---

## 7. DOMAIN MAPPING & SEQUENCE DESIGN (Task 2.4.2a)

> Pre-audit sebelum implementasi sisa Batch 4a. Log: `task_2_4_2a.log`.
> Audit findings: func count 9/12 (Vercel Hobby limit), draft sequence dikoreksi (branch_id UUID).

### 7.1 Domain Mapping — 21 Endpoint Batch 4a

| ID | Method+Path | File Serverless | Extend/New | Task | LOC est | Status |
|---|---|---|---|---|---|---|
| D2 | DELETE `/doctors/:id/leave` | `doctors.ts` | Extend | 2.4.1 | ~50 | ✅ DONE |
| W1 | POST `/walk-in/create-profile` | `walkIn.ts` | New | 2.4.1 | ~50 | ✅ DONE |
| B2 | PUT `/patient/bookings/:id/cancel` | `bookings.ts` | Extend | 2.4.1 | ~130 | ✅ DONE |
| N1 | POST `/bookings/:id/send-reminder` | `notifications.ts` | New | 2.4.1 | ~30 | ✅ DONE |
| N2 | POST `/bookings/:id/send-confirmation` | `notifications.ts` | New | 2.4.1 | ~30 | ✅ DONE |
| D0 | PUT `/doctors/me` | `doctors.ts` | Extend | 2.4.2 | ~80 | ✅ DONE (2.4.2c fix) |
| D1 | PUT `/doctors/:id/leave` | `doctors.ts` | Extend | 2.4.2 | ~80 | ✅ DONE (2.4.2c fix) |
| P1 | PUT `/patients/:id` | `patients.ts` | Extend | 2.4.2 | ~60 | ✅ DONE (2.4.2c fix) |
| P2 | DELETE `/patients/:id` | `patients.ts` | Extend | 2.4.2 | ~60 | ✅ DONE (2.4.2c fix) |
| S1 | PUT `/no-shows/admin/bookings/:id/mark-no-show` | `bookings.ts` | Extend | 2.4.2 | ~60 | ✅ DONE (2.4.2c fix) |
| C1 | POST `/admin/check-in` | `checkIn.ts` (NEW) | **New (+1 func)** | 2.4.3 | ~120 | ✅ DONE |
| C2 | POST `/admin/check-in/walk-in` | `checkIn.ts` (NEW) | New | 2.4.3 | ~90 | ✅ DONE |
| W2 | POST `/walk-in/book-appointment` | `walkIn.ts` | Extend | 2.4.3 | ~120 | ✅ DONE |
| W3 | POST `/walk-in/convert-to-patient` | `walkIn.ts` | Extend | 2.4.4 | ~100 | ✅ DONE |
| E1 | POST `/encounters/` | `encounters.ts` | Extend | 2.4.5 | ~80 | ✅ DONE |
| E2 | PUT `/encounters/:id` | `encounters.ts` | Extend | 2.4.5 | ~80 | ✅ DONE |
| E3 | POST `/encounters/:id/complete` | `encounters.ts` | Extend | 2.4.6 | ~120 (HIGH RISK) | ✅ DONE |
| B1 | POST `/patient/bookings` | `bookings.ts` | Extend | 2.4.7 | ~150 | ✅ DONE |
| P3 | POST `/patients/merge` | `patients.ts` | Extend | 2.4.8 | ~100 | ✅ DONE |
| D3 | POST `/doctors/:id/ready-next` | `doctors.ts` | Extend | 2.4.8 | ~80 | pending |
| D4 | POST `/queue/:id/check-in` | `checkIn.ts` (NEW) | New | 2.4.8 | ~100 | pending |

**Total:** 21 endpoint — DONE 5, pending 16. **1 file baru saja: `checkIn.ts`** (C1+C2+D4, +1 func; D4 digabung ke checkIn.ts biar hemat func, bukan file `queue.ts` terpisah).

### 7.2 Func Count Projection

- **Current:** 9 (auth, bookings, doctors, encounters, health, invoices, notifications, patients, walkIn) — confirmed `task_2_4_1.log` `TOTAL_FUNCS=9`.
- **Limit:** 12 (Vercel Hobby, `MIGRATION_PLAN.md:326`) → sisa slot **3**.
- **Batch 4a projection:** extend 6 file existing (0 new func) + **`checkIn.ts` (+1)**.
  - Setelah Batch 4a: **10 function** (sisa slot 2).
  - Worst case (kalau D4 butuh file `queue.ts` sendiri): **11** — tetap aman.
- **Batch 4b est:** extend `invoices.ts` (I1-I4, 0) + kemungkinan `webhooks.ts` baru (S2/S3, +1) → **11-12**.
  - ⚠️ **Risk:** kalau Batch 4b bikin 1 file baru, angka 12 penuh. Mitigasi: S2/S3 masuk `payments.ts`/`invoices.ts` (extend) atau gabung 1 file, baru +1.

### 7.3 Postgres Sequence Design (D1 Decision) — Option B

**Decision:** Option B — table `queue_sequences` + atomic upsert function `get_next_queue_number()`.

**Draft SQL:** `dentflow-backend/migrations/032_queue_sequence.sql.draft` (extension `.sql.draft` → **di-skip** migrate.ts karena filter `endsWith('.sql')`, jadi belum apply).

**Koreksi audit 2.4.2a (draft awal → final):**
| Item | Draft awal (prompt) | Koreksi (schema nyata) |
|---|---|---|
| `branch_id` | `VARCHAR(1)` | **`UUID`** (`queues.branch_id UUID NOT NULL` — migrations/001) |
| `doctor_id` | `UUID` | `UUID` ✓ |
| `p_date` | wajib | `DEFAULT CURRENT_DATE` (konsisten Redis key `queue:{branch}:{doctor}:{YYYYMMDD}`) |
| query current | — | tambah `get_current_queue_number()` (parity Express `getCurrentQueueNumber`) |
| security | — | `SECURITY DEFINER` + `GRANT EXECUTE` ke `service_role, authenticated` |

**Rationale build vs ad-hoc `CREATE SEQUENCE` (Option A):**
- `CREATE SEQUENCE` global — butuh dynamic sequence name per (branch, doctor, date) biar reset harian; rapuh.
- Upsert `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` = atomic, race-safe, 1 file, gampang di-test & di-cleanup (retention 30 hari).

**Serverless pattern perubahan:**
- Sebelum: `QueueService.getNextQueueNumber()` → `redis.incr('queue:{branch}:{doctor}')`
- Sesudah: `supabase.rpc('get_next_queue_number', { p_branch_id, p_doctor_id, p_date })`
- Endpoint konsumen: **C1, W2** (Task 2.4.3).

**Scheduling note:** MIGRATION_PLAN/BATCH_4_PLAN assign sequence ke **Task 2.4.3** (C1/C2/W2), B1 (booking create) = Task 2.4.7.

### 7.4 Method Expand Pattern

Migrasi dari 1 route → N route per file, tetap pakai `express.Router()` + guard (`putOnly`/`postOnly`) + auth middleware + 404 fallback:

| File | Route existing → tambahan |
|---|---|
| `bookings.ts` | PUT `/:id/cancel` → + POST `/` (B1) + PUT `/no-shows/admin/bookings/:id/mark-no-show` (S1) |
| `doctors.ts` | GET `/`, GET `/:id/patients`, DELETE `/:id/leave` → + PUT `/me` (D0) + PUT `/:id/leave` (D1) + POST `/:id/ready-next` (D3) |
| `patients.ts` | GET bucket → + PUT `/:id` (P1) + DELETE `/:id` (P2) + POST `/merge` (P3) |
| `walkIn.ts` | POST `/create-profile` → + POST `/book-appointment` (W2) + POST `/convert-to-patient` (W3) |
| `encounters.ts` | GET `/`, GET `/:id` → + POST `/` (E1) + PUT `/:id` (E2) + POST `/:id/complete` (E3) |
| `notifications.ts` | N1+N2 → stabil (done) |
| `checkIn.ts` (NEW) | C1 `POST /admin/check-in`, C2 `POST /admin/check-in/walk-in`, D4 `POST /queue/:id/check-in` |

**vercel.json tambahan (di task terkait):** rewrite `/api/no-shows/:path*`, `/api/admin/check-in/:path*`, `/api/queue/:path*` → ke handler masing-masing.

---

## 8. ACCEPTANCE CRITERIA PER TASK

- Endpoint respond sesuai status (201/200/400/401/403/404/409)
- Response shape parity Express
- Audit log tercatat (kalau applicable)
- Branch scope enforced
- Queue number generated via Postgres sequence (for C1, W2)
- Invoice generation via DB trigger (for E3)
- Regression: read endpoint tetap works (Batch 3 not broken)
- Webhook HMAC verification passed (for S2)
- Regression: auth endpoint tetap works (Batch 3)

---

**Last Updated:** 2026-09-14 (task_2_4_2a)
**Version:** 1.3 (Task 2.4.2a — domain mapping 21 endpoint + Postgres sequence design §7)
**Author:** Task 2.4.0 pre-decision audit + Task 2.4.0b consistency verification + Task 2.4.2a pre-audit
