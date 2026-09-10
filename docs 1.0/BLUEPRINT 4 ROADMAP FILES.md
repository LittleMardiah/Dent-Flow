# 🎯 MASTER BLUEPRINT - DENTFLOW 4-ROADMAP STRUCTURE
## Comprehensive Outline & Content Specification

**Purpose:** MASTER ACUAN untuk membuat 4 ROADMAP files tanpa halusinasi, tetap fokus, dan saling terhubung sempurna

**Date Created:** 2026-07-10  
**Total Estimated Lines:** 4,200-5,200 lines across 4 files  
**Total Estimated Tokens:** 38,000-46,000 tokens (VERY SAFE)  
**Status:** LOCKED & APPROVED - Siap untuk generation

---

# 📋 TABLE OF CONTENTS - MASTER BLUEPRINT

1. File 1 Specification (Weeks 1-2)
2. File 2 Specification (Weeks 3-4)
3. File 3 Specification (Weeks 5-8)
4. File 4 Specification (Week 9 + Integration + Deployment)
5. Cross-File Continuity Strategy
6. Recommendation Mapping Matrix
7. Generation Instructions

---

# 📄 FILE 1: ROADMAP_PHASE_1_FOUNDATION.md
## Weeks 1-2: Setting Up Everything (Foundation & Infrastructure)

**Target Token Count:** 8,000-10,000 tokens  
**Target Line Count:** 1,000-1,200 lines  
**Estimated Reading Time:** 10-15 minutes

### EXACT SECTIONS TO INCLUDE:

#### 1.1 EXECUTIVE OVERVIEW (150-200 lines)
- Project title: DentFlow v1.0 MVP (Modular Monolith)
- High-level mission: Clinic management system, 3 branches, 24 doctors
- Timeline: 9 weeks total (this file covers weeks 1-2)
- Success criteria & KPIs for Phase 1
- Risk overview (high-level, detailed risks in Phase 5)
- Key dependencies from PRD v10.0, TDD v1.0

#### 1.2 PHASE 1 OVERVIEW (100-150 lines)
- What Phase 1 achieves: Foundation ready, all infrastructure in place
- Exit criteria: When Phase 1 is complete, what should be true
- Technology versions locked: Node.js 18.x, PostgreSQL 15, Redis 7, Docker, etc
- Reference to all 6 recommendations and which ones apply to Phase 1

#### 1.3 WEEK 1 DETAILED BREAKDOWN (250-350 lines)
**Theme:** "Environment Setup & Project Foundation"

**Day 1-2 (Setup Sprint):**
- [ ] Task 1.1.1: Node.js + TypeScript + Express project scaffold
  - Create backend/ folder structure per TDD Architecture (Section 3)
  - Install core dependencies (express, pg, redis, cors, helmet)
  - Configure TypeScript compilation & ts-node
  - Run smoke test: `npm run dev` starts without errors
  
- [ ] Task 1.1.2: Docker Compose setup (PostgreSQL + Redis + MinIO)
  - Write docker-compose.yml with 3 services
  - Reference TDD Section 2 (Tech Stack)
  - Local volumes for data persistence
  - Network configuration for inter-service communication
  - Test: `docker-compose up` - all services healthy in 30s

- [ ] Task 1.1.3: Environment variables & configuration
  - .env.example file (no secrets)
  - .env.local (local development, git-ignored)
  - Configuration loader (dotenv)
  - Separate configs for dev/staging/prod

- [ ] Task 1.1.4: Code structure & folder organization
  - Follow TDD Section 3: Backend Folder Structure (Modulith pattern)
  - Create: src/routes, src/services, src/repositories, src/middleware, src/models
  - Create: tests/unit, tests/integration
  - Create: docs/, migrations/, scripts/
  - Linter setup (ESLint + Prettier)

**Day 3-4 (Database & Security):**
- [ ] Task 1.1.5: PostgreSQL database schema creation
  - Reference TDD Section 4: Database Design (11 tables)
  - Write migrations/ scripts for all tables
  - users, patients, doctors, bookings, queues, encounters, invoices, audit_logs, etc
  - Foreign keys, constraints, indices
  - Test: `npm run migrate` completes without errors

- [ ] Task 1.1.6: Authentication foundation
  - JWT implementation (jsonwebtoken package)
  - Bcrypt password hashing (bcryptjs)
  - Auth middleware (verify JWT token)
  - Reference: TDD Section 8 (Security & Authentication)
  - Test users created: 1 patient, 1 admin, 1 doctor (for testing)

- [ ] Task 1.1.7: Audit log infrastructure
  - Immutable append-only audit_logs table implementation
  - AuditService for logging all events
  - Reference: PRD Line 189-192 (Immutable Audit Logs)
  - Reference: STP P0 Feature (Audit Log - 100% coverage)
  - Initial 15 event types mapped

**Day 5 (Testing & Validation):**
- [ ] Task 1.1.8: Unit test setup & first tests
  - Jest configuration
  - Mock setup for database & Redis
  - First 5 test files: auth.test.ts, database.test.ts, etc
  - Target: 5+ passing tests
  - Reference: STP Section 6 (Test Strategy)

- [ ] Task 1.1.9: Health check endpoint
  - GET /health endpoint (no auth required)
  - Returns: Database status, Redis status, API version
  - Used for monitoring (DRP requirement)

- [ ] Task 1.1.10: Logging infrastructure
  - Pino logger setup
  - Structured logging (JSON format)
  - Sentry integration (optional for Phase 1, ready for Phase 5)
  - Reference: TDD Section 9 (Error Handling & Logging)

#### 1.4 WEEK 2 DETAILED BREAKDOWN (250-350 lines)
**Theme:** "Core APIs & All 6 Recommendations Integration"

**Day 6-7 (Auth & User Management):**
- [ ] Task 1.2.1: Patient registration API
  - POST /auth/patient/register
  - Email validation, password requirements (min 8 chars, bcrypt hashing)
  - Create patients table record
  - Return JWT token + refresh token
  - Reference: HALAMAN Section 6 (Patient Auth)
  
- [ ] Task 1.2.2: Admin/Doctor login APIs
  - POST /auth/admin/login (username/password)
  - POST /auth/doctor/login (username/password)
  - Reference: PRD Line 96-100 (Authentication)
  - Roles: PATIENT, ADMIN_BRANCH (per branch), DOCTOR

- [ ] Task 1.2.3: Password reset flow
  - POST /auth/forgot-password (email)
  - Generate reset token (15 min expiry)
  - Send reset email (mock for dev)
  - POST /auth/reset-password (token + new password)
  - Reference: STP P2 Feature (Password Reset)

**Day 8-9 (6 Recommendations Integration - Phase 1):**

**Recommendation #2 Integration (Webhook Retry):**
- [ ] Task 1.2.4: Webhook handler setup & idempotency
  - Create PaymentWebhookRepository
  - payment_webhooks table (idempotency tracking)
  - payment_webhook_errors table (error tracking)
  - Signature validation infrastructure (ready for Midtrans)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #2)
  - Reference: TDD Section 9 (Error Handling)

**Recommendation #3 Integration (Invoice Payment State Machine):**
- [ ] Task 1.2.5: Invoice payment state machine foundation
  - Database constraint: UNPAID → PAID (one-way)
  - InvoiceRepository with atomic updates
  - invoice_payments table (append-only)
  - PaymentInputService setup
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #3)

**Recommendation #6 Integration (NO-SHOW Automation):**
- [ ] Task 1.2.6: Scheduled job infrastructure
  - Node-cron setup
  - NoShowDetectionJob skeleton
  - Database migration for no_show_at column
  - Cron scheduling framework (ready for Week 4)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #6)

**Day 10 (Multi-Tenant & API Gateway):**
- [ ] Task 1.2.7: Multi-tenant isolation infrastructure
  - Branch-level row security (WHERE branch_id filter)
  - Request middleware: extract branch_id from JWT token
  - Repository pattern: all queries include branch_id filter
  - Reference: PRD Line 91-95 (Multi-Tenant)
  - Reference: STP P0 Feature (Multi-Tenant Isolation)

- [ ] Task 1.2.8: API Gateway & rate limiting
  - Express middleware: rate limiter (5 req/sec per IP)
  - CORS setup
  - Security headers (Helmet)
  - Request validation middleware (Zod schemas)
  - Reference: TDD Section 8 (Security)

- [ ] Task 1.2.9: OpenAPI/Swagger documentation setup
  - Swagger/OpenAPI schema generator
  - Endpoint documentation auto-generation
  - Interactive API docs at /api/docs
  - Reference: TDD Section 5 (API Contract)

- [ ] Task 1.2.10: Phase 1 completion test suite
  - Integration test: full auth flow (register → login → token verify)
  - Integration test: database connection & schema
  - Integration test: Docker Compose health check
  - Target: 15+ passing integration tests

