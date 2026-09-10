# Software Test Plan (STP) - DENTFLOW v10.0
## Sistem Manajemen Klinik Gigi Multi-Cabang (Modular Monolith)

> **Purpose**: Dokumen ini mendefinisikan strategi testing komprehensif, scope, execution plan, automation, dan quality criteria untuk release DentFlow v10.0 MVP dengan target 9-9.5/10 rating untuk portfolio internasional.

> **Audience**: Solo developers, QA engineers, recruiters

> **Version**: 1.0 - Final

---

## 1. DOCUMENT METADATA & OVERVIEW

### 1.1 Project Information
- **Project Name**: DentFlow
- **Project Acronym**: DF
- **Release Version**: 1.0 (MVP - Modular Monolith)
- **Release Target Date**: 2026-08-30 (9 weeks from start)
- **STP Owner**: Solo Developer / QA Engineer
- **Last Updated**: 2026-07-10
- **Next Review**: 2026-07-20 (midpoint review)
- **Status**: Active (In Development)

### 1.2 Document Purpose

Dokumen ini menjelaskan bagaimana testing akan dilakukan untuk DentFlow v1.0 release, mencakup:

- **Scope Testing**: Fitur yang di-test (payment gateway, booking, queue, EMR, invoice, multi-tenant), platform yang didukung (Web, Mobile, TV Display)
- **Strategi Testing**: Level test (Unit, Integration, API Contract, E2E, Non-Functional), jenis test (Happy path, Error scenarios, Edge cases), tools & frameworks
- **Execution Plan**: Timeline (9 minggu), resource (1 developer), triggers (per feature completion)
- **Quality Criteria**: P0 features 100% coverage, P1 features 80%+ coverage, payment success rate >99%, queue latency <2 detik, API response p95 <200ms
- **Automation & Regression**: CI/CD integration, test suites automated, pre-release regression testing
- **Bug Tracking & Resolution**: Severity levels, assignment, SLA
- **Test Reporting & Metrics**: Coverage reports, metrics dashboard, sign-off criteria

### 1.3 Related Documents

- [x] **PRD (Product Requirements Document)**: PRD.txt v10.0 (Final, Approved for Development)
  - Contains: Requirements, scope, MVP features, AI features, business logic, technical roadmap
  - Relationship: STP validates all PRD requirements through test cases
  
- [x] **TDD (Technical Design Document)**: TDD.md v10.0 (Final)
  - Contains: Technology stack, architecture, database schema, API contract, testing strategy outline
  - Relationship: STP provides detailed test execution for TDD specifications
  
- [x] **LOGIC_FLOW (Business Logic Documentation)**: LOGIC_FLOW.txt v10.0
  - Contains: Detailed sequence diagrams for payment, booking, check-in, queue, EMR, invoice flows
  - Relationship: STP test cases are derived from logic flow steps (validation, edge cases, error scenarios)
  
- [x] **HALAMAN (UI/UX Specification)**: HALAMAN.txt v10.0
  - Contains: Screen descriptions, components, user interactions, frontend logic flow
  - Relationship: STP includes UI/E2E tests for all critical user journeys defined in HALAMAN
  
- [x] **DRP (Disaster Recovery Plan)**: DRP.md v10.0
  - Contains: Recovery strategies, backup procedures, rollback plans, business continuity
  - Relationship: STP includes tests for recovery procedures (backup restore, data integrity verification)
  
- [x] **API Contract / Service Specification**: Embedded in TDD (Section 5)
  - Contains: Endpoint definitions, request/response schemas, error codes, HTTP status codes
  - Relationship: STP includes comprehensive API contract tests using Newman/Postman collections

- [x] **CI/CD Pipeline Documentation**: GitHub Actions (to be created during Phase 1)
  - Contains: Build, test, deployment automation configuration
  - Relationship: STP defines test execution hooks within CI/CD pipeline
  
- [x] **Bug Tracking Repository**: GitHub Issues (project repository)
  - Relationship: All defects found during testing logged here, STP tracks defect escape rate

---

## 2. TESTING SCOPE & OBJECTIVES

### 2.1 Scope: Features In Testing (100% Coverage for V1.0)

**Functional Requirements by Priority Level**

#### P0 (CRITICAL - 100% Test Coverage Required)

| Module/Feature | Test Type | Priority | Coverage Target | Notes |
|---|---|---|---|---|
| **Payment Gateway** | Unit, Integration, E2E, Contract | P0 | 100% | Midtrans webhook validation, signature verification, payment confirmation flow, idempotency checks |
| **Booking System** | Unit, Integration, E2E, Contract | P0 | 100% | Create booking, validate slot availability (max 4 per sesi), 6-digit code generation, status transitions (PENDING_PAYMENT → PAYMENT_CONFIRMED) |
| **Check-in System** | Unit, Integration, E2E, Contract | P0 | 100% | Admin input validation, kode booking verification, session time validation, duplicate check-in prevention, queue number generation (Redis atomic counter) |
| **Queue Management** | Unit, Integration, E2E, Contract | P0 | 100% | FIFO ordering, real-time updates (WebSocket/polling), pasien call flow, auto-delete completed queue items, walk-in FIFO mixing |
| **EMR Creation & Edit** | Unit, Integration, E2E, Contract | P0 | 100% | EMR status transitions (DRAFT → COMPLETED), field-level filtering (pasien view), doctor edit audit trail, auto-invoice trigger |
| **Auto-Invoice Generation** | Unit, Integration, E2E | P0 | 100% | Trigger on EMR.status = COMPLETED, invoice number format (INV-[CABANG]-[YYYYMMDD]-[SEQUENCE]), cost breakdown (DP Rp50k + treatment), UNPAID status default |
| **Multi-Tenant Isolation** | Unit, Integration | P0 | 100% | Branch-level row security, branch_id filtering on all queries, cross-branch data leak prevention |
| **Authentication & Authorization** | Unit, Integration, Contract | P0 | 100% | User login (email/password for pasien, username/password for admin/dokter), JWT token generation & validation, role-based access control (PATIENT/ADMIN/DOCTOR), bcrypt hashing verification |
| **Audit Log (Immutable)** | Unit, Integration | P0 | 100% | 15+ event types (BOOKING_CREATED, PAYMENT_CONFIRMED, CHECK_IN_SUCCESS, EMR_CREATED, EMR_EDITED, INVOICE_GENERATED, etc), append-only enforcement (no UPDATE/DELETE), Bahasa Indonesia messages, timestamp accuracy |
| **Payment Webhook Handler** | Unit, Integration, E2E | P0 | 100% | Signature validation against Midtrans server_key, duplicate webhook prevention (idempotency), status update atomicity, FCM push notification sending, error retry logic (3x exponential backoff) |

#### P1 (HIGH - 80%+ Test Coverage Required)

| Module/Feature | Test Type | Priority | Coverage Target | Notes |
|---|---|---|---|---|
| **TV Queue Display** | Integration, E2E | P1 | 80%+ | Real-time queue rendering (WebSocket broadcast), color coding (NOW=red, QUEUE=blue), privacy (no patient names, number only), auto-delete for completed items |
| **Mobile App (Flutter)** | Unit, Integration, E2E | P1 | 80%+ | Booking flow, Midtrans payment integration, check-in info display, queue real-time view, EMR history (read-only), FCM notification handling |
| **Admin Dashboard** | Integration, E2E | P1 | 80%+ | Queue management, check-in form, EMR view (read-only), payment input, invoice list, stok management, audit log view, backup trigger |
| **Dokter Portal** | Integration, E2E | P1 | 80%+ | Queue view + call pasien, EMR input/edit/view, pasien list per session, invoice view (read-only) |
| **Landing Page** | E2E, Component | P1 | 80%+ | Navigation, hero CTA, spesialisasi cards, dokter filter & display, FAQ accordion, testimonial karusel, location/maps, footer links |
| **AI Chat Widget** | Unit, Integration, E2E | P1 | 80%+ | Gemini API integration, hardcoded FAQ lookup, message send/receive, booking suggestion links, urgent medical escalation |
| **Payment Tracking & Export** | Unit, Integration, Contract | P1 | 80%+ | Invoice status tracking (UNPAID → PAID), payment method input (cash/transfer), CSV export (payment report per cabang per hari), manual reconciliation audit trail |
| **Walk-in Management** | Unit, Integration, E2E | P1 | 80%+ | Admin input walk-in pasien (tanpa kode booking), FIFO queue mixing, nomor antrian generation, display on TV |
| **No-Show Penalty** | Unit, Integration | P1 | 80%+ | Automatic NO_SHOW status jika pasien tidak check-in hingga akhir sesi, DP hangus marking, audit log recording |

#### P2 (MEDIUM - 50%+ Test Coverage Acceptable)

| Module/Feature | Test Type | Priority | Coverage Target | Notes |
|---|---|---|---|---|
| **Booking Cancellation** | Unit, Integration | P2 | 50%+ | Pasien can cancel anytime, DP non-refundable, status → CANCELLED, slot released for rebooking |
| **Doctor Schedule Override** | Unit, Integration | P2 | 50%+ | Admin can override jadwal (audit log recorded), effective immediately |
| **Password Reset Flow** | Unit, Integration | P2 | 50%+ | Email reset link generation, token expiry (15 min), password update atomic |
| **Stok/Inventory Notes** | Unit, Integration | P2 | 50%+ | Admin manage stok items, dokter can view (informational), no automatic deduction |
| **Pagination & Filtering** | Unit, Integration, Contract | P2 | 50%+ | Patient history pagination, queue filter by branch, payment report date range |
| **Lupa Password (Pasien)** | Unit, Integration, E2E | P2 | 50%+ | Email reset link sent, token validation, password hash update |
| **Backup Trigger** | Integration | P2 | 50%+ | Admin trigger full DB backup (PostgreSQL dump), MinIO documents backup, restoration test |

**Feature Implementation Notes**:
- All features tested against requirements dalam PRD v10.0 (lines 1-1320)
- Logic flows traced from LOGIC_FLOW.txt (7 major flows)
- UI interactions validated against HALAMAN.txt screen specifications
- Architecture compliance checked against TDD.md (Modulith, clean architecture)
- Disaster recovery scenarios per DRP.md

---

### 2.2 Scope: Features Out of Testing (Deferred to V2+)

| Feature | Reason | Target Release | Testing Status |
|---|---|---|---|
| Geolocation-based appointment suggestion | Out of scope V1 MVP | v2.0 | Not tested |
| WhatsApp direct integration (message automation) | Manual contact only | v2.0 | Not tested |
| SMS notifications | FCM push sufficient for V1 | v2.0 | Not tested |
| Multi-language support (non-Bahasa Indonesia) | Indonesia-only MVP | v2.0 | Not tested |
| Insurance integration & claim processing | Business model decision | v3.0 | Not tested |
| Advanced analytics & BI dashboards | Deferred | v2.0 | Not tested |
| Kubernetes orchestration | Docker Compose sufficient | v3.0 | Not tested |
| GraphQL API (REST only V1) | GraphQL federated later | v2.0 | Not tested |
| Custom appointment scheduling algorithm | Simple FIFO sufficient | v2.0 | Not tested |
| Telemedicine/Video consultation | Out of scope | v3.0 | Not tested |

---

### 2.3 Platform & Environment Scope

#### Frontend Platforms (In Scope)

**Web Browser**:
- [x] Chrome 120+ (desktop, testing primary browser)
- [x] Firefox 121+ (desktop, regression)
- [x] Safari 17+ (desktop, regression)
- [x] Edge 120+ (desktop, regression)
- [x] Chrome Mobile (Android, responsive)
- [x] Safari Mobile (iOS, responsive via mobile web)

**Mobile Platforms**:
- [x] Android 10+ (Flutter APK, real device testing)
- [x] iOS 14+ (Flutter, via Xcode simulator if available)

**TV Display Platform**:
- [x] Any modern browser (Chromium-based)
- [x] Fullscreen kiosk mode (queue display)
- [x] Tested on: Desktop browser, tablet (iPad), TV via HDMI

#### Backend Platforms (In Scope)

**Operating System**:
- [x] Linux (Ubuntu 22.04 LTS - production target)
- [x] macOS 12+ (development)
- [x] Windows 11 (development, WSL2 recommended)

**Runtime/Framework**:
- [x] Node.js 18.x LTS (tested version)
- [x] Express.js 4.18+

**Database**:
- [x] PostgreSQL 15+ (primary, Docker container)
- [x] Redis 7+ (cache & session, Docker container)
- [x] MinIO (S3-compatible, Docker container)
- [x] RabbitMQ 3.12+ (optional event-driven, Docker container)

**Cloud Platform**:
- [x] Docker Compose (local development & staging)
- [x] Render.com / Railway.app (backend deployment target)
- [x] Vercel (frontend deployment target)
- [x] Firebase App Distribution (mobile APK distribution)

#### Network Conditions (In Scope)

- [x] Fiber/5G (high bandwidth, low latency ~10-20ms)
  - Scenario: Office/clinic wired connection
  - Expectations: All features perform optimally
  
- [x] 4G/LTE (medium bandwidth, medium latency ~50-100ms)
  - Scenario: Mobile app on 4G network
  - Expectations: Real-time features work within acceptable latency
  
- [x] 3G/Mobile data (high latency ~100-300ms, potential packet loss)
  - Scenario: Mobile app in remote areas (if any)
  - Expectations: Graceful degradation, retry logic, timeout handling
  
- [x] Offline mode (cached data, queue operations)
  - Scenario: Mobile app loses connection temporarily
  - Expectations: Queue view cached, booking blocked with message

#### Load Testing Scope

- [x] Concurrent users: 100-500 simultaneous sessions (TV display update stress)
- [x] Throughput: 50-100 check-ins per minute (end of session rush)
- [x] Payment webhook: 10 concurrent webhook deliveries
- [x] Database: 10,000 bookings, 1,000 audit log entries (data volume)
- [x] Cache: Redis memory efficiency (queue atomic counters, session storage)

---

### 2.4 Testing Objectives

**Primary Objectives** (MVP Release)

1. ✅ **Validate all P0 & P1 features** meet functional requirements exactly as specified in PRD v10.0
   - Booking workflow: create → payment → confirmation → check-in → queue → EMR → invoice
   - Multi-tenant isolation: branch_id filtering on 100% of queries
   - Payment gateway: Midtrans sandbox integration with webhook validation
   - Queue management: FIFO, real-time updates, auto-delete

2. ✅ **Ensure non-functional requirements** (performance, security, reliability) are met
   - API response time: p95 < 200ms
   - Queue update latency: < 2 seconds (WebSocket broadcast)
   - System uptime: 99.5% (measured post-deployment)
   - Payment success rate: > 99% (webhook delivery reliability)
   - Database consistency: 100% ACID compliance (no data loss on payment confirmation)

3. ✅ **Identify and document bugs** before release to production
   - Defect tracking: GitHub Issues with severity levels (Critical/High/Medium/Low)
   - Defect escape rate target: < 1% (critical bugs in production post-release)
   - Blocker bug definition: Any P0 feature failure, security vulnerability, data loss scenario

4. ✅ **Verify fixes and regression tests** pass after each bug fix
   - Automated regression suite run after every fix
   - Manual smoke tests on staging environment
   - Cross-browser compatibility regression (if UI change)

5. ✅ **Ensure system stability and user experience** quality
   - All error messages in Bahasa Indonesia, clear & actionable
   - Loading states present (skeleton/spinner) for async operations
   - Form validation feedback immediate (client-side + server-side)
   - Navigation flows intuitive (no dead ends, clear CTAs)

6. ✅ **Verify disaster recovery procedures** (from DRP.md)
   - Database backup restore test: Restore from backup, verify data integrity
   - Rollback plan: Test quick rollback to previous version
   - Data consistency checks post-recovery: Audit log completeness, invoice accuracy
   - RTO/RPO verification: Recovery time < [target], data loss < [threshold]

**Secondary Objectives** (Quality & Portfolio)

1. ✅ **Achieve high test coverage** (>70% target for portfolio rating 9.5/10)
   - Unit test coverage: 70%+ critical services
   - Integration test coverage: All API endpoints tested
   - E2E coverage: All critical user journeys tested
   - Code coverage report: Published in repository README

2. ✅ **Demonstrate testing discipline** for recruiter evaluation
   - Test code organization (mirrors business logic structure)
   - Clear test naming (describe what is tested, expected behavior)
   - Comprehensive error scenario testing (not just happy path)
   - Performance baseline established & monitored

3. ✅ **Document testing strategy** thoroughly
   - This STP document complete & detailed
   - Test case repository with clear descriptions
   - Automated test results reported in CI/CD logs
   - Manual test checklists for UAT

---

## 3. TEST STRATEGY & PYRAMID APPROACH

### 3.1 Testing Pyramid Overview

```
                    /\
                   /  \          E2E / UI Tests (10-20%)
                  /----\         Playwright, Flutter widget tests
                 /      \        ~20 test cases
                /--------\
               /          \      Integration Tests (30-40%)
              /            \     PostgreSQL + Redis, Webhook mocks
             /              \    ~40 test cases
            /________________\
           /                  \  Unit Tests (40-50%)
          /                    \ Jest/Vitest, Service layer, Utils
         /______________________ \ ~80-100 test cases
```

**Distribution Target for DentFlow v1.0**:

- **Unit Tests**: 40-50% of effort (80-100 test cases)
  - Services: AuthService, BookingService, PaymentService, QueueService, EMRService, InvoiceService, AuditService
  - Utilities: JWT, Hash, Validator, Pagination, ErrorCode
  - Repositories: User, Booking, Queue, Payment, EMR, Invoice, Audit (mock database)

- **Integration Tests**: 30-40% of effort (40-50 test cases)
  - API endpoints: All P0 & P1 endpoints (15-20 major endpoints)
  - Database interactions: Multi-tenant isolation, transaction atomicity
  - Cache interactions: Redis atomic counters, session storage
  - External services: Midtrans webhook handler, Gemini API mock
  - Message queue: RabbitMQ event publishing (optional)

- **E2E / UI Tests**: 10-20% of effort (15-25 test cases)
  - Critical user journeys: Booking → Payment → Check-in → Queue → EMR
  - Web: Next.js admin/dokter/landing page flows (Playwright)
  - Mobile: Flutter app booking flow (Flutter widget tests + manual APK testing)
  - TV Display: Real-time queue updates (Playwright)

- **Manual Tests**: As-needed (UAT, exploratory, edge cases)
  - Smoke tests pre-release
  - Exploratory testing for new features
  - Cross-browser/device compatibility checks

---

### 3.2 Test Levels & Definitions

#### **Level 1: Unit Tests**

**Purpose**: Test individual functions/methods in isolation with mocked dependencies

**Scope**:
- [x] All public methods in service layer (AuthService, BookingService, etc)
- [x] All utility/helper functions (JWT, hash, validator, pagination)
- [x] Business logic validation (booking slot availability, queue number generation)
- [x] Edge cases & boundary conditions (empty inputs, null values, invalid states)
- [x] Error handling (try-catch blocks, error throwing)

**Tools**:
- Testing framework: Jest 29+ (Node.js/TypeScript standard)
- Mocking library: jest.mock() for dependencies, sinon (optional for call tracking)
- Assertion library: Jest built-in (expect, toBe, toThrow, etc)
- Code coverage: NYC/c8 (>70% target for critical modules)

**Coverage Target**: Minimum 70% code coverage for P0 services