#### 1.5 KEY DELIVERABLES - PHASE 1 (50-100 lines)
- ✅ GitHub repo initialized (public, clean commit history)
- ✅ backend/ folder fully structured per Modulith pattern
- ✅ docker-compose.yml ready (3 services, all healthy)
- ✅ PostgreSQL schema with 11 tables (migrations)
- ✅ Redis configured (session, rate limit cache)
- ✅ JWT auth working (patient, admin, doctor roles)
- ✅ Audit log service implemented (immutable)
- ✅ All 6 recommendations foundations in place
- ✅ 15+ unit + integration tests passing (>10% coverage)
- ✅ OpenAPI docs at /api/docs
- ✅ Health check endpoint (/health)
- ✅ Code linting & formatting configured

#### 1.6 PHASE 1 EXIT CRITERIA (50-100 lines)
**Infrastructure Ready:**
- [ ] Docker Compose: All services start & stay healthy
- [ ] Database: Schema migrated, test data seeded
- [ ] API: Base URL + health check responding
- [ ] Auth: JWT tokens generated & validated correctly

**Code Quality:**
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Tests: 15+ passing (unit + integration)
- [ ] Code coverage: >5% of backend logic
- [ ] TypeScript: 0 type errors
- [ ] Commits: At least 20 commits, clear messages

**All 6 Recommendations:**
- [ ] Recommendation #2: Webhook idempotency table created
- [ ] Recommendation #3: Invoice state machine constraints in DB
- [ ] Recommendation #6: Cron job framework ready
- [ ] Recommendations #1, #4, #5: Dependencies prepared (partial)

**Go/No-Go Decision:**
- If all criteria met: PROCEED TO PHASE 2
- If criteria failed: ROOT CAUSE ANALYSIS + FIX (add to Week 1 buffer)

#### 1.7 DEPENDENCY CHECKLIST (30-50 lines)
- ✅ Node.js 18.x installed
- ✅ PostgreSQL 15 installed (or Docker)
- ✅ Redis 7 installed (or Docker)
- ✅ Git initialized
- ✅ npm/pnpm installed
- ✅ Editor: VS Code, JetBrains, or similar
- ✅ Postman or curl for API testing
- ⏳ Midtrans Sandbox account (ready for Phase 2)
- ⏳ Firebase project (ready for Phase 4)

#### 1.8 RISKS & MITIGATION (50-100 lines)
**Risk 1: Docker networking issues**
- Mitigation: Use `docker network ls` + `docker logs <container>` for debugging
- Contingency: Run services locally without Docker (slower, less portable)

**Risk 2: Database migration failures**
- Mitigation: Version migrations (001_initial_schema, 002_audit_logs, etc)
- Contingency: Manual SQL files for emergency recovery

**Risk 3: Auth token complexity**
- Mitigation: Use jsonwebtoken library (proven, tested)
- Contingency: Simpler token format (UUID + in-memory store, less secure)

**Risk 4: Scope creep in Week 1**
- Mitigation: Strict standup: Is this required for Phase 1? If no → defer to Phase 2+
- Contingency: Drop optional features (non-critical tests, Swagger docs)

#### 1.9 DAILY STANDUP TEMPLATE (50-100 lines)
```
WEEK 1 DAILY STANDUP

[DATE]: Day X of 5
Completed:
- Task 1.1.Y description (✅ DONE / ⏳ IN PROGRESS / ❌ BLOCKED)
  * Status: [specific detail]
  * Evidence: [test passing / commit link / screenshot]

Planned Today:
- Task 1.1.Z description
  * Estimated time: 2-3 hours
  * Blockers: [none / specific issue]

Risks:
- [If any new risks emerged]
```

#### 1.10 NEXT FILE HINT (50-100 lines)
```markdown
## 🔗 CONTINUATION: ROADMAP_PHASE_2_BACKEND_CORE.md

After Phase 1 completion:

PREREQUISITES TO VERIFY:
✅ Docker Compose running (postgres, redis, minio)
✅ Backend /health endpoint responding
✅ JWT auth working (patient, admin, doctor)
✅ Database schema migrated
✅ 15+ integration tests passing

WHAT PHASE 2 COVERS (Weeks 3-4):
- Booking system API (6+ endpoints)
- Payment gateway integration (Midtrans sandbox)
- Check-in system (admin input, 6-digit validation)
- Queue management (Redis, FIFO ordering)
- EMR & Auto-invoice (trigger on EMR complete)
- Payment tracking & reconciliation

KEY DELIVERABLE:
- All backend APIs functional
- Webhook idempotency verified (Rec #2)
- Invoice state machine working (Rec #3)
- Queue numbers uniqueness locked (Rec #4)
- 70%+ test coverage target

Starting Point:
- Open ROADMAP_PHASE_2_BACKEND_CORE.md
- Review Week 3 tasks
- Ensure all Phase 1 exit criteria met
- Proceed to Day 6 (Week 3, Day 1)
```

---

# 📄 FILE 2: ROADMAP_PHASE_2_BACKEND_CORE.md
## Weeks 3-4: Core Business Logic APIs

**Target Token Count:** 8,000-10,000 tokens  
**Target Line Count:** 1,000-1,200 lines  
**Estimated Reading Time:** 10-15 minutes

### EXACT SECTIONS TO INCLUDE:

#### 2.1 PHASE 2 OVERVIEW (100-150 lines)
- Theme: "Building the heart of DentFlow"
- Exit criteria: All business logic APIs working, 70%+ test coverage
- Focus: Payment gateway, booking, queue, EMR, invoice
- Reference: LOGIC_FLOW v10.0 (all 7 flows)
- Reference: TDD v1.0 Section 5 (API Contract)

#### 2.2 WEEK 3 DETAILED BREAKDOWN (250-350 lines)
**Theme:** "Booking, Payment, Check-in Foundations"