**Service-Level Test Cases** (Examples)

```
AuthService:
  - ✓ login() with valid credentials → returns JWT token
  - ✓ login() with invalid password → throws Unauthorized error
  - ✓ login() with non-existent user → throws NotFound error
  - ✓ verifyToken() with valid token → returns decoded payload
  - ✓ verifyToken() with expired token → throws TokenExpired error
  - ✓ verifyToken() with tampered signature → throws InvalidSignature error

BookingService:
  - ✓ createBooking() with valid data → returns booking ID + kode
  - ✓ createBooking() when slot full (4 per sesi) → throws SlotFull error
  - ✓ createBooking() with invalid specialist → throws SpecialistNotFound error
  - ✓ createBooking() for past date → throws PastDateError
  - ✓ getBooking(id) → returns full booking details
  - ✓ cancelBooking() → status = CANCELLED, slot released

PaymentService:
  - ✓ initiatePayment() → calls Midtrans API, returns transaction URL
  - ✓ verifyWebhookSignature() with valid signature → returns true
  - ✓ verifyWebhookSignature() with invalid signature → throws SecurityError
  - ✓ processPaymentConfirmation() with SETTLEMENT status → updates booking status
  - ✓ processPaymentConfirmation() (duplicate webhook) → idempotent, no duplicate update

QueueService:
  - ✓ getQueueNumber() for branch A → generates unique number via Redis INCR
  - ✓ getQueueNumber() multiple calls → sequential 01, 02, 03, etc
  - ✓ listQueue() for dokter → returns FIFO ordered list
  - ✓ callNextPatient() → updates queue_status = BEING_CALLED
  - ✓ completePatient() → updates queue_status = COMPLETED, removes from display

EMRService:
  - ✓ createEMR() with valid data → returns EMR ID, status = DRAFT
  - ✓ editEMR() (doctor only) → updates fields, audit log recorded
  - ✓ editEMR() (admin user) → throws AccessDenied error
  - ✓ completeEMR() → status = COMPLETED, triggers invoice generation
  - ✓ getEMR(as patient) → returns filtered fields only (Keluhan, Tindakan, Resep)
  - ✓ getEMR(as doctor) → returns all fields including diagnosa

InvoiceService:
  - ✓ generateInvoice() (from completed EMR) → creates invoice, UNPAID status
  - ✓ generateInvoice() number format → INV-[CABANG]-[YYYYMMDD]-[SEQUENCE]
  - ✓ markInvoicePaid() → status = PAID, timestamp recorded
  - ✓ listInvoices(unpaid only) → filters UNPAID status
  - ✓ exportCSV() → format: date, pasien, amount, method, status

AuditService:
  - ✓ logEvent() → appends to audit log (immutable, INSERT only)
  - ✓ logEvent() with event type → validates against 15+ event types
  - ✓ getAuditLog() (admin only) → returns all events for branch
  - ✓ getAuditLog() (doctor) → only personal events visible (read-only access check)
```

**Test Data Strategy**:
- Fixture files: Seeded test data (users, doctors, schedules)
- Factory pattern: Create realistic test objects quickly
- Reset before/after: Database state isolation (unit tests use in-memory DB or rollback)

**Execution**: Local machine + CI pipeline (every commit)

**Pass Criteria**: All assertions pass, code coverage ≥ 70%

---

#### **Level 2: Integration Tests**

**Purpose**: Test interaction between multiple components/modules (services → database → cache)

**Scope**:
- [x] Service-to-Database interactions (repository methods with real test DB)
- [x] Service-to-Service interactions (AuthService → UserRepository → PostgreSQL)
- [x] Service-to-Cache interactions (QueueService → Redis atomic operations)
- [x] External API integrations (Midtrans webhook mock, Gemini API mock)
- [x] Multi-tenant isolation (queries filtered by branch_id, no cross-tenant leakage)
- [x] Transaction atomicity (concurrent updates, rollback on error)
- [x] Message queue operations (RabbitMQ event publishing, optional)

**Tools**:
- Test database: PostgreSQL container in Docker (testcontainers or Docker Compose)
- Cache: Redis container (test isolation with flushdb)
- Mocking: jest.mock() for external APIs (Midtrans, Gemini)
- Request mocking: nock or msw (Mock Service Worker) for HTTP requests
- Database reset: Truncate tables before each test, fixtures loaded

**Coverage Target**: Minimum 1 integration test per major endpoint/module

**Integration Test Scope Examples**

```
Booking Module Integration:
  - ✓ POST /api/bookings (create) → database INSERT, audit log recorded
  - ✓ POST /api/bookings (slot full) → database NOT changed, error response
  - ✓ GET /api/bookings/{id} → fetches from DB, pasien sees own booking only
  - ✓ GET /api/bookings/{id} (admin different branch) → forbidden (multi-tenant isolation)
  - ✓ PATCH /api/bookings/{id}/cancel → status change, audit log, slot released

Payment Module Integration:
  - ✓ POST /webhook/payment-confirmation (valid signature) → booking status updated in DB
  - ✓ POST /webhook/payment-confirmation (invalid signature) → 403 Forbidden, DB NOT changed
  - ✓ POST /webhook/payment-confirmation (duplicate) → idempotent, 200 OK, status not re-updated
  - ✓ POST /webhook/payment-confirmation (concurrency) → last write wins or transaction rollback

Check-in Module Integration:
  - ✓ POST /api/admin/check-in (valid code, within session time) → queue record created, Redis counter incremented
  - ✓ POST /api/admin/check-in (invalid code) → error, no queue created
  - ✓ POST /api/admin/check-in (session expired) → error, prevents late check-in
  - ✓ POST /api/admin/check-in (already checked-in) → prevents duplicate, returns existing queue number
  - ✓ POST /api/admin/check-in (walk-in) → creates booking + queue in one flow

Queue Module Integration:
  - ✓ GET /api/queues/{dokter_id} (WebSocket) → real-time updates broadcast to all clients
  - ✓ WebSocket subscriber receives check-in update immediately (<2s latency)
  - ✓ PUT /api/queues/{queue_id}/call-next → queue_status = BEING_CALLED, all clients notified
  - ✓ PUT /api/queues/{queue_id}/complete → status = COMPLETED, item removed from all displays

EMR Module Integration:
  - ✓ POST /api/emr (by doctor) → record created, status = DRAFT, audit log recorded
  - ✓ PATCH /api/emr/{id} (multiple edits) → each edit logged in audit trail
  - ✓ PATCH /api/emr/{id}/complete (status DRAFT → COMPLETED) → invoice auto-generated
  - ✓ GET /api/emr/{id} (by patient) → filtered response (no diagnosa field)
  - ✓ GET /api/emr/{id} (by admin other branch) → forbidden

Invoice Module Integration:
  - ✓ Invoice auto-generated after EMR completion (trigger verified)
  - ✓ Invoice number unique per day per branch (no duplicates)
  - ✓ POST /api/invoices/{id}/mark-paid → status = PAID, timestamp recorded, audit log
  - ✓ GET /api/invoices/export-csv → returns CSV with correct format & data

Audit Log Integration:
  - ✓ Every booking status change → audit log event recorded (immutable)
  - ✓ Every payment confirmation → PAYMENT_CONFIRMED event logged
  - ✓ Every check-in → CHECK_IN_SUCCESS event logged with queue number
  - ✓ Audit log append-only enforced (no UPDATE/DELETE operations possible in DB)
  - ✓ Get audit logs (admin) → all branch events returned, Bahasa Indonesia messages

Multi-Tenant Isolation Integration:
  - ✓ Admin branch A → cannot see bookings from branch B/C
  - ✓ Doctor branch A → cannot see queue from branch B/C
  - ✓ Patient → booking filtered to accessible branch only
  - ✓ Audit log → branch admin only sees own branch events
  - ✓ All queries use WHERE branch_id filter (no tenant leakage)
```

**Test Data Setup**:
- [ ] Seed data: 3 branches, 24 doctors (8 per branch), 10 patient accounts
- [ ] Schedule fixtures: Pre-populated jadwal dokter (Senin-Sabtu, morning+afternoon sessions)
- [ ] Database reset after each test (transaction rollback or truncate)
- [ ] Fixture reuse across tests (same seed data, isolated updates)

**Execution**: CI pipeline (PR checks), takes 5-10 minutes

**Pass Criteria**: All assertions pass, database state verified after each operation

---

#### **Level 3: API / Contract Tests**

**Purpose**: Test API contracts (request/response validation) against TDD specifications

**Scope**:
- [x] All P0 and P1 API endpoints (15+ major endpoints)
- [x] Request validation (required fields, data types, formats)
- [x] Response validation (status codes, schema correctness, data accuracy)
- [x] HTTP method correctness (POST for creates, PUT for updates, DELETE for deletes)
- [x] Authentication & authorization checks (JWT validation, role-based access)
- [x] Error handling & error messages (standard error format, Bahasa Indonesia messages)
- [x] HTTP status codes (200, 201, 204, 400, 401, 403, 404, 500)

**Tools**:
- API testing: Postman + Newman (CLI for CI/CD automation)
- Schema validation: JSON Schema validators
- OpenAPI/Swagger spec: Document API contracts (TDD Section 5)
- Tools: Prism (mock server for testing), apitest (Go library for complex scenarios)

**Test Format** (Per Endpoint)

```
Endpoint: POST /api/bookings
Category: Booking Module
Priority: P0

REQUEST SPECIFICATION:
  Method: POST
  Path: /api/bookings
  Authentication: JWT Bearer Token (patient user)
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer [JWT_TOKEN]
  Body Schema: {
    "specialist_id": "sp.bm" (required, string, enum validation),
    "doctor_id": 50 (required, integer, doctor exists validation),
    "date": "2026-07-20" (required, string ISO date, future date validation),
    "session_id": 1 (required, integer, session exists validation),
    "branch_id": "A" (required, string, enum: A/B/C)
  }
  Body Example: {
    "specialist_id": "sp.bm",
    "doctor_id": 50,
    "date": "2026-07-20",
    "session_id": 1,
    "branch_id": "A"
  }

RESPONSE (SUCCESS):
  Status Code: 201 Created
  Schema: {
    "id": 1234 (number),
    "check_in_code": "ABC123DEF" (string, 6-digit alphanumeric),
    "status": "PENDING_PAYMENT" (string, enum),
    "dp_amount": 50000 (number, Rupiah),
    "doctor_name": "drg. Siti Nurhaliza" (string),
    "specialist": "Sp.BM" (string),
    "date": "2026-07-20" (string ISO date),
    "session_start": "09:00" (string HH:mm),
    "session_end": "12:00" (string HH:mm),
    "branch_id": "A" (string),
    "created_at": "2026-07-10T14:30:00Z" (ISO timestamp),
    "payment_gateway_id": null (string or null, pre-payment)
  }
  Example: {
    "id": 1234,
    "check_in_code": "ABC123DEF",
    "status": "PENDING_PAYMENT",
    "dp_amount": 50000,
    "doctor_name": "drg. Siti Nurhaliza",
    "specialist": "Sp.BM",
    "date": "2026-07-20",
    "session_start": "09:00",
    "session_end": "12:00",
    "branch_id": "A",
    "created_at": "2026-07-10T14:30:00Z"
  }

RESPONSE (ERROR - SLOT FULL):
  Status Code: 400 Bad Request
  Error Schema: {
    "error_code": "SLOT_FULL" (string),
    "message": "Slot penuh untuk dokter ini. Maksimal 4 pasien per sesi." (Bahasa Indonesia),
    "timestamp": "2026-07-10T14:30:00Z"
  }

RESPONSE (ERROR - UNAUTHENTICATED):
  Status Code: 401 Unauthorized
  Error: {
    "error_code": "UNAUTHORIZED",
    "message": "Token tidak valid atau expired."
  }

RESPONSE (ERROR - FORBIDDEN - ADMIN FROM OTHER BRANCH):
  Status Code: 403 Forbidden
  Error: {
    "error_code": "FORBIDDEN",
    "message": "Anda tidak memiliki akses ke branch ini."
  }

RESPONSE (ERROR - VALIDATION):
  Status Code: 400 Bad Request
  Error: {
    "error_code": "VALIDATION_ERROR",
    "message": "Validasi gagal.",
    "details": [
      { "field": "date", "message": "Tanggal harus di masa depan." },
      { "field": "specialist_id", "message": "Spesialis tidak valid." }
    ]
  }

TEST CASES:
  ✓ TC-001: Valid booking request → 201, check_in_code generated
  ✓ TC-002: Slot full (4 booked) → 400 SLOT_FULL
  ✓ TC-003: Invalid specialist → 400 VALIDATION_ERROR
  ✓ TC-004: Past date → 400 VALIDATION_ERROR
  ✓ TC-005: Missing JWT token → 401 UNAUTHORIZED
  ✓ TC-006: Expired JWT token → 401 UNAUTHORIZED
  ✓ TC-007: Admin creating booking for other branch → 403 FORBIDDEN
  ✓ TC-008: Non-existent doctor → 400 / 404 NOT_FOUND
```

**Major Endpoints to Test** (15+ P0/P1)

| Endpoint | Method | Purpose | Auth | Status |
|---|---|---|---|---|
| POST /api/auth/register | POST | User registration | None | P0 |
| POST /api/auth/login | POST | User login, JWT token | None | P0 |
| POST /api/bookings | POST | Create booking | JWT (patient) | P0 |
| GET /api/bookings/{id} | GET | Get booking details | JWT | P0 |
| PATCH /api/bookings/{id}/cancel | PATCH | Cancel booking | JWT (patient owner) | P1 |
| POST /api/payments/{id}/redirect | POST | Midtrans payment page | JWT | P0 |
| POST /webhook/payment-confirmation | POST | Midtrans webhook | Signature | P0 |
| POST /api/admin/check-in | POST | Admin check-in pasien | JWT (admin) | P0 |
| GET /api/queues/{doctor_id} | GET | Get queue for doctor | JWT | P0 |
| PUT /api/queues/{queue_id}/call | PUT | Call next patient | JWT (doctor) | P1 |
| POST /api/emr | POST | Create EMR (doctor only) | JWT (doctor) | P0 |
| PATCH /api/emr/{id} | PATCH | Edit EMR | JWT (doctor owner) | P0 |
| PATCH /api/emr/{id}/complete | PATCH | Complete EMR → auto-invoice | JWT (doctor) | P0 |
| GET /api/invoices | GET | List invoices (admin) | JWT (admin) | P1 |
| POST /api/invoices/{id}/mark-paid | POST | Mark invoice paid | JWT (admin) | P1 |
| GET /api/audit-logs | GET | Get audit log (admin only) | JWT (admin) | P0 |
| GET /api/tv-display/{branch_id} | GET | TV display queue data | None (public IP restricted) | P1 |
| POST /api/ai/chat | POST | AI chat widget | None | P1 |
| GET /api/doctors | GET | List all doctors (public) | None | P2 |
| POST /api/admin/walk-in | POST | Add walk-in patient | JWT (admin) | P1 |

**Execution**: Postman collection + Newman CI, takes 2-5 minutes

**Pass Criteria**: All status codes correct, response schemas validate, error messages clear

---

#### **Level 4: UI / End-to-End (E2E) Tests**

**Purpose**: Test complete user workflows from frontend perspective (customer journeys, not implementation details)

**Scope**:
- [x] Critical user journeys (booking → payment → check-in → queue → EMR complete)
- [x] Form submission and validation (booking form, login form, EMR input)
- [x] Navigation flows (page transitions, routing)
- [x] Real-time updates (queue display, TV display, notifications)
- [x] Error handling from user perspective (error messages shown, recovery options)
- [x] Mobile responsiveness (mobile web, Flutter app flows)
- [x] Accessibility (form labels, keyboard navigation, screen reader compatibility)

**Tools**:
- E2E Framework: Playwright 1.40+ (cross-browser, fast, reliable)
- Headless Browser: Chromium (primary), Firefox, WebKit (optional)
- Test Environment: Staging environment (replica of production)
- Mobile Testing: Playwright mobile emulation OR Flutter widget tests
- Visual Regression: Percy.io (optional, for UI regression detection)

**Coverage Target**: 1-2 critical user journeys per major feature (15-25 E2E tests)

**Critical User Journeys to Test**