**Days 11-12 (Booking System):**
- [ ] Task 2.1.1: Booking API endpoints
  - POST /api/bookings (create booking)
  - GET /api/bookings/{id} (get single booking)
  - GET /api/bookings (list user's bookings)
  - DELETE /api/bookings/{id} (cancel booking)
  - GET /api/bookings/available-slots (query free slots)
  - Reference: HALAMAN Section 8-9 (Booking flow)
  - Reference: LOGIC_FLOW Section 1 (Steps 1-2: Booking Creation & Payment Redirect)
  - Database: bookings table (status: PENDING_PAYMENT, PAYMENT_CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW)

- [ ] Task 2.1.2: Booking validation logic
  - Max 4 patients per sesi per dokter
  - Validate: branch exists, doctor available, session time valid
  - Generate 6-digit check-in code (alphanumeric, 36^6 combinations)
  - Reference: PRD Line 102-108 (Booking constraints)

- [ ] Task 2.1.3: Booking status state machine
  - PENDING_PAYMENT → PAYMENT_CONFIRMED (via webhook)
  - PAYMENT_CONFIRMED → CHECKED_IN (via check-in API)
  - CHECKED_IN → COMPLETED (via EMR completion)
  - CHECKED_IN → NO_SHOW (via cron job, Day 5)
  - Reference: LOGIC_FLOW Section 1 Step 1 (status transitions)

**Days 13-14 (Payment Gateway Integration):**
- [ ] Task 2.1.4: Midtrans Sandbox integration
  - POST /api/bookings/{id}/payment-redirect
  - Call Midtrans API: POST /v2/transactions
  - Return redirect_url to frontend
  - Store payment_gateway_id in bookings table
  - Reference: LOGIC_FLOW Section 1 Steps 2-3 (Payment Redirect & Processing)
  - Reference: TDD Section 5 (Midtrans API contract)

- [ ] Task 2.1.5: Webhook handler (with Recommendation #2)
  - POST /webhook/payment-confirmation (unsigned endpoint)
  - Signature validation (CRITICAL - security)
  - Idempotency check (payment_webhooks table)
  - Update booking: PENDING_PAYMENT → PAYMENT_CONFIRMED
  - Audit log: PAYMENT_CONFIRMED event
  - Error handling: retry logic (3 attempts, exponential backoff)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #2)
  - Reference: LOGIC_FLOW Section 1 Step 4 (Webhook Handler)

- [ ] Task 2.1.6: Payment testing in sandbox
  - Ngrok setup (expose local webhook endpoint)
  - Midtrans test payment flow (simulate successful payment)
  - Verify booking status changes to PAYMENT_CONFIRMED
  - Verify audit log records PAYMENT_CONFIRMED event
  - Integration test: full payment flow end-to-end

**Day 15 (Check-in Foundations):**
- [ ] Task 2.1.7: Check-in API setup (minimal)
  - POST /api/admin/check-in (admin-only)
  - Input: booking_code (6-digit), doctor_id, session_id
  - Validation: kode valid? Session active? Booking exists? Payment confirmed?
  - Success: Generate queue number (via Redis, NEXT WEEK)
  - Audit log: CHECK_IN_ATTEMPTED event
  - Reference: HALAMAN Section 11 (Admin Check-in Form)
  - Reference: LOGIC_FLOW Section 2 (Check-in Flow, up to queue generation)

#### 2.3 WEEK 4 DETAILED BREAKDOWN (250-350 lines)
**Theme:** "Queue Management, EMR, Invoice, Payment Tracking"

**Days 16-17 (Queue Management):**
- [ ] Task 2.2.1: Redis queue management
  - Atomic counter per doctor per session per date: `queue:{branch}:{doctor}:{session}:{date}`
  - Queue number generation (01, 02, 03, ...)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #4)
  - Reference: LOGIC_FLOW Section 3 (Queue Management)

- [ ] Task 2.2.2: Check-in completion (using queue)
  - Complete Task 2.1.7: Generate queue number on check-in
  - POST /api/admin/check-in returns queue_number
  - Queue record in database: queues table
  - Status: WAITING
  - Checked_in_at: NOW() (for FIFO ordering)
  - Real-time update (placeholder for Phase 3 WebSocket)

- [ ] Task 2.2.3: Queue status API
  - GET /api/queues?doctor_id=X&session_id=Y
  - Returns: current_calling (queue_number), waiting_queue (array), total_in_queue
  - Sorted by checked_in_at (FIFO)
  - Reference: HALAMAN Section 12 (Queue Display)

- [ ] Task 2.2.4: Walk-in management (Recommendation #5)
  - POST /api/admin/walkin/register
  - Create temporary patient (no password, is_walk_in=true)
  - POST /api/admin/walkin/check-in
  - Auto-generate queue number (same as booking)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #5)
  - Reference: PRD Line 133 (Walk-in support)

**Days 18-19 (EMR & Auto-Invoice):**
- [ ] Task 2.2.5: EMR API endpoints
  - POST /api/doctor/encounters (create EMR for encounter)
  - PUT /api/doctor/encounters/{id} (update EMR)
  - GET /api/doctor/encounters (list doctor's encounters)
  - GET /api/patient/encounters (list patient's encounters, filtered fields)
  - EMR fields: complaints, treatments, prescriptions, diagnosis (doctor-only)
  - Status: DRAFT, COMPLETED
  - Reference: HALAMAN Section 13 (EMR Form)
  - Reference: LOGIC_FLOW Section 4 (EMR & Invoice Flow)

- [ ] Task 2.2.6: Auto-invoice on EMR completion (Recommendation #3)
  - Trigger: EMR status = DRAFT → COMPLETED
  - Auto-generate invoice:
    * Invoice ID: INV-{branch}-{YYYYMMDD}-{sequence}
    * Patient, booking, treatment info
    * DP: Rp 50.000, treatment_amount: [from pricing], total: DP + treatment
    * Status: UNPAID (default)
  - Atomicity: EMR update + invoice creation in transaction
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #3)
  - Reference: LOGIC_FLOW Section 4 Steps 1-2 (EMR → Invoice)

- [ ] Task 2.2.7: Payment tracking API
  - POST /api/admin/invoices/{id}/mark-paid
  - Input: nominal, method (CASH/TRANSFER), timestamp, notes
  - Validate: amount >= invoice.total_amount
  - Update invoice: UNPAID → PAID (one-way, immutable)
  - Create invoice_payments record (append-only audit)
  - Audit log: PAYMENT_INPUT event
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #3)
  - Reference: LOGIC_FLOW Section 7 (Payment Reconciliation)

- [ ] Task 2.2.8: Invoice list & export API
  - GET /api/admin/invoices (list unpaid invoices)
  - GET /api/admin/invoices?status=PAID (list paid invoices)
  - GET /api/admin/invoices/export-csv (download payment report CSV)
  - CSV format: Invoice#, Patient, Treatment, Total, Method, PaidAt, ReconcileBy
  - Reference: HALAMAN Section 14 (Admin Invoice Management)
  - Reference: LOGIC_FLOW Section 7 (Payment Reconciliation)

**Day 20 (Testing & NO-SHOW Automation):**
- [ ] Task 2.2.9: NO-SHOW automation cron job (Recommendation #6)
  - Complete cron job implementation (started in Phase 1, Task 1.2.6)
  - Runs every 5 minutes
  - Find unchecked bookings for completed sessions
  - Mark as NO_SHOW, set dp_forfeited=true
  - Auto-close invoice (status=AUTO_CLOSED)
  - Audit log: NOSHOW_DETECTED event
  - Test: Create past session, unchecked booking → cron marks NO_SHOW
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #6)
  - Reference: PRD Line 127 (NO_SHOW penalty)

- [ ] Task 2.2.10: Phase 2 integration test suite
  - Test 1: Full booking flow (create → payment → confirmed)
  - Test 2: Check-in flow (booking → check-in → queue)
  - Test 3: EMR flow (encounter → EMR complete → invoice generated)
  - Test 4: Payment flow (invoice → mark paid → status PAID)
  - Test 5: Walk-in flow (create temp patient → check-in → queue)
  - Test 6: NO-SHOW flow (past session → unchecked → auto-marked)
  - All 6 recommendations integrated & tested
  - Target: 50+ integration tests, >70% code coverage
  - Reference: STP Section 2 (P0 Features, 100% coverage)

#### 2.4 KEY DELIVERABLES - PHASE 2 (50-100 lines)
- ✅ Booking API (5 endpoints) - fully functional
- ✅ Midtrans payment integration - sandbox working
- ✅ Webhook handler - idempotent, robust error handling
- ✅ Check-in API - admin input, kode validation
- ✅ Queue management - Redis counters, FIFO ordering
- ✅ EMR API - create, edit, view with field-level filtering
- ✅ Auto-invoice - triggered on EMR completion
- ✅ Payment tracking - mark paid, immutable state machine
- ✅ Walk-in system - temporary patient profiles
- ✅ NO-SHOW automation - cron job detecting unchecked bookings
- ✅ All 6 recommendations implemented & integrated
- ✅ 50+ integration tests passing
- ✅ >70% code coverage

#### 2.5 PHASE 2 EXIT CRITERIA (50-100 lines)
**Booking & Payment:**
- [ ] Booking creation → Payment redirect → Webhook confirmation works end-to-end
- [ ] Sandbox payment simulation passes
- [ ] Webhook idempotency verified (duplicate webhooks not double-charging)

**Check-in & Queue:**
- [ ] Admin check-in: kode validation, queue number generation
- [ ] Queue status API: returns current + waiting patients in FIFO order
- [ ] Walk-in: create temp patient + check-in + queue

**EMR & Invoice:**
- [ ] EMR creation: doctor input, patient view (filtered), audit trail
- [ ] Auto-invoice: triggered on EMR completion, correct amount
- [ ] Payment marking: UNPAID → PAID (one-way), immutable

**Automation:**
- [ ] NO-SHOW detection: cron job marks unchecked bookings as NO_SHOW
- [ ] Recommendation #6 verified: every 5 minutes, no manual intervention

**Code Quality:**
- [ ] 50+ integration tests passing
- [ ] >70% code coverage (backend logic)
- [ ] 0 TypeScript errors
- [ ] All 6 recommendations in place & tested

**Go/No-Go Decision:**
- If all criteria met: PROCEED TO PHASE 3 (Frontend)
- If criteria failed: ROOT CAUSE + FIX (add to Week 3-4 buffer)

#### 2.6 NEXT FILE HINT (50-100 lines)
```markdown
## 🔗 CONTINUATION: ROADMAP_PHASE_3_4_FRONTEND_MOBILE.md

After Phase 2 completion:

PREREQUISITES TO VERIFY:
✅ All backend APIs operational
✅ Midtrans payment integration working
✅ Queue management via Redis
✅ EMR & auto-invoice triggered correctly
✅ 70%+ test coverage

WHAT PHASE 3-4 COVERS (Weeks 5-8):
**PHASE 3 (Weeks 5-6): Frontend Web & Real-time**
- Next.js web app setup
- Admin dashboard (check-in, queue, EMR, invoices, stok, audit log)
- Doctor portal (queue, EMR input, patient list)
- Patient landing page (info, FAQ, doctors, location)
- TV queue display (real-time, per-doctor)
- WebSocket real-time updates (Recommendation #1)
- Polling fallback (if WS unavailable)
- E2E tests (Playwright)

**PHASE 4 (Weeks 7-8): Mobile & AI**
- Flutter Android setup
- Firebase + FCM integration
- Mobile screens (booking, payment, queue, EMR history)
- AI Chat widget (Gemini integration, FAQ lookup)
- APK build & signing
- Firebase App Distribution setup

KEY DELIVERABLE:
- Web UI fully functional on staging
- Mobile APK signed & ready
- Real-time queue updates via WebSocket + polling (Rec #1)
- E2E tests covering all critical paths

Starting Point:
- Open ROADMAP_PHASE_3_4_FRONTEND_MOBILE.md
- Review Week 5 tasks
- Ensure all Phase 2 exit criteria met
- Set up Next.js monorepo
```

---

# 📄 FILE 3: ROADMAP_PHASE_3_4_FRONTEND_MOBILE.md
## Weeks 5-8: Frontend Web, Mobile, Real-time & AI

**Target Token Count:** 12,000-14,000 tokens  
**Target Line Count:** 1,400-1,600 lines  
**Estimated Reading Time:** 15-20 minutes

### EXACT SECTIONS TO INCLUDE:

#### 3.1 PHASE 3-4 OVERVIEW (150-200 lines)
- Theme: "From API to UI - User-facing features"
- Phases: Phase 3 (Web), Phase 4 (Mobile + AI)
- Exit criteria: All UIs functional, E2E tests passing, APK signed
- Focus: WebSocket real-time (Recommendation #1), responsive design, PWA capabilities

#### 3.2 PHASE 3 WEEK 5 BREAKDOWN (300-400 lines)
**Theme:** "Frontend foundation & Admin Dashboard Part 1"

**Days 21-22 (Next.js Setup):**
- [ ] Task 3.1.1: Next.js 14+ App Router setup
  - Project structure: app/dashboard, app/doctor, app/patient, app/tv-display
  - Tailwind CSS configuration
  - Component library setup (shadcn/ui optional)
  - Reference: TDD Section 2 (Tech Stack - Next.js 14+)

- [ ] Task 3.1.2: Frontend folder structure
  - app/ (Next.js App Router)
  - components/ (reusable components)
  - lib/ (utilities, API clients, hooks)
  - styles/ (global + component styles)
  - public/ (static assets)

- [ ] Task 3.1.3: API client & hooks setup
  - Axios configured with base URL (backend)
  - useAuth hook (JWT token management)
  - useQueue hook (polling queue state)
  - useBranch hook (multi-tenant branch context)
  - Reference: HALAMAN Section 16 (Cross-cutting logic)

**Days 23-24 (Admin Dashboard - Queue & Check-in):**
- [ ] Task 3.1.4: Admin Queue Display
  - Dashboard /admin/queue
  - Show all doctors in branch with current queues
  - Per-doctor: current number (large), queue list (01, 02, 03...)
  - Real-time polling: GET /api/queues every 3 seconds
  - Button: "Call Next Patient" (POST /api/queues/{id}/call)
  - Button: "Mark Completed" (POST /api/queues/{id}/complete)
  - Reference: HALAMAN Section 12 (Queue Display)
  - Reference: LOGIC_FLOW Section 3 (Queue Management)

- [ ] Task 3.1.5: Admin Check-in Form
  - Dashboard /admin/check-in
  - Form: Booking code input (6-digit)
  - Validation: check-in button disabled until 6-digit entered
  - Submit: POST /api/admin/check-in
  - Success: Display queue number to admin
  - Error: Display error message (invalid code, session ended, etc)
  - Reference: HALAMAN Section 11 (Admin Check-in)
  - Reference: LOGIC_FLOW Section 2 (Check-in Flow)

**Day 25 (Admin Dashboard - EMR & Invoices):**
- [ ] Task 3.1.6: Admin EMR View
  - Dashboard /admin/emr
  - List encounters by date + patient
  - Filter: date range, status (DRAFT/COMPLETED), patient search
  - View details: read-only, cannot edit (doctor-only)
  - Reference: HALAMAN Section 13 (EMR Form)

- [ ] Task 3.1.7: Admin Invoice Management
  - Dashboard /admin/invoices
  - List unpaid invoices (default)
  - Filter: status (UNPAID/PAID), date range
  - Per invoice: patient, treatment, total, DP, treatment cost
  - Action: "Mark Paid" button → modal
  - Modal: nominal input, method (CASH/TRANSFER), notes
  - Submit: POST /api/admin/invoices/{id}/mark-paid
  - Reference: HALAMAN Section 14 (Invoice Management)
  - Reference: LOGIC_FLOW Section 7 (Payment Reconciliation)

#### 3.3 PHASE 3 WEEK 6 BREAKDOWN (300-400 lines)
**Theme:** "WebSocket Real-time, Doctor Portal, TV Display, E2E"

**Days 26-27 (WebSocket & Real-time - Recommendation #1):**
- [ ] Task 3.2.1: WebSocket connection setup
  - Frontend: connect to ws://backend/ws/queues?branch_id=A
  - On connect: subscribe to queue updates for branch
  - On message: update queue state in real-time (<100ms latency)
  - On disconnect: auto-reconnect with exponential backoff
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #1)
  - Reference: HALAMAN Section 15 (TV Queue Display real-time)

- [ ] Task 3.2.2: Polling fallback (if WebSocket unavailable)
  - If WS connection fails: fallback to polling
  - Poll: GET /api/queues every 2-3 seconds
  - Same data, just slower (still <3s latency)
  - Auto-switch back to WS if connection re-established
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #1)
  - Reference: HALAMAN Line 1648 (Polling 2-3s fallback)

- [ ] Task 3.2.3: Real-time queue UI component
  - Component: <QueueDisplay doctor={doctor} session={session} />
  - Display: current number (large, bold), queue list (smaller)
  - Color coding: current (red highlight), queue (blue)
  - Auto-update on WebSocket/polling message
  - No page refresh needed

**Days 28-29 (Doctor Portal & Landing Page):**
- [ ] Task 3.2.4: Doctor Portal
  - /doctor/queue: Queue view (same as admin, but doctor-only current patient)
  - /doctor/emr: EMR list (encounters), create/edit form
  - /doctor/patients: Patient list for current session + history
  - /doctor/invoices: View invoices (read-only, informational)
  - Reference: HALAMAN Section 10 (Doctor Portal)

- [ ] Task 3.2.5: Patient Landing Page
  - / (public)
  - Hero: "Klinik Gigi Terpercaya 3 Cabang"
  - Sections: Spesialisasi (8 cards), Dokter (24 with filter), Jadwal, Cabang, FAQ, Testimonial
  - Navigation: top navbar with "Booking Sekarang", "Download APK"
  - Reference: HALAMAN Section 1 (Landing Page)

- [ ] Task 3.2.6: Booking Page (Patient Flow)
  - /patient/booking
  - Form: Branch → Specialist → Date → Session
  - Display available slots (max 4 per session)
  - Show doctor info (name, specialist, rating)
  - Confirm: DP Rp 50.000 (bold warning: non-refundable)
  - Submit: POST /api/bookings → redirect to payment
  - Reference: HALAMAN Section 8 (Booking Pages)
  - Reference: LOGIC_FLOW Section 1 (Booking Creation)

**Day 30 (TV Queue Display & E2E Tests):**
- [ ] Task 3.2.7: TV Queue Display Page
  - /tv/queue-display (no auth required, IP-restricted)
  - Full-screen layout: all 8 doctors in branch
  - Per-doctor panel:
    * Name | Specialist | Current: 05 (red highlight)
    * Queue: 06, 07, 08, 09 (blue)
  - Real-time WebSocket updates
  - Auto-refresh if connection lost (polling fallback)
  - Kiosk mode (no URL bar, no navigation)
  - Reference: HALAMAN Section 15 (TV Queue Display)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #1)

- [ ] Task 3.2.8: E2E test scenarios (Playwright)
  - Scenario 1: Patient booking flow (landing → booking form → payment confirm)
  - Scenario 2: Admin check-in (queue display → input code → queue number shows)
  - Scenario 3: Doctor EMR (queue → call patient → EMR form → submit → invoice auto-generate)
  - Scenario 4: Real-time queue update (check-in → queue updates on TV display <1s)
  - Scenario 5: Walk-in (admin input walk-in → check-in → queue)
  - All 6 recommendations validated in E2E context
  - Reference: STP Section 3 (E2E Testing)

#### 3.4 PHASE 4 WEEK 7 BREAKDOWN (250-350 lines)
**Theme:** "Mobile App (Flutter) Setup & Core Features"

**Days 31-32 (Flutter Setup & Firebase):**
- [ ] Task 3.3.1: Flutter Android project setup
  - Flutter 3.x with Riverpod state management
  - Firebase integration (Firestore, Auth, Cloud Messaging)
  - Dio HTTP client with interceptors
  - Local storage: Hive for encrypted data
  - Reference: TDD Section 2 (Tech Stack - Flutter 3.x)

- [ ] Task 3.3.2: Firebase Cloud Messaging (FCM) integration
  - Get FCM token on app startup
  - Send to backend: POST /api/patient/fcm-token
  - Listen for push notifications
  - Handle notification: open app, navigate to relevant screen
  - Reference: HALAMAN Section 16 (Notifications - FCM)

**Days 33-34 (Mobile UI Screens):**
- [ ] Task 3.3.3: Mobile Booking Flow
  - Screen 1: Login/Register (email, password)
  - Screen 2: Booking form (branch, specialist, date, session)
  - Screen 3: Payment (Midtrans integration, redirect to payment page)
  - Screen 4: Confirmation (booking code, doctor, session time, check-in instructions)
  - Reference: HALAMAN Section 8-9 (Booking Pages adapted for mobile)

- [ ] Task 3.3.4: Mobile Queue & Check-in Info
  - Screen: Queue view (current doctor, current number, queue list)
  - Real-time updates via Firebase (or polling fallback)
  - Check-in info: "Silakan datang ke admin untuk check-in" + booking code
  - Reference: HALAMAN Section 12 (Queue Display, mobile view)

- [ ] Task 3.3.5: Mobile EMR History
  - Screen: EMR list (all past encounters)
  - Tap encounter: view details (complaints, treatments, prescriptions - filtered)
  - Read-only (doctor creates, patient views)
  - Reference: HALAMAN Section 13 (EMR - Patient view)

**Day 35 (APK Build & Testing):**
- [ ] Task 3.3.6: Flutter app testing
  - Unit tests: authentication logic, data models
  - Widget tests: UI components render correctly
  - Integration tests: booking flow start-to-finish
  - Target: 50%+ test coverage for mobile logic

- [ ] Task 3.3.7: APK build & signing
  - Generate signing key
  - Build release APK: `flutter build apk --release`
  - File: app-release.apk (ready for distribution)
  - Reference: PRD Line 41 (Mobile APK distribution)

#### 3.5 PHASE 4 WEEK 8 BREAKDOWN (250-350 lines)
**Theme:** "AI Chat, App Distribution, Polish & Bug Fixes"

**Days 36-37 (AI Chat Implementation):**
- [ ] Task 3.4.1: AI Chat widget (landing page)
  - Component: Chat interface (messages, input field)
  - Integration: Gemini API (free tier, 60 req/min)
  - Hardcoded FAQ: 20-30 questions (JSON structure)
  - Flow:
    1. User sends message
    2. Check if matches FAQ (fuzzy search)
    3. If match: return FAQ answer + Gemini enhancement
    4. If no match: send to Gemini with context
    5. Display response in chat
  - Escalation: medical questions → "Contact admin"
  - Reference: PRD Section 14 (AI Features - Smart Chat)
  - Reference: HALAMAN Section 2 (AI Chat Widget)

- [ ] Task 3.4.2: AI Chat specialist recommendation
  - Example: User says "Saya ingin scaling"
  - AI responds: "Scaling adalah... Spesialis: Dr. Perio. Jadwal tersedia: [3 options]. Ingin booking?"
  - Link to booking page pre-filled with specialist
  - Reference: PRD Section 14 (Intelligent routing)

**Days 38-39 (App Distribution & Polish):**
- [ ] Task 3.4.3: Firebase App Distribution
  - Setup Firebase project
  - Create release group for testers
  - Upload APK to Firebase App Distribution
  - Share download link for internal QA testing
  - Reference: PRD Line 41 (APK distribution)

- [ ] Task 3.4.4: Mobile app testing & bug fixes
  - Test on real devices (if available) or emulators
  - Bug triage: critical (blocking demo), high (next release), low (future)
  - Fix critical bugs in Week 8
  - Reference: STP Section 2.3 (Platform & Environment Scope - Android)

**Day 40 (Phase 3-4 Completion & Testing):**
- [ ] Task 3.4.5: Full system integration test (Web + Mobile)
  - Scenario: Patient books on mobile → Payment confirmed → Admin check-in on web → Queue shows on TV → Doctor calls on web
  - All real-time updates working (WebSocket + polling)
  - All 6 recommendations integrated & working
  - Reference: STP Section 3 (E2E Testing)

- [ ] Task 3.4.6: Performance testing
  - Web: Lighthouse score >80 (mobile)
  - API response times: p95 <200ms (TDD metric)
  - Queue update latency: <2s (WebSocket), <3s (polling)
  - Reference: STP Section 2 (Success Metrics)

#### 3.6 KEY DELIVERABLES - PHASE 3-4 (50-100 lines)
- ✅ Next.js web app - fully functional
- ✅ Admin dashboard - all sections working (queue, check-in, EMR, invoice, stok, audit log)
- ✅ Doctor portal - queue, EMR input/edit, patient list
- ✅ Patient landing page - all sections (services, doctors, locations, FAQ)
- ✅ WebSocket real-time queue updates (Recommendation #1)
- ✅ Polling fallback (2-3s) when WebSocket unavailable
- ✅ TV queue display - real-time, per-doctor, auto-delete
- ✅ Flutter Android app - all screens functional
- ✅ Firebase + FCM integration - push notifications working
- ✅ AI Chat widget - Gemini integration, FAQ lookup, specialist routing
- ✅ APK built, signed, uploaded to Firebase App Distribution
- ✅ E2E tests - all critical paths covered
- ✅ Performance validated - API <200ms, queue updates <2s

#### 3.7 PHASE 3-4 EXIT CRITERIA (50-100 lines)
**Web Frontend:**
- [ ] Admin dashboard: queue, check-in, EMR, invoices all functional
- [ ] Doctor portal: EMR input, queue display, patient list
- [ ] Patient landing page: booking form → payment confirmation works
- [ ] Real-time: WebSocket updates reflect queue changes <100ms

**Mobile Frontend:**
- [ ] Booking flow: select specialist → payment → confirmation
- [ ] Queue view: real-time updates via Firebase/polling
- [ ] EMR history: view past encounters (read-only)
- [ ] App signed & APK ready for distribution

**Real-time (Recommendation #1):**
- [ ] WebSocket: connects, subscribes, receives queue updates
- [ ] Polling fallback: activates if WS unavailable, <3s refresh
- [ ] Auto-recovery: reconnects to WS when available

**AI Chat:**
- [ ] Gemini API integrated & responding
- [ ] FAQ matches working
- [ ] Specialist routing: links to booking page
- [ ] Escalation: urgent questions → admin contact

**Code Quality:**
- [ ] E2E tests: 5+ scenarios, all passing
- [ ] Performance: p95 <200ms (API), <2s (queue updates)
- [ ] 0 critical bugs
- [ ] TypeScript: 0 errors

**Go/No-Go Decision:**
- If all criteria met: PROCEED TO PHASE 5 (Testing & Demo)
- If criteria failed: ROOT CAUSE + FIX (add to Week 5-8 buffer)

#### 3.8 NEXT FILE HINT (50-100 lines)
```markdown
## 🔗 CONTINUATION: ROADMAP_PHASE_5_MASTERY.md

After Phase 3-4 completion:

PREREQUISITES TO VERIFY:
✅ Web app deployed to staging (Vercel)
✅ Mobile APK signed & uploaded to Firebase
✅ All WebSocket + polling real-time working
✅ E2E tests passing (5+ scenarios)
✅ AI Chat integrated

WHAT PHASE 5 COVERS (Week 9):
- System integration testing (all features working together)
- Performance testing (load tests, stress tests)
- Security audit (OWASP Top 10)
- All 6 recommendations final validation
- Demo script & walkthrough (30+ minutes)
- Production deployment preparation
- Documentation completion
- Portfolio presentation guide

KEY DELIVERABLES:
- Production deployment guide (step-by-step)
- Demo script + talking points (for recruiter demo)
- All 6 recommendations validated in production
- 100% documentation complete
- GitHub repo public, clean history

Starting Point:
- Open ROADMAP_PHASE_5_MASTERY.md
- Review Week 9 tasks
- Ensure all Phase 3-4 exit criteria met
- Prepare for final system testing
```

---

# 📄 FILE 4: ROADMAP_PHASE_5_MASTERY.md
## Week 9: Testing, Demo Preparation, Deployment & Portfolio Mastery

**Target Token Count:** 10,000-12,000 tokens  
**Target Line Count:** 1,200-1,400 lines  
**Estimated Reading Time:** 15-20 minutes

### EXACT SECTIONS TO INCLUDE:

#### 4.1 PHASE 5 OVERVIEW (100-150 lines)
- Theme: "From Staging to Production - The Final Sprint"
- Objectives: System testing, demo preparation, production readiness
- Reference: PRD Section 12 (Pre-Release Checklist)
- Reference: STP (Testing Strategy)

#### 4.2 WEEK 9 DETAILED BREAKDOWN (400-500 lines)
**Theme:** "Integration Testing, Demo Prep, Deployment Finalization"

**Days 41-42 (System Integration Testing):**
- [ ] Task 4.1.1: End-to-end scenario testing
  - Scenario 1: Full patient journey (register → book → pay → check-in → EMR → invoice)
  - Scenario 2: Walk-in journey (admin creates → check-in → queue → EMR → invoice)
  - Scenario 3: NO-SHOW journey (booking → not checked-in → cron marks NO_SHOW → invoice AUTO_CLOSED)
  - Scenario 4: Real-time queue (check-in → WebSocket updates → TV display shows <1s → admin calls → completed)
  - Scenario 5: Multi-branch isolation (Branch A data ≠ Branch B data, row-level security)
  - Scenario 6: All 6 recommendations integrated (test each in context)
  - Reference: STP Section 3 (E2E Testing)

- [ ] Task 4.1.2: Load testing
  - Tool: k6 or Locust
  - Simulate: 50 concurrent users booking + checking in
  - Measure: API response time (p95 <200ms), queue latency (<2s)
  - Identify bottlenecks (if any)
  - Reference: TDD Section 1 (Success Metrics)

- [ ] Task 4.1.3: Database integrity testing
  - Test: Constraints enforced (booking max 4 per session, invoice one-way state)
  - Test: Multi-tenant isolation (WHERE branch_id filter never fails)
  - Test: Audit log immutability (no UPDATE/DELETE on audit_logs table)
  - Reference: DRP (Data Protection)

**Days 43-44 (Security Audit):**
- [ ] Task 4.1.4: OWASP Top 10 validation
  - #1 Injection: SQL injection tests (all queries parameterized?)
  - #2 Authentication: JWT token validation, password security
  - #3 Sensitive Data: Sensitive data not logged, HTTPS enforced
  - #4 XML External Entity: N/A (not applicable)
  - #5 Broken Access Control: Role-based access (PATIENT, ADMIN, DOCTOR)
  - #6 Security Misconfiguration: CORS headers, security headers (Helmet)
  - #7 XSS: Input sanitization (Zod schemas)
  - #8 Insecure Deserialization: N/A (REST APIs)
  - #9 Components with Known Vulnerabilities: npm audit, dependency updates
  - #10 Insufficient Logging & Monitoring: Audit logs, Sentry integration
  - Reference: TDD Section 8 (Security & Authentication)

- [ ] Task 4.1.5: Payment security validation
  - Webhook signature verification: Test invalid signatures rejected
  - Idempotency: Test duplicate webhooks handled correctly
  - Midtrans sandbox: Test full payment flow
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #2)

**Days 45-46 (All 6 Recommendations Final Validation):**
- [ ] Task 4.1.6: Recommendation #1 - TV Display Real-time
  - Test WebSocket: Queue updates <100ms
  - Test polling fallback: Activated when WS fails, <3s refresh
  - Test auto-recovery: Reconnects to WS when available
  - Test TV display: Shows correct numbers, auto-deletes completed
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #1)

- [ ] Task 4.1.7: Recommendation #2 - Webhook Retry
  - Test signature validation: Invalid signatures rejected (403)
  - Test idempotency: Duplicate webhooks not double-charging
  - Test retry logic: Failed updates retry 3x with backoff
  - Test error tracking: Failed webhooks logged to Sentry
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #2)

- [ ] Task 4.1.8: Recommendation #3 - Invoice Payment State
  - Test state machine: UNPAID → PAID (one-way)
  - Test constraint: Cannot revert PAID → UNPAID
  - Test immutability: invoice_payments records not updatable
  - Test atomicity: EMR complete + invoice create happen together
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #3)

- [ ] Task 4.1.9: Recommendation #4 - Queue Number Uniqueness
  - Test composite key: (doctor_id, session_id, date, queue_number) unique
  - Test per-session reset: Next day queue starts at 01 again
  - Test display format: Only shows queue_number (01, 02), not doctor_id
  - Test FIFO: Queue ordered by checked_in_at timestamp
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #4)

- [ ] Task 4.1.10: Recommendation #5 - Walk-in Patient Profile
  - Test temp profile: is_walk_in=true, no password, cannot login
  - Test check-in: Walk-in → queue number generated
  - Test EMR: Created normally, linked to temp patient
  - Test future linking: Patient can register + claim history (documented for V2)
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #5)

- [ ] Task 4.1.11: Recommendation #6 - NO-SHOW Automation
  - Test cron timing: Runs every 5 minutes (not more, not less)
  - Test detection: Unchecked bookings for past sessions marked NO_SHOW
  - Test atomicity: Status update + invoice close happen together
  - Test audit: NOSHOW_DETECTED events logged correctly
  - Test idempotency: Running cron twice doesn't double-mark
  - Reference: TECHNICAL_RECOMMENDATIONS.md (Issue #6)

**Days 47-48 (Demo Preparation):**
- [ ] Task 4.1.12: Demo scenario setup
  - Create seed data: 3 branches, 24 doctors, 10 test patients
  - Create test account: email: demo@dentflow.io, password: DemoPass123
  - Pre-load dummy bookings: some checked-in, some pending, some completed
  - Pre-load invoices: some UNPAID, some PAID (for reconciliation demo)
  - Reference: PRD Section 12 (Demo preparation)

- [ ] Task 4.1.13: Demo script & talking points (30+ minutes)
  - Segment 1 (5 min): Landing page, doctor search, specialist info
  - Segment 2 (5 min): Booking flow (patient books, sees confirmation)
  - Segment 3 (5 min): Payment flow (Midtrans sandbox payment)
  - Segment 4 (5 min): Admin check-in (show queue update real-time)
  - Segment 5 (5 min): Queue management (doctor calls patient, TV display updates)
  - Segment 6 (5 min): EMR creation (doctor input EMR, auto-invoice generated)
  - Segment 7 (5 min): Invoice management (admin marks paid, CSV export)
  - Segment 8 (5 min): Walk-in flow (admin creates walk-in, check-in, queue)
  - Bonus (5 min): Audit log review, multi-branch isolation, all 6 recommendations explained
  - Reference: PRD Section 12 (Demo scenario)

- [ ] Task 4.1.14: Demo credentials & walkthrough doc
  - Create DEMO_WALKTHROUGH.md
  - Include: URLs, login credentials, demo data IDs
  - Include: Step-by-step walkthrough with screenshots (Playwright can capture)
  - Include: Talking points for each feature
  - Include: "Known Limitations" section (V1 vs V2+)
  - Include: "All 6 Recommendations" explained + validated

**Day 49 (Production Deployment Preparation):**
- [ ] Task 4.1.15: Production deployment checklist
  - Database: PostgreSQL production instance (Render.com or Railway.app)
  - Migrations: Tested & ready to run
  - Environment: Production secrets (.env.production)
  - Backend: Deployed to Render.com / Railway.app
  - Frontend: Deployed to Vercel
  - Mobile: APK uploaded to Google Play (or Firebase App Distribution for portfolio)
  - SSL: HTTPS certificate configured
  - Smoke tests: Basic CRUD operations working in production
  - Reference: PRD Section 12 (Deployment day)

- [ ] Task 4.1.16: Documentation completion
  - README.md: Comprehensive (installation, setup, features, screenshots)
  - API_DOCUMENTATION.md: All endpoints documented (from TDD Section 5)
  - ARCHITECTURE.md: System design, Modulith pattern, dependencies
  - DEPLOYMENT.md: Step-by-step deployment guide for recruiter
  - RECOMMENDATIONS.md: All 6 recommendations explained + validated
  - VIDEO_SCRIPT.md: 3-5 minute video walkthrough script
  - Reference: PRD Section 12 (Documentation finalized)

**Day 50 (Final Testing & Go-Live):**
- [ ] Task 4.1.17: Final smoke tests
  - Test 1: Can register patient account
  - Test 2: Can book appointment
  - Test 3: Can login as admin & check-in
  - Test 4: Can login as doctor & create EMR
  - Test 5: Queue updates in real-time (<2s)
  - Test 6: All 6 recommendations working
  - Reference: PRD Section 12 (Smoke tests run)

- [ ] Task 4.1.18: Production go-live
  - Deploy backend to production
  - Deploy frontend to production (Vercel)
  - Verify all URLs working
  - Enable monitoring (Sentry, Pino logging)
  - Document go-live time + any incidents
  - Reference: DRP (Production readiness)

#### 4.3 ALL 6 RECOMMENDATIONS - FINAL MASTERY GUIDE (300-400 lines)
**Comprehensive explanation + validation for portfolio:**

**Recommendation #1: TV Display Real-time (WebSocket + Polling Fallback)**
- What it solves: Real-time queue updates without manual refresh
- Implementation: WebSocket primary, polling 2-3s fallback
- Technical highlights:
  * WebSocket connection: /ws/queues?branch_id=X
  * Message format: { current_calling, waiting_queue, updated_at }
  * Fallback polling: GET /api/queues every 2-3 seconds
  * Auto-recovery: Reconnects to WS when available
- Validation in demo: Check-in → see queue update on TV <1s
- Production guarantee: Queue updates <2s (WS) or <3s (polling)
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #1) - full implementation

**Recommendation #2: Webhook Retry (Idempotent + 3 Retries)**
- What it solves: Payment confirmation robustness, no double-charging
- Implementation: Signature validation → idempotency check → retry logic
- Technical highlights:
  * Signature validation: HMAC-SHA512 against Midtrans server_key
  * Idempotency tracking: payment_webhooks table (unique order_id)
  * Retry strategy: 3 attempts (0s, 5s, 25s exponential backoff)
  * Error logging: Sentry + payment_webhook_errors table
- Validation in demo: Simulate duplicate webhooks, verify no double-charge
- Production guarantee: Payment confirmation success rate >99%
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #2) - full TypeScript

**Recommendation #3: Invoice Payment State Machine (UNPAID → PAID, One-way)**
- What it solves: Financial integrity, prevent accidental payment reversals
- Implementation: Database constraint + app logic validation
- Technical highlights:
  * Database: CHECK constraint (UNPAID + PAID + null rules)
  * State machine: UNPAID → PAID (immutable, no revert)
  * Atomic transaction: EMR complete + invoice create together
  * Audit trail: invoice_payments append-only (no UPDATE/DELETE)
- Validation in demo: Show invoice PAID, attempt to mark UNPAID (error)
- Production guarantee: No financial data loss, complete audit trail
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #3) - SQL + TypeScript

**Recommendation #4: Queue Number Uniqueness (Per-session Per-doctor)**
- What it solves: Clear queue management per treatment provider
- Implementation: Redis atomic counter with composite key
- Technical highlights:
  * Redis key: queue:{branch}:{doctor}:{session}:{date}
  * Atomic increment: INCR (thread-safe, no race conditions)
  * Composite uniqueness: (doctor_id, session_id, date, queue_number)
  * Display format: Only queue_number (01, 02), not doctor_id
  * FIFO ordering: By checked_in_at timestamp
- Validation in demo: Multiple patients check-in, queue numbers increment correctly
- Production guarantee: No duplicate queue numbers per session
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #4) - Redis strategy

**Recommendation #5: Walk-in Patient Profile (Admin Creates Temp)**
- What it solves: Support for unplanned clinic visitors without pre-registration
- Implementation: Temporary patient record (no password, is_walk_in=true)
- Technical highlights:
  * Temp patient: name, phone (optional), no password (cannot login)
  * Registration type: walk_in (vs online)
  * Check-in: Same as booking (generates queue number)
  * EMR: Created normally, linked to temp patient
  * Future: V2 can allow patient to register & claim history
- Validation in demo: Create walk-in → check-in → see in queue → create EMR
- Production guarantee: Flexible clinic workflow (online + walk-in)
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #5) - full flow

**Recommendation #6: NO-SHOW Automation (Cron Job Every 5 Minutes)**
- What it solves: Automatic DP forfeiture for no-shows, no manual admin work
- Implementation: Node-cron job + database query + atomic update
- Technical highlights:
  * Cron schedule: `*/5 * * * *` (every 5 minutes)
  * Query: Find sessions ended >5min ago, unchecked bookings
  * Atomic update: Status to NO_SHOW + invoice AUTO_CLOSED together
  * Audit: NOSHOW_DETECTED event logged with details
  * Idempotent: Won't mark twice (check status before update)
  * Notification: FCM + email sent (async, non-blocking)
- Validation in demo: Create past session, unchecked booking, run cron
- Production guarantee: Automatic NO-SHOW detection, no revenue loss
- Reference code: TECHNICAL_RECOMMENDATIONS.md (Issue #6) - TypeScript implementation

#### 4.4 RISK MITIGATION MATRIX (200-300 lines)
**15+ Risk Scenarios + Solutions:**

| Risk | Severity | Probability | Mitigation | Contingency |
|------|----------|-------------|------------|-------------|
| Midtrans sandbox down | HIGH | MEDIUM | Test locally with mock | Accept manual payment input (Phase 2 solution) |
| Database query timeout | HIGH | MEDIUM | Add indices, optimize queries | Implement caching layer (Redis) |
| WebSocket server crash | MEDIUM | LOW | Auto-restart, health checks | Fallback to polling (already implemented) |
| Payment webhook delay >30s | MEDIUM | LOW | Implement retry logic (Rec #2) | Manual webhook replay (admin tool) |
| Patient books 2x simultaneously | HIGH | MEDIUM | Optimistic locking + audit | Refund duplicate booking (support) |
| Multi-branch data leak | CRITICAL | LOW | Row-level security filters | Audit log review, potential compliance issue |
| Doctor marks EMR completed 2x | MEDIUM | LOW | Idempotency check | No-op (already COMPLETED, no new invoice) |
| Admin marks invoice paid 2x | LOW | LOW | State machine (Rec #3) | Error message, no double-charging |
| Walk-in create fails silently | MEDIUM | MEDIUM | Validation + error logging | Admin creates patient manually (fallback) |
| Queue number collision | LOW | VERY LOW | Redis INCR (atomic) | Manual queue reset (rare) |
| TV display WebSocket stuck | MEDIUM | MEDIUM | Auto-reconnect, polling fallback | Manual page refresh |
| NO-SHOW cron misses session | LOW | LOW | Logging + monitoring | Manual NO-SHOW marking (admin tool) |
| API rate limiting blocks legitimate traffic | MEDIUM | MEDIUM | Monitor + adjust limits | Whitelist critical paths (admin, payment) |
| Git history has secrets | CRITICAL | LOW | .gitignore + secret scanning | Git filter-branch to remove (immediate) |
| Demo crashes during recruiter call | HIGH | HIGH | Offline demo mode + backup staging | Re-schedule, provide video recording |

#### 4.5 GO/NO-GO DECISION MATRIX (100-150 lines)
**Phase 1-5 Go/No-Go Criteria Summarized:**

**Phase 1 (Weeks 1-2):**
- ✅ Backend infrastructure: Docker, DB, Redis, auth
- ✅ 15+ integration tests passing
- Go: PROCEED TO PHASE 2 | No-Go: FIX BUGS, RETRY WEEK 1-2

**Phase 2 (Weeks 3-4):**
- ✅ All APIs working: booking, payment, check-in, queue, EMR, invoice
- ✅ Webhook idempotency verified
- ✅ 70%+ code coverage
- Go: PROCEED TO PHASE 3 | No-Go: FIX BUGS, RETRY WEEK 3-4

**Phase 3-4 (Weeks 5-8):**
- ✅ Web & mobile UIs functional
- ✅ WebSocket + polling real-time working
- ✅ E2E tests passing
- ✅ APK signed & ready
- Go: PROCEED TO PHASE 5 | No-Go: FIX BUGS, RETRY WEEK 5-8

**Phase 5 (Week 9):**
- ✅ All 9 weeks documented
- ✅ All 6 recommendations validated
- ✅ Security audit passed (OWASP Top 10)
- ✅ Demo script & walkthrough complete
- ✅ Production deployment ready
- Go: SHIP TO PRODUCTION + PORTFOLIO | No-Go: FIX BLOCKERS

#### 4.6 PORTFOLIO PRESENTATION GUIDE (200-300 lines)
**For international recruiters reviewing DentFlow:**

**Story Arc (3-5 minutes):**
1. **Problem**: 3 dental clinics, 24 doctors, manual queue management, no EMR, chaos
2. **Solution**: DentFlow - modular monolith clinic management system
3. **Architecture**: 5-layer architecture (frontend, API, services, repos, database)
4. **Highlights**:
   - Multi-tenant isolation (3 branches, complete data separation)
   - Payment gateway integration (Midtrans + webhook idempotency)
   - Real-time queue management (WebSocket + polling fallback)
   - Electronic medical records with auto-invoicing
   - 6 strategic recommendations integrated & validated
   - Production-ready code (>70% tests, clean architecture)
5. **Results**: 9-week MVP, portfolio-grade implementation

**Technical Highlights (Use Case for Each):**
- **Modulith Pattern**: Demonstrates system design thinking without over-engineering (no microservices complexity)
- **Multi-tenant Isolation**: Row-level security, hard problem solved elegantly
- **Payment Integration**: Full webhook flow with idempotency (Recommendation #2)
- **Real-time Features**: WebSocket + polling fallback (Recommendation #1)
- **Database Constraints**: Invoice payment state machine (Recommendation #3)
- **Automation**: NO-SHOW cron job (Recommendation #6)
- **Testing**: 70%+ coverage, all critical paths tested
- **Documentation**: TDD, DRP, STP - professional engineering practices

**Recommendation Talking Points:**
- "These 6 recommendations ensure production robustness:"
  1. TV Display real-time: User experience excellence
  2. Webhook retry: Payment reliability (critical)
  3. Invoice state: Financial integrity (non-negotiable)
  4. Queue uniqueness: System correctness (database design)
  5. Walk-in profiles: Operational flexibility (real-world requirement)
  6. NO-SHOW automation: Business process automation

**Weaknesses to Address (Transparency):**
- V1 scope: Single-region, local deployment, Indonesian-only
- Mobile: Android only (V2 adds iOS)
- Payment: Sandbox only (production key needed for real money)
- Analytics: Not included in V1 (V2 feature)
- Geolocation: No location-based scheduling (V2)

#### 4.7 DOCUMENTATION CHECKLIST (100-150 lines)
**All deliverables for portfolio:**

- [ ] README.md (comprehensive installation + features + screenshots)
- [ ] API_DOCUMENTATION.md (all 50+ endpoints from TDD Section 5)
- [ ] ARCHITECTURE.md (Modulith pattern, 5-layer design, flow diagrams)
- [ ] DATABASE.md (11 tables, ERD, constraints, indices)
- [ ] DEPLOYMENT.md (step-by-step: local → staging → production)
- [ ] TDD.md (already locked, just reference)
- [ ] RECOMMENDATIONS.md (6 strategic decisions + validation)
- [ ] SECURITY.md (JWT, bcrypt, HTTPS, rate limiting, OWASP)
- [ ] VIDEO_SCRIPT.md (3-5 minute walkthrough + talking points)
- [ ] CHANGELOG.md (9 weeks, what shipped each phase)
- [ ] TESTING.md (test coverage, how to run tests, E2E scenarios)
- [ ] TROUBLESHOOTING.md (common issues + solutions)

#### 4.8 PHASE 5 COMPLETION & RECAP (150-200 lines)
**What success looks like:**

- ✅ System production-ready (all 9 weeks of work deployed)
- ✅ All 6 recommendations validated in production
- ✅ Demo script rehearsed & ready (30+ min walkthrough)
- ✅ GitHub repo public (clean history, 100+ commits)
- ✅ Documentation complete (10+ professional docs)
- ✅ Video walkthrough recorded (3-5 min)
- ✅ Portfolio presentation refined (talking points, weaknesses addressed)
- ✅ APK signed & distributed (Firebase App Distribution)
- ✅ Zero critical bugs (all issues triaged & documented)
- ✅ Security audit passed (OWASP Top 10)
- ✅ Performance validated (API p95 <200ms, queue <2s)
- ✅ 70%+ test coverage (unit + integration + E2E)

**Next career move (post-portfolio):**
- Apply to remote positions (SE, AI Engineer, full-stack)
- Mention: "9-week portfolio project, production-ready, 70%+ tests, 6 strategic recommendations"
- Link: DentFlow GitHub repo + video demo
- Discuss: Architecture decisions, trade-offs, production considerations
- Target: $150k+ remote roles (based on portfolio quality)

#### 4.9 FINAL MASTER BLUEPRINT SUMMARY (100-150 lines)
```
DENTFLOW 4-ROADMAP STRUCTURE - LOCKED & READY

FILE 1: ROADMAP_PHASE_1_FOUNDATION.md (Weeks 1-2)
- ~1,000-1,200 lines
- 8,000-10,000 tokens
- Focus: Infrastructure, auth, database, foundations of all 6 recommendations
- Exit: Backend infrastructure ready, 15+ tests passing

FILE 2: ROADMAP_PHASE_2_BACKEND_CORE.md (Weeks 3-4)
- ~1,000-1,200 lines
- 8,000-10,000 tokens
- Focus: All business logic APIs, payment, queue, EMR, invoice, all 6 recommendations
- Exit: All APIs working, 70%+ coverage, webhook verified

FILE 3: ROADMAP_PHASE_3_4_FRONTEND_MOBILE.md (Weeks 5-8)
- ~1,400-1,600 lines
- 12,000-14,000 tokens
- Focus: Web UI, mobile app, real-time (Rec #1), AI chat, E2E tests
- Exit: All UIs functional, APK signed, E2E passing

FILE 4: ROADMAP_PHASE_5_MASTERY.md (Week 9 + Integration + Deployment)
- ~1,200-1,400 lines
- 10,000-12,000 tokens
- Focus: Testing, all 6 recommendations validation, demo prep, deployment, portfolio mastery
- Exit: Production ready, portfolio presentable, 9-week DentFlow complete

TOTAL: 4,200-5,200 lines | 38,000-46,000 tokens | VERY SAFE
RISK: <5% chance of hitting token limit | LOCKED ACUAN
```

---

# 📋 CROSS-FILE CONTINUITY STRATEGY

### File 1 → File 2 Transition
**End of File 1 Hint:**
- What's complete: Infrastructure, auth, foundations ready
- What's next: All business logic (booking, payment, queue, EMR)
- Prerequisites: All Phase 1 exit criteria met
- Starting point: Week 3 (Day 6), same project environment

**File 2 Expects:**
- Docker running (from Phase 1)
- Database schema migrated (from Phase 1)
- JWT auth working (from Phase 1)
- All foundational services set up (from Phase 1)

### File 2 → File 3 Transition
**End of File 2 Hint:**
- What's complete: All backend APIs, 70%+ coverage, webhooks verified
- What's next: Frontend web, mobile app, real-time
- Prerequisites: All Phase 2 exit criteria met
- Starting point: Week 5 (Day 21), Next.js setup begins

**File 3 Expects:**
- Backend fully deployed to staging
- All APIs documented & working
- Webhook integration proven
- 70%+ test coverage baseline

### File 3 → File 4 Transition
**End of File 3 Hint:**
- What's complete: Web UI + mobile app, real-time working, E2E passing
- What's next: Final testing, all 6 recommendations validation, demo, deployment
- Prerequisites: All Phase 3-4 exit criteria met
- Starting point: Week 9 (Day 41), system integration testing

**File 4 Expects:**
- Web app deployed to staging (Vercel)
- Mobile APK signed & uploaded
- E2E tests passing
- All real-time features working

### End of File 4
**DENTFLOW v1.0 COMPLETE - PRODUCTION READY** ✅

---

# 📊 RECOMMENDATION MAPPING MATRIX

**How all 6 recommendations map across files:**

| Rec | File 1 | File 2 | File 3 | File 4 |
|-----|--------|--------|--------|--------|
| #1 - TV Display | Foundation (WS setup) | - | Full impl (WS+polling) | Validation |
| #2 - Webhook Retry | Idempotency setup | Full impl (3 retry) | Integration | Validation |
| #3 - Invoice State | Database constraint | Full impl (state machine) | UI display | Validation |
| #4 - Queue Numbers | - | Full impl (Redis counter) | UI display | Validation |
| #5 - Walk-in | - | Full impl (temp profile) | Mobile flow | Validation |
| #6 - NO-SHOW | Cron framework | Full impl (job logic) | - | Validation |

**Each recommendation:**
- Introduced in File 1-2 (foundation + implementation)
- Integrated in File 3 (UI + user experience)
- Validated in File 4 (testing + production guarantee)

---

# 🎯 GENERATION INSTRUCTIONS (For AI)

**CRITICAL RULES FOR EACH FILE GENERATION:**

1. **Stay within token budget:** Each file has explicit token target (8k-14k)
2. **No hallucination:** Follow sections EXACTLY as specified above
3. **Complete all tasks:** Don't skip tasks, include all checkboxes
4. **Code examples:** Include TypeScript/SQL code snippets where specified
5. **References:** Always link back to PRD/LOGIC_FLOW/HALAMAN/TDD/DRP/STP
6. **Exit criteria:** End each file with clear go/no-go decision matrix
7. **Continuity clue:** End each file with detailed hint/clue for next file
8. **Line count target:** Each file should hit estimated line range (±100 lines OK)

**Per-file checklist before submitting:**
- [ ] All sections from spec included
- [ ] Token count within range
- [ ] Line count within range
- [ ] All 15+ tasks per week included (with checkboxes)
- [ ] Code examples included where specified
- [ ] References to PRD/LOGIC_FLOW/HALAMAN/TDD/DRP/STP included
- [ ] Exit criteria clear
- [ ] Continuity clue to next file provided
- [ ] No hallucinatory content outside spec

---

# ✅ MASTER BLUEPRINT STATUS

**Status:** LOCKED & APPROVED ✅  
**Purpose:** ACUAN lengkap untuk 4-file generation tanpa halusinasi  
**Token Budget:** 38,000-46,000 (very safe margin)  
**Risk Level:** <5% chance of exceeding limits  
**Recommendation:** Proceed with generation File 1 → File 2 → File 3 → File 4 in sequence  

**Next Action:** Start generation of ROADMAP_PHASE_1_FOUNDATION.md using File 1 spec above

---

**END OF MASTER BLUEPRINT**

*This document is the reference frame for all 4 ROADMAP files. Do not deviate from this structure. Use this to generate with 100% focus and zero hallucination.*