```
JOURNEY 1: Pasien Complete Booking Flow (P0)
└─ Pre-condition: Pasien not logged in
├─ Step 1: Visit landing page (/) → verify hero, CTA buttons visible
├─ Step 2: Click "Booking Online" CTA → redirect to /patient/login
├─ Step 3: Register new account (email, password) → verify email confirmation required (or skip for test account)
├─ Step 4: Login → access /patient/dashboard
├─ Step 5: Click "Booking Baru" → /patient/booking
├─ Step 6: Select cabang (A) → specialist (Sp.BM) → date (future) → session (09:00-12:00)
├─ Step 7: Verify max 4 slots available (if less, show available; if full, show error)
├─ Step 8: Click "Lanjutkan ke Pembayaran" → /patient/booking/{id}/payment-redirect
├─ Step 9: Click "Bayar Sekarang" → redirect to Midtrans sandbox page
├─ Step 10: (Simulate payment) → Payment successful in sandbox
├─ Step 11: Webhook callback to backend (auto-processed)
├─ Step 12: Redirect to booking confirmation page → show kode + details + "Silakan datang ke Admin"
├─ Step 13: Pasien screenshot kode (ABC123DEF) → message sent via email (optional)
└─ Result: ✅ Booking confirmed, status PAYMENT_CONFIRMED, ready for check-in

JOURNEY 2: Admin Check-in Pasien (P0)
└─ Pre-condition: Pasien booking confirmed, session day arrived (e.g., today is 2026-07-20)
├─ Step 1: Admin login (/admin/login) with admin credentials (branch A)
├─ Step 2: Access /admin/dashboard → verify queue management section visible
├─ Step 3: Click "Check-in" tab → input form for kode booking
├─ Step 4: Admin receives pasien: "Saya Budi, kode ABC123DEF"
├─ Step 5: Admin input code: "ABC123DEF" → click "CARI" button
├─ Step 6: System validates: Kode valid? ✓ Pembayaran confirmed? ✓ Dalam sesi? ✓ Belum check-in? ✓
├─ Step 7: Success! Display: ✅ NOMOR ANTRIAN: 05 (generated via Redis)
├─ Step 8: Queue number visible on TV display (real-time via WebSocket)
├─ Step 9: Pasien sees queue number 05 in mobile app (real-time update)
├─ Step 10: Print struk with nomor 05 (optional) → give to pasien
└─ Result: ✅ Check-in success, queue created, real-time display updated

JOURNEY 3: Doctor Views Queue & Calls Pasien (P1)
└─ Pre-condition: 3+ pasien checked-in for Sp.BM sesi 09:00-12:00
├─ Step 1: Doctor login (/doctor/login) with doctor credentials
├─ Step 2: Access /doctor/queue → verify real-time queue list (FIFO order)
├─ Step 3: Queue displays: [01 - Pasien A] [02 - Pasien B] [03 - Pasien C]
├─ Step 4: Doctor clicks "Panggil 01" → calls Pasien A
├─ Step 5: Pasien A receives FCM notification: "Dokter memanggilmu"
├─ Step 6: Queue status changes on all screens (01 now highlighted as BEING_CALLED)
├─ Step 7: After treatment (10 min later), doctor creates EMR
├─ Step 8: Doctor fills: Keluhan, Tindakan, Resep → clicks "Selesai"
├─ Step 9: EMR status = COMPLETED → Invoice auto-generated
├─ Step 10: Queue number 01 auto-removed from display (COMPLETED)
├─ Step 11: TV display updates: Queue now [02 - Pasien B] [03 - Pasien C]
└─ Result: ✅ EMR created, invoice generated, queue updated real-time

JOURNEY 4: TV Queue Display Real-Time Updates (P1)
└─ Pre-condition: TV display showing queue for branch A
├─ Step 1: TV shows queue for all 8 spesialis (real-time status)
├─ Step 2: Format per spesialis: [Dr. Name | Sp. | Session] NOW: 05 | QUEUE: [06, 07, 08, 09]
├─ Step 3: New pasien checks in → queue updates on TV (< 2 sec latency)
├─ Step 4: Doctor calls next → NOW number highlights red, QUEUE updates
├─ Step 5: Doctor completes treatment → number auto-removed from display
├─ Step 6: No patient names shown (privacy) → numbers only
├─ Step 7: WebSocket broadcast working (or polling fallback if down)
└─ Result: ✅ Real-time queue display working, privacy maintained

JOURNEY 5: Admin Views Invoice & Marks Paid (P1)
└─ Pre-condition: 5+ invoices generated from completed EMRs
├─ Step 1: Admin login → /admin/invoices
├─ Step 2: Filter: show UNPAID invoices (default)
├─ Step 3: List shows: Tanggal | Pasien | Dokter | Amount | Status (UNPAID)
├─ Step 4: Admin clicks invoice → detail view: breakdown (DP 50k + treatment 150k = 200k)
├─ Step 5: Admin clicks "Mark as Paid" → select method (Cash/Transfer)
├─ Step 6: Input: amount, timestamp, notes → click "Confirm"
├─ Step 7: Status changes → PAID, timestamp recorded
├─ Step 8: Audit log records: INVOICE_MARKED_PAID event
├─ Step 9: Admin exports CSV report (date range filter) → download file
└─ Result: ✅ Invoice management complete, payment reconciliation possible

JOURNEY 6: Landing Page AI Chat Widget (P1)
└─ Pre-condition: Landing page loaded, chat widget visible (embedded)
├─ Step 1: User sees chat widget (bottom right, "Halo, Ada yang bisa kami bantu?")
├─ Step 2: User input: "Saya ingin scaling gigi, berapa harganya?"
├─ Step 3: Frontend sends message → backend calls Gemini API
├─ Step 4: AI responds: "Scaling adalah prosedur... Harga Rp 200.000... Spesialis Periodonsia..."
├─ Step 5: Response includes booking suggestion buttons (e.g., "[Booking Rabu 10:00]")
├─ Step 6: User clicks booking button → redirect to /patient/booking (pre-filled)
├─ Step 7: Escalation test: User asks "Saya alergi amoxicillin, apa obat alternatif?"
├─ Step 8: AI: "Pertanyaan medical membutuhkan konsultasi... [Chat dengan Admin]"
└─ Result: ✅ AI chat working, routing & escalation functional

JOURNEY 7: Mobile App Booking (Flutter) (P1)
└─ Pre-condition: Flutter APK installed on Android device
├─ Step 1: Open app → login screen or register screen
├─ Step 2: Register: email + password → verification (test account)
├─ Step 3: Login → home screen (dashboard with "Booking Baru" CTA)
├─ Step 4: Tap "Booking Baru" → cabang selection (A/B/C)
├─ Step 5: Tap cabang A → specialist selection (8 options grid view)
├─ Step 6: Tap Sp.BM → date picker (calendar, future dates only)
├─ Step 7: Select date → session picker (e.g., 09:00-12:00, 13:00-16:00)
├─ Step 8: Review booking details → "Lanjutkan Pembayaran" button
├─ Step 9: Tap "Bayar Sekarang" → open Midtrans (WebView)
├─ Step 10: (Sandbox payment simulation)
├─ Step 11: After payment → notification: "Booking confirmed, kode: ABC123DEF"
├─ Step 12: Tap "History" tab → view past & upcoming bookings + EMR history
└─ Result: ✅ Mobile booking end-to-end working

JOURNEY 8: Walk-in Pasien Queue Management (P1)
└─ Pre-condition: Session 09:00-12:00 in progress, pasien walk-in without booking
├─ Step 1: Pasien approach admin: "Saya walk-in, ingin ke Dr. Siti (Sp.BM)"
├─ Step 2: Admin click "Add Walk-in" button in check-in form
├─ Step 3: Form appears: Nama pasien, spesialis → admin fills and submits
├─ Step 4: System creates temporary booking + generates queue number (06)
├─ Step 5: Queue number 06 assigned via FIFO (mixed with online bookings)
├─ Step 6: Queue updated on TV, in mobile app, doctor screen
├─ Step 7: Doctor calls walk-in pasien (06) when ready
├─ Step 8: After treatment, doctor creates EMR (same flow as online pasien)
└─ Result: ✅ Walk-in integration seamless, FIFO maintained

EDGE CASES & ERROR SCENARIOS (E2E):
  ✓ EC-001: User tries to book past date → validation error before payment
  ✓ EC-002: User payment timeout (Midtrans page, user close tab) → booking cancelled after 24h
  ✓ EC-003: Admin check-in outside session time (8:00 AM before 09:00 start) → error "Sesi belum dimulai"
  ✓ EC-004: Admin check-in after session (13:00 for 09:00-12:00 sesi) → error "Sesi sudah selesai"
  ✓ EC-004: Queue display WebSocket disconnects → fallback to polling (2-3 sec)
  ✓ EC-005: Admin from Branch A tries to access Branch B invoice → 403 Forbidden
  ✓ EC-006: Pasien tries to edit other pasien's booking → 403 Forbidden
  ✓ EC-007: Doctor tries to view other doctor's EMR patients → 403 Forbidden
```

**Execution**: Playwright tests run on staging environment, 10-15 minutes for full suite

**Pass Criteria**: All journeys complete successfully, error messages clear, real-time updates working

---

#### **Level 5: Non-Functional Tests**

**A. Performance Testing**

**Purpose**: Verify system meets performance requirements (latency, throughput, resource utilization)

**Metrics to Track**:

| Metric | Target | Tool | SLA |
|--------|--------|------|-----|
| API Response Time (p50) | < 100ms | k6 / Apache JMeter | Per endpoint |
| API Response Time (p95) | < 200ms | Prometheus metrics | Non-negotiable |
| API Response Time (p99) | < 500ms | Grafana dashboard | Alert threshold |
| Throughput (Booking API) | ≥ 50 req/sec | k6 load test | Sustainable |
| Throughput (Payment Webhook) | ≥ 10 concurrent | Load simulation | Midtrans rate limit |
| Queue WebSocket Broadcast | < 2 seconds | WebSocket profiler | Real-time requirement |
| TV Display Update Latency | < 3 seconds | Client latency measure | User perception |
| Database Query Time | < 100ms (p95) | PostgreSQL EXPLAIN ANALYZE | Query optimization |
| Cache Hit Rate | ≥ 95% | Redis monitoring | Session/queue cache |
| Memory Usage | < 512 MB (Node process) | Clinic monitoring tools | Resource limits |
| CPU Usage | < 70% (under load) | Load test metrics | Stability threshold |
| Disk I/O | < 100 IOPS (average) | iostat monitoring | MinIO file upload |

**Performance Test Scenarios**:

```
Scenario 1: Normal Load (Steady State)
  - Concurrent users: 50 (typical clinic hours)
  - Booking requests: 5 per minute
  - Check-ins: 20 per minute (end of session rush)
  - EMR updates: 10 per minute
  - Queue subscribers (WebSocket): 100 concurrent
  - Duration: 30 minutes
  - Expected: All operations complete within SLA

Scenario 2: Peak Load (Session Rush Hour)
  - Concurrent users: 200 (multiple sessions, all branches)
  - Booking requests: 20 per minute
  - Check-ins: 50 per minute (peak rush)
  - EMR updates: 30 per minute
  - Queue subscribers: 300 concurrent
  - Payment webhook: 15 concurrent deliveries
  - Duration: 15 minutes
  - Expected: p95 response time < 200ms maintained, no 500 errors

Scenario 3: Payment Gateway Load
  - Concurrent payment webhooks: 10 simultaneous
  - Webhook processing time: < 1 second (end-to-end)
  - Signature verification: < 50ms
  - Database update + audit log: < 100ms
  - FCM notification send: < 500ms (async, non-blocking)
  - Expected: 100% webhook success rate (no failures)

Scenario 4: Queue Display Surge (TV Update Storm)
  - 200 check-ins in 1 minute (unrealistic but stress test)
  - 8 TV display clients (per branch) receiving updates
  - WebSocket broadcast latency: < 2 seconds
  - Expected: No missed updates, all clients eventually consistent

Scenario 5: Database Volume Test
  - Insert 10,000 bookings over 1 week
  - Query response time (get booking history) with 10k records: < 100ms
  - Pagination (100 records per page): < 50ms
  - Audit log insert (1M events over time): append speed maintained
  - Expected: Query performance not degraded with data growth
```

**Tools**:
- Load testing: k6 (modern, easy to script) OR Apache JMeter (traditional)
- Monitoring: Prometheus (metrics collection) + Grafana (dashboard)
- APM: Sentry (error tracking, performance profiling)
- Database: PostgreSQL EXPLAIN ANALYZE (query plans)
- Cache: Redis monitoring (hit rate, eviction)

**Execution**: Weekly during development, pre-release comprehensive test

---

**B. Security Testing**

**Purpose**: Verify no vulnerabilities, proper authentication/authorization, secure data handling

**Security Test Cases**:

```
Authentication & Authorization:
  ✓ ST-001: Invalid JWT token → 401 Unauthorized
  ✓ ST-002: Expired JWT token → 401 Unauthorized
  ✓ ST-003: Tampered JWT signature → 401 Unauthorized
  ✓ ST-004: Missing Authorization header → 401 Unauthorized
  ✓ ST-005: Patient role accessing admin endpoint → 403 Forbidden
  ✓ ST-006: Admin from Branch A accessing Branch B → 403 Forbidden
  ✓ ST-007: Password reset token expired (>15 min) → 401 Unauthorized
  ✓ ST-008: Bcrypt password hash verified (not plaintext in DB)

Input Validation (OWASP Top 10):
  ✓ ST-009: SQL Injection attempt in booking code → sanitized, error returned
  ✓ ST-010: XSS attempt in EMR "Tindakan" field → escaped in response
  ✓ ST-011: Oversized request body (>1MB) → 413 Payload Too Large
  ✓ ST-012: Invalid JSON format → 400 Bad Request
  ✓ ST-013: Missing required fields → 400 Validation Error
  ✓ ST-014: Invalid date format → 400 Validation Error

Rate Limiting:
  ✓ ST-015: >5 requests per second from same IP → 429 Too Many Requests
  ✓ ST-016: Login attempts rate limited → max 5 failed attempts = temporary block
  ✓ ST-017: Payment webhook rate limited → no abuse by spammers

Payment Security:
  ✓ ST-018: Webhook signature verification (HMAC-SHA256) → only valid Midtrans webhooks accepted
  ✓ ST-019: Duplicate webhook prevention (idempotency) → same webhook not processed twice
  ✓ ST-020: Payment amount tampering → validated server-side (client amount ignored)
  ✓ ST-021: Booking ID manipulation in payment request → validate ownership

Data Protection:
  ✓ ST-022: HTTPS/TLS enforced (all endpoints)
  ✓ ST-023: Passwords not logged in access logs
  ✓ ST-024: JWT tokens not logged in access logs
  ✓ ST-025: EMR sensitive fields (diagnosa) not exposed to patients
  ✓ ST-026: Payment details not stored in logs (PCI compliance)

CORS & Headers:
  ✓ ST-027: CORS headers set correctly (allowed origins)
  ✓ ST-028: X-Frame-Options: DENY (clickjacking prevention)
  ✓ ST-029: X-Content-Type-Options: nosniff
  ✓ ST-030: Content-Security-Policy headers set (XSS prevention)

Session Management:
  ✓ ST-031: Session timeout after 30 minutes inactivity → auto-logout
  ✓ ST-032: Logout clears JWT token & Redis session
  ✓ ST-033: Cookie httpOnly flag set (no JavaScript access)
  ✓ ST-034: Cookie Secure flag set (HTTPS only)
```

**Tools**:
- Dependency scanning: OWASP Dependency-Check (CVE detection)
- Static analysis: SonarQube (code quality, security issues)
- SAST (Static Application Security Testing): Snyk (npm packages)
- DAST (Dynamic Application Security Testing): OWASP ZAP (automated scanning)
- Manual security review: Checklist during code review

**Execution**: Monthly security audit, pre-release full scan

---

**C. Reliability & Availability Testing**

**Purpose**: Verify system resilience, recovery, data consistency

**Reliability Test Cases**:

```
Network Resilience:
  ✓ RL-001: Database connection loss → reconnect with exponential backoff
  ✓ RL-002: Redis connection loss → cache misses handled, service continues
  ✓ RL-003: Webhook network timeout → Midtrans retries automatically (3x)
  ✓ RL-004: Payment API unreachable → graceful failure, user can retry

Data Consistency:
  ✓ RL-005: Concurrent booking requests for same slot → only one succeeds, slot atomicity
  ✓ RL-006: Concurrent payment confirmations (same booking) → idempotency, no duplicate status update
  ✓ RL-007: Queue number generation race condition → Redis INCR ensures unique numbers
  ✓ RL-008: EMR concurrent edits → last write wins OR optimistic locking prevents conflicts
  ✓ RL-009: Invoice generation (multiple EMR edits) → single invoice created, no duplicates

Backup & Recovery (DRP Validation):
  ✓ RL-010: Daily PostgreSQL backup → can restore from backup
  ✓ RL-011: Data integrity after restore → audit log completeness, invoice accuracy, no orphaned records
  ✓ RL-012: RTO (Recovery Time Objective) < 1 hour → backup restore time measured
  ✓ RL-013: RPO (Recovery Point Objective) < 1 day → daily backup sufficient, max 1 day data loss acceptable
  ✓ RL-014: Rollback procedure tested → quick rollback to previous version (< 5 minutes)

Error Recovery:
  ✓ RL-015: Failed payment webhook → retry 3x, eventually consistent
  ✓ RL-016: Database transaction rollback on error → no partial updates
  ✓ RL-017: Queue reset after session → automatic cleanup of old queue entries
  ✓ RL-018: Circuit breaker for Midtrans API → fallback if service down

Monitoring & Alerting:
  ✓ RL-019: Error rate > 1% → alert triggered
  ✓ RL-020: Response time p95 > 200ms → alert triggered
  ✓ RL-021: Database connection pool exhausted → alert triggered
  ✓ RL-022: Memory usage > 80% → alert triggered
```

**Execution**: Weekly health checks, monthly full recovery drill

---

### 3.3 Test Automation & Regression Strategy

**Test Automation Coverage**

| Test Level | Automation Tool | Test Count | CI/CD Trigger | Expected Duration |
|---|---|---|---|---|
| Unit | Jest | 100-120 | Every commit | 2-3 minutes |
| Integration | Jest + Docker | 40-50 | Every PR | 5-10 minutes |
| API Contract | Postman + Newman | 30-40 | Every commit | 2-5 minutes |
| E2E | Playwright | 15-25 | Every PR | 10-15 minutes |
| Performance | k6 | 5-8 | Weekly | 20-30 minutes |
| Security | OWASP ZAP | Auto-scan | Weekly | 10-15 minutes |
| **Total** | **Multiple tools** | **190-250** | **Per PR** | **20-40 minutes** |

**CI/CD Pipeline Integration** (GitHub Actions Example)

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-22.04
    services:
      postgres:
        image: postgres:15
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint code
        run: npm run lint
      
      - name: Unit & Integration tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgres://...
          REDIS_URL: redis://...
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
          minimum-coverage: 70
      
      - name: API Contract tests
        run: npm run test:api
      
      - name: E2E tests (Staging)
        run: npm run test:e2e
        env:
          STAGING_URL: https://staging.dentflow.io
      
      - name: Security scan
        run: npm audit --audit-level=moderate
```

**Regression Testing Strategy**

```
REGRESSION TEST TRIGGERS:
1. After bug fix → run unit + integration tests for affected module
2. After dependency upgrade → run full test suite
3. After API contract change → run API + integration tests
4. After database schema change → run integration + E2E tests
5. Before release → full test suite (unit + integration + API + E2E)

REGRESSION TEST SUITE (Per Release):
  - Unit test suite: 100+ tests
  - Integration test suite: 45+ tests
  - API contract suite: 35+ tests
  - E2E critical journeys: 20+ tests
  - Performance baseline: 5+ scenarios
  - Security scan: OWASP ZAP automated
  - Total: ~200+ test cases
```

---

## 4. TEST EXECUTION PLAN & TIMELINE

### 4.1 Testing Roadmap (9-Week Development Cycle)

**Phase 1 (Weeks 1-2): Foundation & TDD**
- [ ] Finalize TDD document (done - TDD.md v10.0)
- [ ] Design database schema (ERD, migrations)
- [ ] Create API contract specification (OpenAPI/Swagger)
- [ ] Setup Jest + test infrastructure
- [ ] Write unit tests for utility functions (JWT, Hash, Validator)
- [ ] Setup Docker Compose (PostgreSQL, Redis, MinIO)
- [ ] Coverage target: 0% (pre-coding phase)
- [ ] Deliverable: Test infrastructure ready, first unit tests passing

**Phase 2 (Weeks 3-4): Core Backend Development & Testing**
- [ ] Implement auth service + unit tests (80% coverage)
- [ ] Implement booking service + unit tests (80% coverage)
- [ ] Implement payment service + Midtrans webhook + unit tests
- [ ] Implement queue service + Redis integration tests
- [ ] Implement check-in service + integration tests
- [ ] Write integration tests (PostgreSQL + Redis interactions)
- [ ] Write API contract tests (all P0 endpoints)
- [ ] Coverage target: 60-70%
- [ ] Deliverable: Core services tested, API contract validated

**Phase 3 (Weeks 5-6): Advanced Features & Frontend Testing**
- [ ] Implement EMR service + auto-invoice trigger + unit tests
- [ ] Implement audit log service (immutable) + unit tests
- [ ] Implement admin invoice management + integration tests
- [ ] Frontend (Next.js) setup + component tests
- [ ] Landing page build + component tests
- [ ] Admin dashboard build + integration tests
- [ ] Start E2E tests (critical journeys)
- [ ] Coverage target: 70-75%
- [ ] Deliverable: Advanced features tested, frontend components validated

**Phase 4 (Weeks 7-8): Mobile & Polish**
- [ ] Flutter mobile app + widget tests (Flutter test)
- [ ] Mobile integration tests (API calls)
- [ ] TV display feature + E2E tests
- [ ] Complete all E2E tests (20 major journeys)
- [ ] Performance testing (k6 load tests)
- [ ] Security testing (OWASP ZAP)
- [ ] Bug fixes + regression tests
- [ ] Coverage target: 75-80%
- [ ] Deliverable: Full test suite complete, performance baseline established

**Phase 5 (Week 9): Pre-Release & Documentation**
- [ ] Final regression testing (full suite)
- [ ] UAT (User Acceptance Testing) - manual smoke tests
- [ ] Pre-release checklist verification
- [ ] Performance baseline finalized
- [ ] Coverage report finalized (>70% target achieved)
- [ ] Test documentation complete
- [ ] Bug tracking final review
- [ ] Release readiness sign-off
- [ ] Deliverable: Production-ready, all tests passing, zero blockers

---

### 4.2 Test Execution Cadence & Triggers

**Daily (Developer Local Testing)**
- Unit tests on changed files: `npm test` (watch mode)
- Pre-commit hook: Run lint + unit tests locally
- Manual smoke test on feature (basic functionality check)

**Per Commit (CI/CD Automated)**
- Unit test suite: All tests pass
- Code lint: ESLint + Prettier
- Dependency audit: No CVEs
- Pass/fail: Block merge if failed

**Per Pull Request (Gated)**
- All unit + integration tests: Pass required
- Code coverage: >70% for new code
- API contract tests: All endpoints validated
- Peer review: Manual approval before merge
- Expected: 20-40 minutes total CI/CD time

**Weekly (Regression & Performance)**
- Full test suite: Unit + Integration + API + E2E
- Performance baseline: Load test 50 concurrent users
- Security scan: OWASP dependency check + SonarQube
- Metrics review: Coverage trends, flaky tests
- Time investment: ~2-3 hours per week

**Monthly (Full Regression & Audit)**
- Complete regression test suite: All 200+ tests
- Performance stress test: 200 concurrent users
- Security audit: Full DAST scan
- UAT smoke test: Manual comprehensive walkthrough
- Time investment: ~8 hours

**Pre-Release (Final Gate)**
- Full regression suite: 100% pass rate required
- Performance baseline: p95 < 200ms confirmed
- Security scan: Zero critical/high vulnerabilities
- UAT sign-off: All critical journeys verified
- Documentation review: STP, test reports, API docs
- Expected pass rate: 99%+ (zero blockers allowed)

---

### 4.3 Test Environment & Data Setup

**Test Environments**

| Environment | Purpose | Database | Data | Access |
|---|---|---|---|---|
| **Local** | Developer testing | PostgreSQL (Docker) | Seed fixtures | Developer only |
| **CI/CD** | Automated testing | PostgreSQL (ephemeral) | Fresh fixtures per run | GitHub Actions |
| **Staging** | Pre-release validation | PostgreSQL (managed) | Replica production data | QA + Developers |
| **Production** | Live system | PostgreSQL (managed) | Real production data | End users |

**Test Data Strategy**

```
SEED DATA FIXTURES:
  - 3 branches (A, B, C) with complete data
  - 24 doctors (8 per branch) with schedules
  - 50 patient test accounts (created during setup)
  - 10 pre-created bookings (various statuses)
  - 5 completed EMRs (for invoice testing)
  - Audit log seed (100+ historical events for testing queries)

DATA RESET STRATEGY:
  - Unit tests: Use in-memory DB mock (no real DB)
  - Integration tests: Truncate tables before/after each test
  - E2E tests: Isolated test data per scenario (no interference)
  - Staging: Reset nightly, seed fresh fixtures

DATA PRIVACY:
  - Test data: Fictional names (no real personal info)
  - PII handling: Never store real email/phone in test code
  - GDPR compliance: Test data deleted after test suite
  - Production data: Never used for testing (separate DB)
```

---

## 5. DEFECT MANAGEMENT & RESOLUTION

### 5.1 Defect Classification & Severity

**Severity Levels** (Priority Order)

| Severity | Definition | SLA | Example | Action |
|---|---|---|---|---|
| **CRITICAL** | System down, data loss, security breach, payment failure | Fix same day | Webhook handler crashes, multi-tenant leakage | Block release, fix immediately |
| **HIGH** | Major feature broken, affecting core user journey | Fix within 2 days | Check-in validation fails, queue doesn't update | Fix before next release |
| **MEDIUM** | Feature partially broken or workaround available | Fix within 5 days | Minor UI misalignment, sorting incorrect | Document workaround, fix next sprint |
| **LOW** | Cosmetic issue, no functional impact | Fix when time permits | Typo in message, wrong color shade | Track, fix in future release |

**Defect Lifecycle** (GitHub Issues)

```
1. DISCOVERED (During testing)
   └─ Create GitHub Issue with reproduction steps
   └─ Assign severity + priority label
   └─ Assign to developer

2. ASSIGNED (Developer acknowledged)
   └─ Confirm issue (reproduce locally)
   └─ Update issue with root cause analysis
   └─ Estimate fix time
   └─ Move to "In Progress"

3. IN PROGRESS (Developer working on fix)
   └─ Create feature branch: `fix/issue-123-description`
   └─ Implement fix
   └─ Add/update unit test for regression prevention
   └─ Push to GitHub, create Pull Request

4. IN REVIEW (Code review)
   └─ Peer review fix code
   └─ Verify test coverage
   └─ Approve merge

5. VERIFIED (Fix merged & tested)
   └─ Merge PR to main branch
   └─ Run regression tests (automated)
   └─ Manual verification (E2E if applicable)
   └─ Update issue: "Verified fixed in commit ABC123"
   └─ Close issue

6. CLOSED (Complete)
   └─ Categorize: "Fixed" vs "Won't Fix" vs "Duplicate"
   └─ Metrics: Time to resolution tracked
```

### 5.2 Bug Tracking & Metrics

**Metrics to Track**

| Metric | Target | Review Frequency |
|--------|--------|-----------------|
| **Critical bugs** | 0 (post-release) | Daily |
| **High severity bugs** | < 3 (per release) | Daily |
| **Defect escape rate** | < 1% (production) | Per release |
| **Mean Time to Detect (MTTD)** | < 2 hours (during testing) | Weekly |
| **Mean Time to Resolution (MTTR)** | < 24 hours (critical) | Weekly |
| **Bug reopened rate** | < 5% | Monthly |
| **Test case effectiveness** | > 90% (coverage catches regression) | Per release |

---

## 6. TEST DOCUMENTATION & ARTIFACTS

### 6.1 Documentation Checklist

```
[ ] Test case repository complete (Markdown + GitHub)
[ ] Test automation code well-commented (Jest, Playwright)
[ ] Test data setup documented (fixtures, seeding)
[ ] CI/CD pipeline configuration documented (GitHub Actions)
[ ] Bug tracking system populated (GitHub Issues)
[ ] Test execution reports archived (per sprint)
[ ] Performance baseline documented (k6 results, p95 metrics)
[ ] Security test results documented (OWASP ZAP report)
[ ] Coverage report finalized (>70% target achieved)
[ ] UAT sign-off document (manual verification)
[ ] Known issues / limitations documented
[ ] Test-to-requirements traceability matrix completed
```

### 6.2 Test Reporting

**Coverage Report Format** (Published in README.md)

```markdown
## Test Coverage Report

| Module | Unit Tests | Integration Tests | Coverage |
|--------|------------|-------------------|----------|
| AuthService | 12 | 5 | 85% |
| BookingService | 15 | 8 | 80% |
| PaymentService | 10 | 6 | 75% |
| QueueService | 8 | 6 | 78% |
| EMRService | 12 | 8 | 82% |
| InvoiceService | 8 | 5 | 80% |
| AuditService | 10 | 6 | 79% |
| **TOTAL** | **75** | **44** | **79%** |

Target: >70% ✅ ACHIEVED
```

**Defect Summary Report** (Per Release)

```
RELEASE: DentFlow v1.0
DEFECTS FOUND DURING TESTING: 23
DEFECTS FIXED: 23 (100% fix rate)
DEFECTS DEFERRED: 0

BREAKDOWN BY SEVERITY:
  - Critical: 0 (zero critical post-release)
  - High: 3 (all fixed)
  - Medium: 12 (all fixed)
  - Low: 8 (all fixed)

DEFECT ESCAPE RATE: 0% (no bugs found post-release)
```

---

## 7. PRE-RELEASE QA VERIFICATION CHECKLIST

Final verification before deploying to production:

```
FUNCTIONALITY VERIFICATION:
[ ] All P0 features implemented & tested
[ ] All P1 features implemented & tested  
[ ] No critical bugs open
[ ] All test cases P0/P1 passed (100%)
[ ] Manual smoke tests on staging passed
[ ] Release notes reflect all changes

QUALITY VERIFICATION:
[ ] Code coverage ≥ 70%
[ ] No major code quality issues (SonarQube)
[ ] No critical security vulnerabilities
[ ] Dependency audit passed (npm audit)
[ ] Static analysis tools passed

PERFORMANCE VERIFICATION:
[ ] Load test baseline met (50 concurrent users)
[ ] Response time p95 < 200ms confirmed
[ ] Queue WebSocket latency < 2 seconds
[ ] No memory leaks detected (heap snapshot)
[ ] Database query performance acceptable (p95 < 100ms)

SECURITY VERIFICATION:
[ ] Authentication/authorization tests passed (100%)
[ ] Input validation tests passed (OWASP)
[ ] Rate limiting enforced (5 req/sec/IP)
[ ] HTTPS/TLS enforced (all endpoints)
[ ] JWT signature validation verified
[ ] Webhook signature validation verified (Midtrans)
[ ] No hardcoded secrets in code/logs

REGRESSION VERIFICATION:
[ ] Full regression test suite executed (200+ tests)
[ ] Zero regressions detected
[ ] Previous bug fixes verified (not reoccurred)
[ ] Cross-browser compatibility verified (Chrome, Firefox, Safari, Edge)
[ ] Mobile responsiveness verified (iOS, Android)

BACKUP & RECOVERY (DRP VERIFICATION):
[ ] Database backup procedure tested
[ ] Backup restore verified (data integrity)
[ ] Rollback plan tested (< 5 minutes)
[ ] RTO/RPO targets confirmed (< 1 hour / < 1 day)

UAT VERIFICATION:
[ ] UAT scenarios completed (20+ journeys)
[ ] UAT sign-off obtained (manual tester)
[ ] Critical feedback incorporated
[ ] User experience acceptable (no confusing flows)

RELEASE READINESS:
[ ] Deployment runbook prepared (step-by-step)
[ ] Rollback procedure documented (quick rollback)
[ ] Monitoring alerts configured (errors, latency, uptime)
[ ] Communication plan ready (stakeholders informed)
[ ] DNS/SSL certificates verified (HTTPS)
[ ] Environment variables configured (production secrets)
[ ] Database migrations tested (schema upgrade)

SIGN-OFF:
[ ] QA Lead: ________________  Date: _______
[ ] Developer: ________________  Date: _______
[ ] Product Owner: ________________  Date: _______

Release Status: ✅ APPROVED FOR PRODUCTION
```

---

## 8. TEST TOOLS & RESOURCES REFERENCE

| Category | Tool | Version | Purpose | Link |
|----------|------|---------|---------|------|
| **Unit Testing** | Jest | 29+ | Framework for Node.js unit tests | https://jestjs.io |
| **Integration Testing** | Docker Compose | 2.x | Orchestrate test services (PostgreSQL, Redis) | https://docs.docker.com/compose |
| **API Testing** | Postman + Newman | Latest | API contract tests in CI/CD | https://www.postman.com |
| **E2E Testing** | Playwright | 1.40+ | Cross-browser UI automation | https://playwright.dev |
| **Mobile Testing** | Flutter test | 3.x | Flutter widget tests | https://flutter.dev/docs/testing |
| **Performance** | k6 | Latest | Load testing & performance simulation | https://k6.io |
| **Security** | OWASP ZAP | Latest | Automated security scanning | https://www.zaproxy.org |
| **Dependency Scan** | Snyk / npm audit | Latest | CVE detection | https://snyk.io |
| **Code Quality** | SonarQube | Latest | Code analysis & coverage | https://www.sonarqube.org |
| **CI/CD** | GitHub Actions | Latest | Automation platform | https://github.com/features/actions |
| **Monitoring** | Sentry | Latest | Error tracking & APM | https://sentry.io |
| **Metrics** | Prometheus + Grafana | Latest | Monitoring & visualization | https://prometheus.io |
| **Test Reporting** | Codecov | Latest | Coverage tracking | https://codecov.io |
| **Bug Tracking** | GitHub Issues | Latest | Defect management | https://github.com |

---

## 9. KNOWN LIMITATIONS & FUTURE IMPROVEMENTS

**Current Limitations (V1.0)**

- ❌ No SMS notifications (FCM push only for v1)
- ❌ No WhatsApp automation (manual contact only)
- ❌ No multi-language support (Bahasa Indonesia only)
- ❌ No geolocation-based suggestions
- ❌ No Kubernetes deployment (Docker Compose sufficient)
- ❌ No GraphQL API (REST only)
- ❌ No advanced analytics dashboard
- ❌ No insurance integration

**Test Coverage Gaps (Acceptable for MVP)**

- Partial mobile testing (Flutter widget tests only, limited real device testing)
- Limited accessibility testing (WCAG compliance deferred to v2)
- Limited load testing at extreme scale (>500 concurrent, deferred)
- No chaos engineering (resilience under various failure scenarios, deferred)

**Future Improvements (V2.0+)**

- Multi-language support → requires i18n setup + translations
- SMS notifications → Twilio/Nexmo integration + SMS testing
- Advanced analytics → BI dashboard + analytics testing
- Geolocation features → Geospatial testing, maps integration testing
- Kubernetes deployment → K8s testing, Helm chart testing
- GraphQL API → GraphQL schema testing, query testing
- Real-time video consultation → WebRTC testing, latency testing

---

## 10. GLOSSARY & DEFINITIONS

**Testing Terminology**

- **Unit Test**: Test of individual function/method in isolation
- **Integration Test**: Test of multiple components working together
- **E2E Test**: Test of complete user journey from frontend to backend
- **API Contract Test**: Test of API request/response schemas & contracts
- **Regression Test**: Test to verify previous bug fixes still work
- **Smoke Test**: Quick sanity check of critical functionality
- **Performance Test**: Test of response time, throughput, resource usage
- **Security Test**: Test for vulnerabilities, data protection, auth/authz
- **Coverage**: Percentage of code exercised by tests (goal: >70%)
- **Flaky Test**: Test that inconsistently passes/fails without code changes
- **DoD (Definition of Done)**: Criteria that feature must meet before release

**DentFlow-Specific Terminology**

- **Booking**: Patient appointment reservation with payment
- **Check-in**: Admin input of patient's 6-digit code to enter queue
- **Queue**: FIFO order of patients waiting for doctor
- **EMR**: Electronic Medical Record created by doctor after treatment
- **Invoice**: Auto-generated bill after EMR completed
- **Kode Booking**: 6-digit alphanumeric code for check-in
- **Sesi**: Doctor's work session (e.g., 09:00-12:00)
- **Spesialis**: Medical specialty (Sp.BM, Sp.KG, etc)
- **Multi-tenant**: 3 branches (A, B, C) with complete data isolation
- **Audit Log**: Immutable record of all system events (append-only)

---

## 11. APPENDIX: TEST CASE TEMPLATES

### Unit Test Template (Jest)

```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: UserRepository; // Mock

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      updatePassword: jest.fn(),
    } as any;
    authService = new AuthService(userRepository);
  });

  describe('login', () => {
    it('should return JWT token when credentials are valid', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const mockUser = { id: 1, email, password: hashedPassword, role: 'PATIENT' };
      
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result).toHaveProperty('token');
      expect(result.token).toMatch(/^eyJ/); // JWT starts with eyJ
      expect(userRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should throw Unauthorized error when password is invalid', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const mockUser = { id: 1, email, password: 'hashed_correct_password', role: 'PATIENT' };
      
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      // Act & Assert
      await expect(authService.login(email, password)).rejects.toThrow('Unauthorized');
    });
  });
});
```

### Integration Test Template (Jest + Docker)

```typescript
describe('BookingAPI Integration', () => {
  let app: Express;
  let db: Pool;
  let redis: Redis;

  beforeAll(async () => {
    // Setup Docker containers
    app = createApp();
    db = new Pool({ connectionString: process.env.DATABASE_TEST_URL });
    redis = createRedisClient();
    
    // Run migrations
    await runMigrations(db);
  });

  afterEach(async () => {
    // Reset database state
    await db.query('TRUNCATE bookings, queues CASCADE');
    await redis.flushdb();
  });

  describe('POST /api/bookings', () => {
    it('should create booking and queue when all validations pass', async () => {
      // Arrange
      const token = generateTestJWT({ userId: 1, role: 'PATIENT' });
      const bookingData = {
        specialist_id: 'sp.bm',
        doctor_id: 50,
        date: '2026-07-20',
        session_id: 1,
        branch_id: 'A',
      };

      // Act
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(bookingData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('check_in_code');
      expect(response.body.status).toBe('PENDING_PAYMENT');

      // Verify database
      const booking = await db.query('SELECT * FROM bookings WHERE id = $1', [response.body.id]);
      expect(booking.rows).toHaveLength(1);
      expect(booking.rows[0].status).toBe('PENDING_PAYMENT');
    });
  });
});
```

### E2E Test Template (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Booking End-to-End Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Clear browser storage
    await page.context().clearCookies();
  });

  test('should complete full booking flow from landing page', async ({ page }) => {
    // Step 1: Navigate to landing page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Klinik Gigi Terpercaya');

    // Step 2: Click booking CTA
    await page.click('button:has-text("Booking Sekarang")');
    await expect(page).toHaveURL('/patient/login');

    // Step 3: Login (or register if new)
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Step 4: Booking form
    await page.selectOption('select[name="branch"]', 'A');
    await page.selectOption('select[name="specialist"]', 'sp.bm');
    await page.fill('input[name="date"]', '2026-07-20');
    await page.selectOption('select[name="session"]', '1');
    
    // Step 5: Proceed to payment
    await page.click('button:has-text("Lanjutkan ke Pembayaran")');
    await expect(page).toHaveURL(/\/booking\/\d+\/payment/);

    // Step 6: Click pay button
    await page.click('button:has-text("Bayar Sekarang")');
    
    // Step 7: Simulate Midtrans payment (mock)
    await page.waitForURL(/confirmation/);
    await expect(page.locator('text="PEMBAYARAN BERHASIL"')).toBeVisible();
    
    // Step 8: Verify booking confirmation
    const code = await page.locator('text="Kode Booking: "').innerText();
    expect(code).toMatch(/ABC\d{3}[A-Z]{3}/);
  });
});
```

---

## Document Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead / Test Owner | Solo Developer | 2026-07-10 | ✅ Approved |
| Development Lead | Solo Developer | 2026-07-10 | ✅ Approved |
| Product Owner | Solo Developer / Product Manager | 2026-07-10 | ✅ Approved |
| Release Manager | TBD (on release day) | TBD | Pending |

---

**Last Updated**: 2026-07-10  
**Next Review**: 2026-07-20 (Week 2 midpoint)  
**Status**: **ACTIVE** (Testing in progress)  

**Target Coverage**: ≥70% code coverage ✅  
**Portfolio Rating Target**: 9-9.5/10 ✅  
**Release Date**: 2026-08-30 (Week 9)

---

### END OF DENTFLOW v10.0 STP

**🎯 Semua requirements dari PRD v10.0, LOGIC_FLOW, HALAMAN, TDD, dan DRP telah diintegrasikan ke dalam STP ini. Testing strategy 100% sesuai dengan arsitektur Modulith, payment flow Midtrans, multi-tenant isolation, dan semua 15+ audit log event types.**

**✅ STP ini ready untuk development & testing execution.**
