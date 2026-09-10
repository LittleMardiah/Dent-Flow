# TDD (Technical Design Document) - DENTFLOW v10.0
## Sistem Manajemen Klinik Gigi Multi-Cabang (Modular Monolith)

**Project Name:** DentFlow v10.0  
**Author:** Solo Developer / AI Engineer  
**Date:** 2026-07-07  
**Version:** 1.0 (Final, Approved for Development)  
**Target Rating:** 9-9.5/10 untuk Portfolio Internasional  

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Architecture & Project Structure](#3-architecture--project-structure)
4. [Database Design (Complete Schema)](#4-database-design)
5. [API Contract (100% Locked)](#5-api-contract)
6. [Business Logic Flow](#6-business-logic-flow)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Security & Authentication](#8-security--authentication)
9. [Error Handling & Logging](#9-error-handling--logging)
10. [Testing Strategy (Automation)](#10-testing-strategy)
11. [Deployment & Environment](#11-deployment--environment)
12. [Observability & Monitoring](#12-observability--monitoring)
13. [Dependencies & Versioning](#13-dependencies--versioning)
14. [Known Limitations & Future Work](#14-known-limitations--future-work)

---

## 1. Executive Summary

### Problem Being Solved
Klinik gigi 3 cabang dengan 24 dokter mengalami:
- Antrean manual tidak terkelola real-time
- Rekam medis (EMR) tidak terpusat
- Pembayaran masih cash-based
- Check-in process chaos (no operasional control)
- Audit trail tidak terdokumentasikan

### MVP Scope (WAJIB V1.0)
✅ **Booking System** - Online booking dengan payment gateway Midtrans
✅ **Payment Gateway** - Midtrans Sandbox (DP Rp 50.000)
✅ **Check-in System** - Admin input 6-digit kode booking
✅ **Queue Management** - Real-time antrian FIFO per dokter
✅ **TV Queue Display** - Antrian real-time di TV ruang tunggu
✅ **EMR (Electronic Medical Record)** - Dokter input diagnosis & treatment
✅ **Auto-Invoice** - Invoice otomatis saat EMR completed
✅ **Multi-tenant** - 3 cabang dengan complete data isolation
✅ **Audit Log** - Immutable append-only log (Bahasa Indonesia, 15+ event types)
✅ **Admin Dashboard** - Queue, check-in, EMR, payment, stok, invoice management
✅ **Dokter Portal** - Queue, EMR input, patient list, invoice view
✅ **Landing Page** - Public info + AI Smart Chat Support (Gemini)
✅ **Mobile App (Flutter)** - Booking, payment, check-in info, queue view, EMR history
✅ **Role-based Access** - Pasien, Admin, Dokter dengan menu terpisah

### Success Metrics
- **System Uptime:** 99.5% (max 3.6 jam downtime/month)
- **API Response Time:** p95 < 200ms
- **Test Coverage:** >70% (unit + integration)
- **Database Consistency:** 100% ACID compliance
- **Payment Success Rate:** >99% untuk webhook handler
- **Queue Update Latency:** <2 detik (WebSocket broadcast)

### Out of Scope (V1.0 - Defer ke V2+)
- ❌ Geolocation-based appointment suggestion
- ❌ WhatsApp integration (manual contact only)
- ❌ SMS notifications (FCM push only)
- ❌ Multi-language support (Bahasa Indonesia only)
- ❌ Insurance integration
- ❌ Advanced analytics / business intelligence
- ❌ Kubernetes orchestration (Docker Compose only)
- ❌ GraphQL API (REST only)

---

## 2. Technology Stack

### Backend
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Language** | Node.js (TypeScript) | 18.x LTS | Fast development, event-driven natural, single language across stack |
| **Framework** | Express.js | 4.18+ | Minimal, mature, large ecosystem, middleware-based |
| **Package Manager** | npm / pnpm | Latest | pnpm faster, lock files consistent |
| **Runtime** | Node.js with tsx / ts-node | 18.x+ | TypeScript support for development |

### Frontend
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Web Framework** | Next.js | 14+ (App Router) | SSR/SSG, built-in routing, Vercel deployment |
| **UI Framework** | React | 18+ | Component-based, large ecosystem |
| **Styling** | Tailwind CSS | 3.x | Utility-first, responsive, performance |
| **Forms** | React Hook Form | 7+ | Minimal re-renders, excellent validation |
| **UI Components** | shadcn/ui (optional) | Latest | Pre-built accessible components |

### Mobile
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Framework** | Flutter | 3.x | Single codebase Android/iOS, real-time ready |
| **State Management** | Riverpod / Provider | Latest | Reactive, testable, scalable |
| **HTTP Client** | Dio | 5.x | Interceptors, retry logic, built-in |
| **Local Storage** | Hive / SharedPreferences | Latest | Encrypted, fast, offline support |
| **Notifications** | Firebase Cloud Messaging | Latest | Push notifications, cross-platform |

### Database & Cache
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Primary DB** | PostgreSQL | 15+ | ACID, JSON support, full-text search capable |
| **Cache** | Redis | 7+ | Session, rate-limit counters, queue management |
| **File Storage** | MinIO | Latest | S3-compatible, self-hosted, EMR documents |
| **Message Queue** | RabbitMQ | 3.12+ | Event-driven, async tasks, payment processing |

### Infrastructure & DevOps
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **Containerization** | Docker | 24+ | Consistency dev→prod |
| **Orchestration** | Docker Compose | 2.x | Local dev + simple VPS deployment |
| **CI/CD** | GitHub Actions | Latest | Free for public repos, easy integration |
| **Hosting (Backend)** | Render.com / Railway.app | - | PaaS, auto-deploys, PostgreSQL managed |
| **Hosting (Frontend)** | Vercel | - | Optimized for Next.js, CDN-backed |
| **Logging** | Pino + Sentry | Latest | Structured logging, error tracking |
| **Monitoring** | Prometheus + Grafana (optional) | Latest | Metrics, dashboards, alerting |

### External Services
| Service | Provider | Purpose | Why |
|---------|----------|---------|-----|
| **Payment Gateway** | Midtrans (Sandbox) | DP confirmation (Rp 50.000) | Official Indonesia payment provider, sandbox available |
| **Push Notifications** | Firebase Cloud Messaging | Real-time alerts | Cross-platform, reliable, free tier sufficient |
| **AI Chat** | Google Gemini API | Smart FAQ chatbot | Free tier (60 req/min), no cost for MVP |
| **Email** | Resend / SendGrid | Password reset, notifications | Reliable delivery, webhook support |
| **SMS (Future)** | Twilio / Nexmo | SMS optional V2 | Not in V1 scope |

---

## 3. Architecture & Project Structure

### Architecture Pattern: Modular Monolith with Clean Architecture

```
DENTFLOW v10.0 Architecture:

┌─────────────────────────────────────────────────────────────┐
│ FRONTEND LAYER (Web + Mobile)                               │
│ ┌──────────────────┬──────────────────┬─────────────────┐  │
│ │ Next.js Web      │ Flutter App      │ TV Display App  │  │
│ │ (Admin+Dokter+   │ (Pasien)         │ (Real-time      │  │
│ │ Pasien Landing)  │                  │ Queue Display)  │  │
│ └──────────────────┴──────────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│ API GATEWAY & MIDDLEWARE LAYER                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Rate Limiting | Auth (JWT) | CORS | Request Logging   │  │
│ │ Error Handling | Request Validation                    │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (Express.js + TypeScript)              │
│ ┌──────────────┬──────────────┬──────────────────┐          │
│ │ HTTP Router  │ Handlers     │ Middleware       │          │
│ │ (Routes)     │ (Request)    │ (Auth, Validation)         │
│ └──────────────┴──────────────┴──────────────────┘          │
│                         ↓                                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ SERVICE LAYER (Business Logic)                       │   │
│ │ - BookingService    - AuthService      - AdminService   │
│ │ - PaymentService    - QueueService     - EMRService     │
│ │ - InvoiceService    - AuditService     - DoctorService  │
│ └──────────────────────────────────────────────────────┘   │
│                         ↓                                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ REPOSITORY LAYER (Data Access)                       │   │
│ │ - UserRepository    - BookingRepository              │   │
│ │ - QueueRepository   - AuditRepository                │   │
│ │ - PaymentRepository - EMRRepository                  │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↓ SQL          ↓ Cache        ↓ Events      ↓ Files
┌────────────┬────────────────┬──────────────┬─────────────┐
│ PostgreSQL │    Redis       │  RabbitMQ    │   MinIO     │
│ (Primary   │    (Queue &    │  (Event-     │ (File       │
│  Database) │    Sessions)   │   driven)    │  Storage)   │
└────────────┴────────────────┴──────────────┴─────────────┘
```

### Backend Folder Structure

```
backend/
├── src/
│   ├── app.ts                          # Express setup
│   ├── config/
│   │   ├── database.ts                # PostgreSQL connection pool
│   │   ├── redis.ts                   # Redis client
│   │   ├── rabbitmq.ts                # RabbitMQ connection (optional)
│   │   ├── minio.ts                   # MinIO client
│   │   └── env.ts                     # Environment variables
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts         # JWT validation
│   │   ├── cors.middleware.ts         # CORS headers
│   │   ├── errorHandler.ts            # Global error handler
│   │   ├── requestLogger.ts           # Pino request logging
│   │   ├── rateLimit.middleware.ts    # Rate limiting (5 req/sec/IP)
│   │   └── validation.middleware.ts   # Request body validation
│   │
│   ├── routes/
│   │   ├── auth.routes.ts             # POST /auth/* endpoints
│   │   ├── patient.routes.ts          # Patient booking, history
│   │   ├── admin.routes.ts            # Admin dashboard
│   │   ├── doctor.routes.ts           # Doctor EMR, queue
│   │   ├── queue.routes.ts            # Real-time queue (WebSocket)
│   │   ├── payment.routes.ts          # Payment & webhook
│   │   ├── public.routes.ts           # Landing page data
│   │   └── tv.routes.ts               # TV display API
│   │
│   ├── handlers/                      # HTTP request handlers
│   │   ├── auth.handler.ts
│   │   ├── booking.handler.ts
│   │   ├── checkin.handler.ts
│   │   ├── queue.handler.ts
│   │   ├── payment.handler.ts
│   │   ├── emr.handler.ts
│   │   ├── invoice.handler.ts
│   │   ├── admin.handler.ts
│   │   └── public.handler.ts
│   │
│   ├── services/                      # Business logic
│   │   ├── auth.service.ts
│   │   ├── booking.service.ts
│   │   ├── payment.service.ts
│   │   ├── queue.service.ts
│   │   ├── checkin.service.ts
│   │   ├── emr.service.ts
│   │   ├── invoice.service.ts
│   │   ├── audit.service.ts
│   │   ├── doctor.service.ts
│   │   └── admin.service.ts
│   │
│   ├── repositories/                  # Database access
│   │   ├── user.repository.ts
│   │   ├── booking.repository.ts
│   │   ├── queue.repository.ts
│   │   ├── payment.repository.ts
│   │   ├── emr.repository.ts
│   │   ├── invoice.repository.ts
│   │   ├── audit.repository.ts
│   │   ├── doctor.repository.ts
│   │   └── schedule.repository.ts
│   │
│   ├── models/                        # Domain models & types
│   │   ├── user.model.ts
│   │   ├── booking.model.ts
│   │   ├── queue.model.ts
│   │   ├── payment.model.ts
│   │   ├── emr.model.ts
│   │   ├── invoice.model.ts
│   │   ├── audit.model.ts
│   │   └── error.model.ts
│   │
│   ├── utils/
│   │   ├── jwt.util.ts                # JWT creation/verification
│   │   ├── hash.util.ts               # Bcrypt password hashing
│   │   ├── validator.util.ts          # Input validation
│   │   ├── errorCode.util.ts          # Standardized error codes
│   │   ├── idempotency.util.ts        # Idempotency key handling
│   │   ├── pagination.util.ts         # Pagination helpers
│   │   └── logger.util.ts             # Structured logging
│   │
│   ├── constants/
│   │   ├── errorMessages.ts           # Error messages (Indonesia)
│   │   ├── eventTypes.ts              # Audit event types (15+)
│   │   ├── roles.ts                   # User roles: PATIENT, ADMIN, DOCTOR
│   │   ├── bookingStatus.ts           # PENDING_PAYMENT, PAYMENT_CONFIRMED, etc
│   │   └── queueStatus.ts             # WAITING, BEING_CALLED, COMPLETED
│   │
│   ├── database/
│   │   ├── schema.ts                  # Database schema definition
│   │   └── migrations/                # SQL migration files
│   │       ├── 001_init_schema.sql
│   │       ├── 002_add_audit_log.sql
│   │       └── ...
│   │
│   └── index.ts                       # Entry point
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── auth.service.test.ts
│   │   │   ├── booking.service.test.ts
│   │   │   ├── payment.service.test.ts
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── jwt.util.test.ts
│   │   │   └── hash.util.test.ts
│   │   └── validators/
│   │       └── input.validator.test.ts
│   │
│   ├── integration/
│   │   ├── auth.integration.test.ts
│   │   ├── booking.integration.test.ts
│   │   ├── payment.integration.test.ts
│   │   ├── checkin.integration.test.ts
│   │   ├── queue.integration.test.ts
│   │   ├── emr.integration.test.ts
│   │   └── invoice.integration.test.ts
│   │
│   ├── e2e/                           # End-to-end scenarios
│   │   ├── booking_to_payment.e2e.ts
│   │   ├── checkin_to_queue.e2e.ts
│   │   └── emr_to_invoice.e2e.ts
│   │
│   └── fixtures/
│       ├── seed.sql                  # Test data
│       └── mock-midtrans.ts          # Mock payment gateway
│
├── docs/
│   ├── API.md                        # Full OpenAPI reference
│   ├── DATABASE.md                   # Schema & ER diagram
│   ├── DEPLOYMENT.md                 # Deployment guide
│   └── TESTING.md                    # Testing guide
│
├── .env.example                      # Environment template
├── .env.test                         # Test environment
├── docker-compose.yml                # Local dev stack
├── Dockerfile                        # Production image
├── package.json
├── tsconfig.json
├── jest.config.js                    # Testing framework config
└── README.md
```

---

## 4. Database Design

### Overview
- **Primary Key Strategy:** UUID (not auto-increment)
- **Soft Delete:** Yes, using `deleted_at` timestamp (nullable)
- **Timestamps:** All tables have `created_at`, `updated_at`
- **Audit Trail:** Immutable `audit_logs` table (append-only)
- **Multi-tenant:** Every table with `branch_id` (A, B, C)
- **Row-level Security:** Admin only sees data for their branch

### Complete Schema (SQL DDL)

```sql
-- ====================================================================
-- 1. USERS TABLE (Pasien, Admin, Dokter)
-- ====================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Identity
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Role-based
    role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
    
    -- Doctor-specific fields
    doctor_specialization VARCHAR(50),  -- Sp.BM, Sp.KG, etc
    doctor_license_number VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    
    -- Patient-specific fields (Walk-in support)
    patient_type VARCHAR(30) CHECK (patient_type IN ('REGISTERED', 'WALK_IN', 'WALK_IN_RECURRING')) DEFAULT 'REGISTERED',
    converted_at TIMESTAMP,  -- When walk-in converted to registered
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT check_doctor_fields CHECK (
        (role = 'DOCTOR' AND doctor_specialization IS NOT NULL)
        OR role != 'DOCTOR'
    ),
    CONSTRAINT check_patient_type CHECK (
        (role = 'PATIENT' AND patient_type IS NOT NULL)
        OR role != 'PATIENT'
    )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_branch_id_role ON users(branch_id, role);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ====================================================================
-- 2. BOOKINGS TABLE (Booking + Payment Status + Queue Number)
-- ====================================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    pasien_id UUID NOT NULL REFERENCES users(id),
    dokter_id UUID NOT NULL REFERENCES users(id),
    jadwal_id UUID NOT NULL,  -- Reference to schedule
    
    -- Booking details
    check_in_code VARCHAR(10) NOT NULL UNIQUE,  -- 6-digit alphanumeric
    booking_date DATE NOT NULL,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP NOT NULL,
    
    -- Booking status flow: PENDING_PAYMENT → PAYMENT_CONFIRMED → CHECKED_IN → COMPLETED / NO_SHOW / CANCELLED
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'CHECKED_IN', 
        'COMPLETED', 'NO_SHOW', 'CANCELLED'
    )),
    
    -- Payment
    payment_status VARCHAR(30) CHECK (payment_status IN (
        'PENDING', 'CONFIRMED', 'FAILED'
    )),
    dp_amount DECIMAL(10, 2) DEFAULT 50000,  -- Rp 50.000
    payment_gateway_id VARCHAR(255),  -- Midtrans transaction ID
    payment_confirmed_at TIMESTAMP,
    
    -- Check-in
    checked_in_at TIMESTAMP,
    queue_number INTEGER,  -- Assigned at check-in
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_bookings_pasien_id ON bookings(pasien_id);
CREATE INDEX idx_bookings_dokter_id ON bookings(dokter_id);
CREATE INDEX idx_bookings_branch_id_status ON bookings(branch_id, status);
CREATE INDEX idx_bookings_check_in_code ON bookings(check_in_code);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_deleted_at ON bookings(deleted_at);

-- ====================================================================
-- 3. DOCTOR SCHEDULES TABLE
-- ====================================================================
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    dokter_id UUID NOT NULL REFERENCES users(id),
    
    -- Schedule
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, etc
    session_start TIME NOT NULL,  -- 09:00
    session_end TIME NOT NULL,    -- 12:00
    max_patients_per_session INTEGER DEFAULT 4,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_schedules_dokter_id ON doctor_schedules(dokter_id);
CREATE INDEX idx_schedules_branch_id ON doctor_schedules(branch_id);
CREATE INDEX idx_schedules_day_of_week ON doctor_schedules(day_of_week);

-- ====================================================================
-- 4. QUEUE TABLE (Real-time Queue Management)
-- ====================================================================
CREATE TABLE queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    booking_id UUID NOT NULL REFERENCES bookings(id),
    dokter_id UUID NOT NULL REFERENCES users(id),
    
    -- Queue info
    queue_number INTEGER NOT NULL,  -- 01, 02, 03, etc
    queue_date DATE NOT NULL,
    
    -- Queue status: WAITING → BEING_CALLED → COMPLETED
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'WAITING', 'BEING_CALLED', 'COMPLETED'
    )),
    
    -- Timestamps
    check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_queues_dokter_id_queue_date ON queues(dokter_id, queue_date);
CREATE INDEX idx_queues_branch_id_queue_date ON queues(branch_id, queue_date);
CREATE INDEX idx_queues_status ON queues(status);
CREATE INDEX idx_queues_booking_id ON queues(booking_id);

-- ====================================================================
-- 5. EMR TABLE (Electronic Medical Record)
-- ====================================================================
CREATE TABLE emr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE,
    pasien_id UUID NOT NULL REFERENCES users(id),
    dokter_id UUID NOT NULL REFERENCES users(id),
    
    -- Medical info
    complaint TEXT NOT NULL,  -- Keluhan
    treatment TEXT NOT NULL,  -- Tindakan (dropdown + text)
    diagnosis TEXT,           -- Diagnosa (hidden from pasien)
    prescription TEXT,        -- Resep/Anjuran
    notes TEXT,              -- Internal notes
    
    -- Material/stok tracking (optional, notes only)
    materials_used TEXT,
    
    -- Status: DRAFT → COMPLETED (trigger invoice generation)
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED')),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_emr_booking_id ON emr(booking_id);
CREATE INDEX idx_emr_pasien_id ON emr(pasien_id);
CREATE INDEX idx_emr_dokter_id ON emr(dokter_id);
CREATE INDEX idx_emr_status ON emr(status);

-- ====================================================================
-- 6. INVOICES TABLE (Auto-generated from EMR completion)
-- ====================================================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    booking_id UUID NOT NULL REFERENCES bookings(id),
    emr_id UUID NOT NULL REFERENCES emr(id),
    pasien_id UUID NOT NULL REFERENCES users(id),
    
    -- Invoice details
    invoice_number VARCHAR(50) NOT NULL UNIQUE,  -- Format: INV-A-20260708-001
    invoice_date DATE NOT NULL,
    
    -- Costs
    dp_amount DECIMAL(10, 2) NOT NULL DEFAULT 50000,  -- DP Rp 50.000
    treatment_cost DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Payment tracking
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN (
        'UNPAID', 'PAID'
    )) DEFAULT 'UNPAID',
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH', 'TRANSFER')),
    paid_at TIMESTAMP,
    paid_amount DECIMAL(10, 2),
    paid_by_admin_id UUID REFERENCES users(id),  -- Track manual payments
    payment_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- State machine constraints: PAID must have paid_at + paid_amount
    CONSTRAINT valid_paid_state CHECK (
        (payment_status = 'UNPAID' AND paid_at IS NULL AND paid_amount IS NULL)
        OR
        (payment_status = 'PAID' AND paid_at IS NOT NULL AND paid_amount IS NOT NULL)
    ),
    CONSTRAINT paid_amount_valid CHECK (
        paid_amount IS NULL OR paid_amount > 0
    )
);

CREATE INDEX idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX idx_invoices_pasien_id ON invoices(pasien_id);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);

-- ====================================================================
-- 7. PAYMENTS TABLE (Payment tracking & reconciliation)
-- ====================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Relations
    booking_id UUID NOT NULL REFERENCES bookings(id),
    invoice_id UUID REFERENCES invoices(id),
    
    -- Payment info
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN (
        'GATEWAY', 'CASH', 'TRANSFER'
    )),
    gateway_provider VARCHAR(50),  -- midtrans, etc
    gateway_transaction_id VARCHAR(255),
    
    -- Amount
    amount_paid DECIMAL(10, 2) NOT NULL,
    
    -- Status: PENDING, COMPLETED, FAILED
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'PENDING', 'COMPLETED', 'FAILED'
    )),
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_gateway_transaction_id ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ====================================================================
-- 8. AUDIT_LOGS TABLE (Immutable, Append-only)
-- ====================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Actor
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(20),
    
    -- Event
    event_type VARCHAR(50) NOT NULL,  -- BOOKING_CREATED, PAYMENT_CONFIRMED, CHECK_IN_SUCCESS, etc (15+ types)
    entity_type VARCHAR(50),  -- users, bookings, queues, emr, invoices
    entity_id UUID,
    
    -- Details (JSON for flexibility)
    changes JSONB,  -- {old_value, new_value}
    metadata JSONB,  -- Additional context
    
    -- Status
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamps (immutable, no UPDATE)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity_type_entity_id ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_branch_id ON audit_logs(branch_id);

-- ====================================================================
-- 9. INVENTORY TABLE (Stok - Admin only, not for Dokter)
-- ====================================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    unit VARCHAR(20),  -- pcs, box, tube, etc
    
    -- Stock tracking
    quantity_in_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER,
    
    -- Pricing (optional)
    unit_cost DECIMAL(10, 2),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_inventory_item_code ON inventory(item_code);

-- ====================================================================
-- 10. PAYMENT_GATEWAY_WEBHOOKS TABLE (For idempotency & retry tracking)
-- ====================================================================
CREATE TABLE payment_gateway_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Webhook metadata
    provider VARCHAR(50) NOT NULL,  -- midtrans
    gateway_webhook_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Webhook data
    order_id VARCHAR(255) NOT NULL,
    transaction_status VARCHAR(50),
    signature_key VARCHAR(255),
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Raw payload (for debugging)
    payload JSONB,
    
    -- Timestamps
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_order_id ON payment_gateway_webhooks(order_id);
CREATE INDEX idx_webhooks_processed ON payment_gateway_webhooks(processed);
CREATE INDEX idx_webhooks_received_at ON payment_gateway_webhooks(received_at);

-- ====================================================================
-- 10.1 INVOICE SEQUENCES TABLE (Atomic counter for invoice numbering)
-- ====================================================================
CREATE TABLE invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    sequence_date DATE NOT NULL,
    
    -- Atomic sequence counter
    current_sequence INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one row per branch per day
    UNIQUE(branch_id, sequence_date)
);

CREATE INDEX idx_invoice_sequences_branch_date ON invoice_sequences(branch_id, sequence_date);

-- PostgreSQL Function: Atomic invoice number generation
CREATE OR REPLACE FUNCTION get_next_invoice_number(
    p_branch_id VARCHAR(1),
    p_invoice_date DATE
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_sequence INTEGER;
    v_invoice_number VARCHAR(50);
BEGIN
    -- Atomic increment: INSERT if not exists, UPDATE and RETURN sequence
    INSERT INTO invoice_sequences (branch_id, sequence_date, current_sequence)
    VALUES (p_branch_id, p_invoice_date, 1)
    ON CONFLICT (branch_id, sequence_date)
    DO UPDATE SET current_sequence = invoice_sequences.current_sequence + 1
    RETURNING current_sequence INTO v_sequence;
    
    -- Format: INV-{BRANCH}-{YYYYMMDD}-{SEQ}
    -- Example: INV-A-20260710-001
    v_invoice_number := 'INV-' || p_branch_id || '-' || TO_CHAR(p_invoice_date, 'YYYYMMDD') || '-' || LPAD(v_sequence::TEXT, 3, '0');
    
    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 11. SESSIONS TABLE (JWT token blacklist / session management)
-- ====================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Session metadata
    device_info TEXT,
    ip_address VARCHAR(50),
    
    -- Token tracking
    refresh_token_hash VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ====================================================================
-- VIEWS FOR COMMON QUERIES
-- ====================================================================

-- View: Current queue status per dokter
CREATE VIEW v_queue_status AS
SELECT 
    q.branch_id,
    q.dokter_id,
    u.full_name AS dokter_name,
    u.doctor_specialization,
    q.queue_date,
    STRING_AGG(q.queue_number::text, ', ' ORDER BY q.queue_number) AS queue_numbers,
    COUNT(*) AS total_waiting
FROM queues q
JOIN users u ON q.dokter_id = u.id
WHERE q.status IN ('WAITING', 'BEING_CALLED') AND q.deleted_at IS NULL
GROUP BY q.branch_id, q.dokter_id, u.full_name, u.doctor_specialization, q.queue_date;

-- View: Unpaid invoices per branch
CREATE VIEW v_unpaid_invoices AS
SELECT 
    i.id,
    i.invoice_number,
    i.branch_id,
    i.pasien_id,
    u.full_name AS pasien_name,
    i.total_amount,
    i.invoice_date,
    CURRENT_DATE - i.invoice_date AS days_overdue
FROM invoices i
JOIN users u ON i.pasien_id = u.id
WHERE i.payment_status = 'UNPAID' AND i.deleted_at IS NULL
ORDER BY i.invoice_date;
```

### Key Constraints & Business Rules
1. **Branch Isolation:** Every query must filter by `WHERE branch_id = ?`
2. **Booking Status Flow:** PENDING_PAYMENT → PAYMENT_CONFIRMED → CHECKED_IN → COMPLETED/NO_SHOW/CANCELLED
3. **Check-in Code:** 6-digit alphanumeric, UNIQUE, generated at booking, valid only for specific session
4. **Queue Number:** Generated at check-in using Redis atomic INCR, unique per dokter per day
5. **EMR Completion:** Triggers auto-invoice generation
6. **Audit Logs:** Append-only, no UPDATE/DELETE allowed
7. **Multi-tenant:** Strict row-level security via branch_id in every query

---

## 5. API Contract (100% Locked)

### API Standards
- **Protocol:** HTTP/REST over HTTPS
- **Format:** JSON (request & response)
- **Versioning:** No version prefix (v1 implied in path)
- **Base URL:** `https://api.dentflow.io` (production) or `http://localhost:3001` (development)
- **Response Wrapper:**
```json
{
  "success": true,
  "data": {},
  "message": "Success message (optional)",
  "error": null,
  "timestamp": "2026-07-08T10:30:00Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "data": null,
  "message": "User-friendly message in Bahasa Indonesia",
  "error": {
    "code": "INVALID_EMAIL_FORMAT",
    "details": "Additional details (optional)",
    "timestamp": "2026-07-08T10:30:00Z"
  }
}
```

### HTTP Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created
- `204 No Content` - Successful, no response body
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid auth token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate booking code)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `502 Bad Gateway` - External service error
- `503 Service Unavailable` - Maintenance

### Authentication
- **Method:** Bearer Token (JWT)
- **Header:** `Authorization: Bearer <token>`
- **Token Expiry:** 24 hours
- **Refresh Token:** 30 days
- **Storage:** httpOnly cookies (secure, not accessible via JS)
- **Algorithm:** HS256 (HMAC with SHA-256)

### Endpoints (COMPLETE & 100% LOCKED)

#### 1. AUTH ENDPOINTS

##### 1.1 Patient Registration
```
POST /api/auth/register/patient
Content-Type: application/json

REQUEST:
{
  "email": "john@gmail.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "phone_number": "+6281234567890"
}

RESPONSE (201 Created):
{
  "success": true,
  "data": {
    "id": "uuid-user-id",
    "email": "john@gmail.com",
    "full_name": "John Doe",
    "role": "PATIENT",
    "created_at": "2026-07-08T10:30:00Z"
  },
  "message": "Akun pasien berhasil dibuat. Silakan login."
}

ERRORS:
- 400: Email sudah terdaftar
- 422: Password terlalu lemah / Email format invalid
```

##### 1.2 Admin Login
```
POST /api/auth/login/admin
Content-Type: application/json

REQUEST:
{
  "username": "admin_cabang_a",
  "password": "AdminPass123!",
  "branch_id": "A"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-admin-id",
      "full_name": "Admin Cabang A",
      "role": "ADMIN",
      "branch_id": "A"
    },
    "expires_in": 86400
  }
}

ERRORS:
- 401: Username atau password salah
- 403: Admin tidak aktif
```

##### 1.3 Doctor Login
```
POST /api/auth/login/doctor
Content-Type: application/json

REQUEST:
{
  "username": "dr_bm_cabanga",  -- Format: dr_spesialisasi_cabang
  "password": "DoctorPass123!",
  "branch_id": "A"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-doctor-id",
      "full_name": "drg. Siti Nurhaliza",
      "role": "DOCTOR",
      "specialization": "Sp.BM",
      "branch_id": "A"
    }
  }
}

ERRORS:
- 401: Username atau password salah
```

##### 1.4 Patient Login
```
POST /api/auth/login/patient
Content-Type: application/json

REQUEST:
{
  "email": "john@gmail.com",
  "password": "SecurePass123!"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-patient-id",
      "email": "john@gmail.com",
      "full_name": "John Doe",
      "role": "PATIENT"
    }
  }
}

ERRORS:
- 401: Email atau password salah
- 429: Terlalu banyak percobaan login
```

##### 1.5 Forgot Password
```
POST /api/auth/forgot-password
Content-Type: application/json

REQUEST:
{
  "email": "john@gmail.com"
}

RESPONSE (200 OK):
{
  "success": true,
  "message": "Email reset password telah dikirim ke john@gmail.com"
}

ERRORS:
- 404: Email tidak ditemukan
- 429: Terlalu banyak percobaan reset
```

##### 1.6 Reset Password (via link)
```
POST /api/auth/reset-password
Content-Type: application/json

REQUEST:
{
  "reset_token": "eyJhbGciOiJIUzI1NiIs...",
  "new_password": "NewSecurePass123!"
}

RESPONSE (200 OK):
{
  "success": true,
  "message": "Password berhasil direset"
}

ERRORS:
- 400: Reset token tidak valid atau sudah expired
- 422: Password tidak memenuhi kriteria
```

##### 1.7 Refresh Token
```
POST /api/auth/refresh
Authorization: Bearer <refresh_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400
  }
}

ERRORS:
- 401: Refresh token invalid atau expired
```

##### 1.8 Logout
```
POST /api/auth/logout
Authorization: Bearer <access_token>

RESPONSE (200 OK):
{
  "success": true,
  "message": "Logout berhasil"
}
```

---

#### 2. BOOKING ENDPOINTS (Patient)

##### 2.1 Get Available Slots
```
GET /api/patient/bookings/available-slots?branch_id=A&doctor_id=uuid&date=2026-07-10
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "available_slots": [
      {
        "slot_id": "uuid-slot-1",
        "session_start": "2026-07-10T09:00:00Z",
        "session_end": "2026-07-10T12:00:00Z",
        "available_spots": 3,
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM"
      },
      {
        "slot_id": "uuid-slot-2",
        "session_start": "2026-07-10T13:00:00Z",
        "session_end": "2026-07-10T16:00:00Z",
        "available_spots": 4,
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM"
      }
    ]
  }
}

ERRORS:
- 400: Parameter tidak valid
- 404: Dokter atau cabang tidak ditemukan
```

##### 2.2 Create Booking
```
POST /api/patient/bookings
Authorization: Bearer <patient_token>
Content-Type: application/json

REQUEST:
{
  "branch_id": "A",
  "doctor_id": "uuid-doctor",
  "session_slot_id": "uuid-slot-1",
  "booking_date": "2026-07-10"
}

RESPONSE (201 Created):
{
  "success": true,
  "data": {
    "id": "uuid-booking",
    "check_in_code": "ABC123",
    "status": "PENDING_PAYMENT",
    "dp_amount": 50000,
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "branch_name": "Cabang A",
    "session_start": "2026-07-10T09:00:00Z",
    "session_end": "2026-07-10T12:00:00Z",
    "payment_url": "https://pay.midtrans.com/...",
    "created_at": "2026-07-08T10:30:00Z"
  },
  "message": "Booking berhasil dibuat. Silakan lanjut ke pembayaran."
}

ERRORS:
- 400: Slot sudah penuh / Jadwal tidak valid
- 409: Booking duplikat (pasien sudah booking di jam yang sama)
- 422: Validasi input gagal
```

##### 2.3 Get Booking Details
```
GET /api/patient/bookings/{booking_id}
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-booking",
    "check_in_code": "ABC123",
    "status": "PAYMENT_CONFIRMED",
    "payment_status": "CONFIRMED",
    "dp_amount": 50000,
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "branch_name": "Cabang A",
    "session_start": "2026-07-10T09:00:00Z",
    "session_end": "2026-07-10T12:00:00Z",
    "queue_number": null,
    "created_at": "2026-07-08T10:30:00Z",
    "payment_confirmed_at": "2026-07-08T10:35:00Z"
  }
}

ERRORS:
- 404: Booking tidak ditemukan
- 403: Pasien tidak punya akses ke booking ini
```

##### 2.4 Cancel Booking
```
POST /api/patient/bookings/{booking_id}/cancel
Authorization: Bearer <patient_token>
Content-Type: application/json

REQUEST:
{
  "reason": "Jadwal bentrok"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-booking",
    "status": "CANCELLED",
    "message": "DP Anda tidak akan dikembalikan (non-refundable)"
  }
}

ERRORS:
- 400: Booking sudah selesai / tidak bisa dibatalkan
- 404: Booking tidak ditemukan
```

##### 2.5 List Bookings (Patient)
```
GET /api/patient/bookings?status=PAYMENT_CONFIRMED&page=1&limit=10
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "uuid-booking-1",
        "check_in_code": "ABC123",
        "status": "PAYMENT_CONFIRMED",
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM",
        "session_start": "2026-07-10T09:00:00Z",
        "branch_name": "Cabang A",
        "created_at": "2026-07-08T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
}
```

---

#### 3. PAYMENT ENDPOINTS

##### 3.1 Get Payment Redirect URL
```
POST /api/payments/redirect
Authorization: Bearer <patient_token>
Content-Type: application/json

REQUEST:
{
  "booking_id": "uuid-booking"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "redirect_url": "https://app.midtrans.com/snap/pay/...",
    "transaction_id": "TXN-123456"
  }
}

ERRORS:
- 404: Booking tidak ditemukan
- 409: Booking sudah dibayar
```

##### 3.2 Check Payment Status
```
GET /api/payments/status/{booking_id}
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "booking_id": "uuid-booking",
    "status": "PAYMENT_CONFIRMED",
    "payment_status": "CONFIRMED",
    "dp_amount": 50000,
    "payment_confirmed_at": "2026-07-08T10:35:00Z",
    "transaction_id": "TXN-123456"
  }
}

ERRORS:
- 404: Booking tidak ditemukan
```

##### 3.3 Webhook - Payment Confirmation (Midtrans) - WITH RETRY STRATEGY
```
POST /api/webhook/payment-confirmation
Content-Type: application/json
(No Authorization header - Midtrans sends this)

REQUEST:
{
  "transaction_id": "TXN-123456",
  "order_id": "uuid-booking",
  "status_code": "200",
  "transaction_status": "settlement",
  "fraud_status": "accept",
  "signature_key": "hash...",
  "timestamp": "2026-07-08T10:35:00Z"
}

RESPONSE (200 OK):
{
  "success": true,
  "message": "Webhook processed successfully"
}

INTERNAL LOGIC (ATOMIC TRANSACTION):
1. Extract: order_id, transaction_status, signature_key, timestamp
2. Store webhook in payment_gateway_webhooks table (for idempotency)
   - Check IF gateway_webhook_id exists (duplicate detection)
   - Check IF order_id + timestamp already processed (prevent double-process)
   - Mark as processed immediately (atomic operation)
3. Generate expected_signature using Midtrans server_key
4. IF signature_key != expected_signature:
   - Log error to audit log
   - Return 403 Forbidden (security issue - potential tampering)
   - ALERT admin (signature mismatch event)
5. ELSE: Signature valid, proceed to database update
6. Fetch booking by order_id
7. IF booking NOT found:
   - Log error
   - Return 404 (Midtrans will retry - see RETRY STRATEGY)
8. IF booking.status != PENDING_PAYMENT:
   - Skip update (idempotent - webhook already processed before)
   - Mark webhook as processed
   - Return 200 OK (success)
9. IF booking.status == PENDING_PAYMENT:
   - BEGIN ATOMIC TRANSACTION
   - Update booking.status → PAYMENT_CONFIRMED
   - Update booking.payment_confirmed_at = NOW()
   - Create payment record (payment_method: GATEWAY, amount: dp_amount)
   - Mark webhook as processed in payment_gateway_webhooks
   - END TRANSACTION
10. ON DATABASE ERROR (timeout, constraint violation, etc):
    - Rollback transaction
    - Return 500 Internal Server Error
    - Midtrans will retry webhook (max 3 retries with exponential backoff)
11. ON SUCCESS:
    - Broadcast WebSocket event to admin dashboard (payment confirmed)
    - Send FCM push to pasien (Pembayaran Berhasil!)
    - Log audit event: PAYMENT_CONFIRMED
12. Return 200 OK to Midtrans (final confirmation)

REQUEST VALIDATION:
- transaction_id: must not be empty
- order_id: must be valid UUID (booking_id)
- transaction_status: must be one of (settlement, capture, pending, deny, expire)
- signature_key: must match Midtrans server_key calculation

RETRY STRATEGY (Midtrans → Our Backend):
- Midtrans retries webhook delivery 3 times with exponential backoff
- Attempt 1: Immediate
- Attempt 2: 5 seconds
- Attempt 3: 10 seconds
- Midtrans timeout per request: 30 seconds (our processing must be < 5s)
- Our backend MUST handle transient failures gracefully:
  - 500 errors → Midtrans will retry
  - Database locks → Midtrans will retry
  - Network timeouts → Midtrans will retry
- If still failing after 3 Midtrans retries:
  - Admin manual recovery via dashboard (see Section 3.4)
  - Cron job checks for orphaned payments (see Cron Jobs section)

FAILURE RECOVERY (Cron Job):
- Every 30 minutes: check for PENDING_PAYMENT bookings with payment in Midtrans
- If webhook failed 3x but payment exists in Midtrans:
  - Mark invoice as PAID (recovery path)
  - Send alert to admin
  - Log recovery event
- See Webhook Recovery Cron Job section for details

IDEMPOTENCY:
- Each webhook identified by (provider, gateway_webhook_id, order_id, timestamp)
- Duplicate detection: check payment_gateway_webhooks table
- If duplicate: return 200 OK (idempotent - no double-processing)

ERRORS:
- 403: Signature mismatch (security breach - don't retry)
- 404: Booking not found (Midtrans will retry)
- 500: Database error (Midtrans will retry)
```

---

#### 4. CHECK-IN ENDPOINTS (Admin)

##### 4.1 Check-in Patient (Admin Input Code)
```
POST /api/admin/check-in
Authorization: Bearer <admin_token>
Content-Type: application/json

REQUEST:
{
  "check_in_code": "ABC123",
  "branch_id": "A"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "booking_id": "uuid-booking",
    "pasien_name": "John Doe",
    "queue_number": 5,
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "session_start": "2026-07-10T09:00:00Z",
    "session_end": "2026-07-10T12:00:00Z"
  },
  "message": "Check-in berhasil. Nomor antrian: 5"
}

ERRORS:
- 400: Kode booking tidak valid
- 409: Pasien sudah check-in / Kode sudah dipakai
- 422: Pembayaran belum dikonfirmasi / Sesi belum dimulai / Sesi sudah berakhir
```

##### 4.2 Add Walk-in Patient (No Booking)
```
POST /api/admin/check-in/walk-in
Authorization: Bearer <admin_token>
Content-Type: application/json

REQUEST:
{
  "pasien_name": "Jane Doe",
  "pasien_phone": "+6281234567890",    // REQUIRED: for phone-based matching
  "pasien_age": 28,                    // OPTIONAL: demographic info
  "doctor_id": "uuid-doctor",          // REQUIRED
  "branch_id": "A"                     // REQUIRED
}

RESPONSE (201 Created):
{
  "success": true,
  "data": {
    "queue_number": 6,
    "pasien_id": "uuid-patient",
    "pasien_name": "Jane Doe",
    "patient_type": "WALK_IN",
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "first_time": true  // Whether new walk-in or recurring
  },
  "message": "Walk-in berhasil ditambahkan. Nomor antrian: 6"
}

WALK-IN PATIENT LOGIC:
1. Admin input: pasien_name, pasien_phone, doctor_id, branch_id
2. Backend checks: does phone_number exist in users table?
   a) IF YES (recurring walk-in):
      - Fetch existing patient record (patient_type = WALK_IN or WALK_IN_RECURRING)
      - Update last_seen timestamp
      - Use existing patient_id
      - Mark patient_type = WALK_IN_RECURRING (if first time was WALK_IN)
      - Response includes: first_time = false
   b) IF NO (new walk-in):
      - Create new user record:
        * role = PATIENT
        * patient_type = WALK_IN (temporary profile)
        * email = auto-generated placeholder (phone@walk-in.temp)
        * full_name = pasien_name
        * phone_number = pasien_phone
        * password_hash = random (patient doesn't have password)
      - Response includes: first_time = true
3. Create booking (walk-in booking):
   - booking_id = UUID
   - pasien_id = (from step 2a or 2b)
   - status = PAYMENT_CONFIRMED (walk-in = pre-approved for queue)
   - dp_amount = 0 (walk-in, collect payment after treatment)
   - payment_status = PENDING (collect cash after EMR completion)
4. Generate queue_number using Redis INCR (same as regular check-in):
   - Key: "queue:{branch_id}:{doctor_id}:{session_date}"
   - Result: queue_number = INCR
5. Create queue record (status: WAITING)
6. Broadcast WebSocket events to admin + TV display
7. Return response with queue_number + patient_type

CONVERSION: WALK_IN → WALK_IN_RECURRING or WALK_IN → REGISTERED
- If patient books online appointment later:
  - Update user.patient_type = REGISTERED
  - Update user.converted_at = NOW()
  - Continue using same patient_id (no duplicate creation)
- Phone-based matching prevents duplicate patient records

PAYMENT HANDLING FOR WALK-IN:
- Walk-in bookings start with payment_status = PENDING (no pre-payment)
- After EMR completed: invoice created with DP amount = 0
- Admin collects cash after treatment
- Admin marks invoice as PAID (payment_method = CASH)

CONSTRAINTS:
- patient_type field must be: REGISTERED, WALK_IN, or WALK_IN_RECURRING
- Walk-in patients can't have email-based login (use SMS/phone verification if needed - Phase 2+)
- Walk-in patient_id follows same format as registered patients (UUID)

ERRORS:
- 404: Dokter tidak ditemukan / Sesi tidak aktif
- 422: Sesi sudah penuh / Doctor tidak active hari ini
- 400: pasien_phone invalid format
```

---

#### 5. QUEUE ENDPOINTS (Realtime)

**[STANDARDIZED - Issue #2 Fix]** All queue endpoints now use canonical path: `/api/queue/status`

##### 5.1 Get Queue Status (Per Doctor or Branch)
```
GET /api/queue/status?branch_id=A&doctor_id=uuid (optional doctor_id)
Authorization: Bearer <any_token>

**QUERY PARAMETERS:**
- branch_id (required): Branch identifier (A, B, C)
- doctor_id (optional): If provided, returns specific doctor's queue; if omitted, returns all doctors
- include_completed (optional): true/false - include completed patients count

RESPONSE (200 OK) - Specific Doctor:
{
  "success": true,
  "data": {
    "doctor_id": "uuid-doctor",
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "branch_id": "A",
    "queue_date": "2026-07-10",
    "now_serving": 3,
    "waiting_queue": [4, 5, 6, 7],
    "total_waiting": 4,
    "completed_count": 2
  }
}

RESPONSE (200 OK) - All Doctors in Branch:
{
  "success": true,
  "data": {
    "branch_id": "A",
    "queue_date": "2026-07-10",
    "doctors": [
      {
        "doctor_id": "uuid-doctor-1",
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM",
        "session_start": "09:00",
        "session_end": "12:00",
        "now_serving": 3,
        "waiting_queue": [4, 5, 6],
        "total_waiting": 3,
        "completed_count": 2
      },
      {
        "doctor_id": "uuid-doctor-2",
        "doctor_name": "drg. Ahmad Riyadi",
        "specialization": "Sp.KG",
        "session_start": "13:00",
        "session_end": "16:00",
        "now_serving": null,
        "waiting_queue": [1, 2, 3, 4],
        "total_waiting": 4,
        "completed_count": 0
      }
    ]
  }
}

USAGE:
- Mobile app: GET /api/queue/status?branch_id=A&doctor_id=xxx (specific doctor queue wait time)
- TV display: GET /api/queue/status?branch_id=A (all doctors queue display)
- Doctor portal: GET /api/queue/status?branch_id=A&doctor_id=current_user.doctor_id (my queue)
- Admin dashboard: GET /api/queue/status?branch_id=A (branch overview)

ERRORS:
- 404: Dokter atau branch tidak ditemukan
- 400: Missing required parameter (branch_id)
```

##### 5.3 Call Next Patient (Doctor)
```
POST /api/queues/call-next
Authorization: Bearer <doctor_token>
Content-Type: application/json

REQUEST:
{
  "doctor_id": "uuid-doctor",
  "branch_id": "A"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "queue_number": 3,
    "booking_id": "uuid-booking",
    "pasien_name": "John Doe",
    "called_at": "2026-07-10T09:15:00Z"
  },
  "message": "Nomor 3 dipanggil"
}

ERRORS:
- 404: Tidak ada antrian yang menunggu
- 409: Dokter sudah memanggil nomor lain
```

##### 5.4 Complete Patient (Doctor)
```
POST /api/queues/complete
Authorization: Bearer <doctor_token>
Content-Type: application/json

REQUEST:
{
  "queue_id": "uuid-queue",
  "doctor_id": "uuid-doctor"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "queue_id": "uuid-queue",
    "queue_number": 3,
    "status": "COMPLETED",
    "completed_at": "2026-07-10T09:30:00Z"
  },
  "message": "Pasien nomor 3 selesai dilayani"
}

ERRORS:
- 404: Queue tidak ditemukan / Pasien tidak sedang dilayani
```

##### 5.5 WebSocket - Queue Updates (Real-time)
```
WS ws://localhost:3001/ws/queue/{branch_id}/{doctor_id}

SUBSCRIPTION:
Automatic connection establishes subscription to real-time queue updates

MESSAGES FROM SERVER:
{
  "type": "queue-updated",
  "data": {
    "doctor_id": "uuid-doctor",
    "now_serving": 3,
    "waiting_queue": [4, 5, 6, 7],
    "timestamp": "2026-07-10T09:15:00Z"
  }
}

{
  "type": "patient-called",
  "data": {
    "queue_number": 3,
    "pasien_name": "John Doe",
    "timestamp": "2026-07-10T09:15:00Z"
  }
}

{
  "type": "queue-completed",
  "data": {
    "queue_number": 3,
    "timestamp": "2026-07-10T09:30:00Z"
  }
}
```

---

#### 6. EMR ENDPOINTS (Doctor)

##### 6.1 Create/Draft EMR
```
POST /api/doctor/emr
Authorization: Bearer <doctor_token>
Content-Type: application/json

REQUEST:
{
  "booking_id": "uuid-booking",
  "complaint": "Gigi berlubang di sebelah kanan atas",
  "treatment": "Filling - Amalgam",
  "diagnosis": "Kavitas kelas 3 pada gigi 14",
  "prescription": "Paracetamol 500mg 3x sehari",
  "materials_used": "Amalgam, Glass Ionomer"
}

RESPONSE (201 Created):
{
  "success": true,
  "data": {
    "id": "uuid-emr",
    "booking_id": "uuid-booking",
    "status": "DRAFT",
    "created_at": "2026-07-10T09:30:00Z"
  }
}

ERRORS:
- 404: Booking tidak ditemukan / Pasien tidak dalam antrian dokter ini
- 409: EMR sudah ada untuk booking ini
```

##### 6.2 Update EMR (DRAFT)
```
PUT /api/doctor/emr/{emr_id}
Authorization: Bearer <doctor_token>
Content-Type: application/json

REQUEST:
{
  "complaint": "Gigi berlubang di sebelah kanan atas (updated)",
  "treatment": "Filling - Composite (updated)",
  "prescription": "Ibuprofen 400mg 2x sehari"
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-emr",
    "status": "DRAFT",
    "updated_at": "2026-07-10T09:45:00Z"
  },
  "message": "EMR berhasil diperbarui"
}

ERRORS:
- 404: EMR tidak ditemukan
- 409: EMR sudah completed (tidak bisa edit)
- 403: Dokter tidak punya akses ke EMR ini
```

##### 6.3 Complete EMR (Trigger Invoice Auto-generation)
```
POST /api/doctor/emr/{emr_id}/complete
Authorization: Bearer <doctor_token>
Content-Type: application/json

REQUEST:
{}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-emr",
    "status": "COMPLETED",
    "invoice_generated": true,
    "invoice_id": "uuid-invoice",
    "invoice_number": "INV-A-20260710-001",
    "completed_at": "2026-07-10T09:50:00Z"
  },
  "message": "EMR completed. Invoice otomatis dibuat."
}

INTERNAL LOGIC:
1. Update emr.status = COMPLETED
2. Create invoice:
   - invoice_number: format INV-{branch_id}-{YYYYMMDD}-{sequence}
   - dp_amount: 50000 (from booking)
   - treatment_cost: calculated (optional, default 0)
   - total_amount: dp + treatment_cost
   - payment_status: UNPAID
3. Log audit event EMR_COMPLETED
4. Broadcast event to admin (invoice created)
5. Return response

ERRORS:
- 404: EMR tidak ditemukan
- 409: EMR sudah completed
```

##### 6.4 Get EMR (Doctor Read)
```
GET /api/doctor/emr/{emr_id}
Authorization: Bearer <doctor_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-emr",
    "booking_id": "uuid-booking",
    "pasien_name": "John Doe",
    "complaint": "Gigi berlubang di sebelah kanan atas",
    "treatment": "Filling - Amalgam",
    "diagnosis": "Kavitas kelas 3 pada gigi 14",
    "prescription": "Paracetamol 500mg 3x sehari",
    "status": "COMPLETED",
    "created_at": "2026-07-10T09:30:00Z",
    "completed_at": "2026-07-10T09:50:00Z"
  }
}

ERRORS:
- 404: EMR tidak ditemukan
- 403: Dokter tidak punya akses
```

##### 6.5 Get EMR History (Doctor List)
```
GET /api/doctor/emr?date=2026-07-10&page=1&limit=20
Authorization: Bearer <doctor_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "emr_list": [
      {
        "id": "uuid-emr-1",
        "pasien_name": "John Doe",
        "treatment": "Filling - Amalgam",
        "status": "COMPLETED",
        "created_at": "2026-07-10T09:30:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

#### 7. PATIENT EMR ENDPOINTS (Patient View - Read Only)

**Description:** Patients can view their own EMR history with privacy filtering (diagnosis hidden)

##### 7.1 Get EMR History (Patient List)
```
GET /api/patient/emr-history?page=1&limit=10
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "emr_list": [
      {
        "id": "uuid-emr",
        "encounter_date": "2026-07-10",
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM",
        "complaint": "Gigi berlubang",
        "treatment": "Filling - Amalgam",
        "prescription": "Paracetamol 500mg",
        "status": "COMPLETED"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
}

VALIDATION:
- Pasien dapat HANYA melihat EMR miliknya (filter by patient_id)
- JANGAN tampilkan diagnosis (hidden for patient privacy)
- Read-only access (no edit permissions)
- Sorted by encounter_date DESC
- Requires authentication (patient role only)

ERRORS:
- 401: Unauthorized
- 403: Forbidden (not patient role)
```

##### 7.2 Get EMR Detail (Patient View)
```
GET /api/patient/emr/{emr_id}
Authorization: Bearer <patient_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-emr",
    "encounter_date": "2026-07-10",
    "doctor_name": "drg. Siti Nurhaliza",
    "specialization": "Sp.BM",
    "complaint": "Gigi berlubang",
    "treatment": "Filling - Amalgam",
    "prescription": "Paracetamol 500mg 3x sehari",
    "status": "COMPLETED"
  }
}

PRIVACY RULES:
- diagnosis field is EXPLICITLY EXCLUDED (privacy - doctor use only)
- Only patient can access their own EMR
- Medical data is read-only (no updates allowed)

ERRORS:
- 404: EMR tidak ditemukan
- 403: Pasien tidak punya akses (EMR milik pasien lain)
- 401: Unauthorized
```

---

#### 8. ADMIN DASHBOARD ENDPOINTS

##### 9.1 Get Dashboard Summary
```
GET /api/admin/dashboard/summary?branch_id=A&date=2026-07-10
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "summary": {
      "total_bookings_today": 20,
      "checked_in_count": 18,
      "no_show_count": 2,
      "total_queue_waiting": 5,
      "completed_emr_count": 15,
      "invoices_created": 15,
      "unpaid_invoices_count": 3,
      "total_revenue_today": 750000
    }
  }
}
```

##### 9.2 List Bookings (Admin)
```
GET /api/admin/bookings?branch_id=A&status=CHECKED_IN&date=2026-07-10&page=1&limit=20
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "uuid-booking-1",
        "check_in_code": "ABC123",
        "pasien_name": "John Doe",
        "pasien_phone": "+6281234567890",
        "doctor_name": "drg. Siti Nurhaliza",
        "status": "CHECKED_IN",
        "queue_number": 5,
        "session_start": "2026-07-10T09:00:00Z",
        "payment_status": "CONFIRMED",
        "created_at": "2026-07-08T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 20,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

##### 9.3 Mark Invoice as Paid (Admin Override)
```
POST /api/admin/invoices/{invoice_id}/mark-paid
Authorization: Bearer <admin_token>
Content-Type: application/json

REQUEST:
{
  "payment_method": "CASH",          // REQUIRED: CASH or TRANSFER
  "paid_amount": 750000,              // REQUIRED: must be > 0
  "notes": "Bayar cash tangan"        // OPTIONAL: admin notes for audit
}

REQUEST VALIDATION:
- payment_method: REQUIRED, must be in (CASH, TRANSFER)
- paid_amount: REQUIRED, must be > 0
- paid_amount: must equal invoice.total_amount (no partial payments)
- invoice must exist and payment_status = UNPAID

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-invoice",
    "invoice_number": "INV-A-20260710-001",
    "payment_status": "PAID",
    "paid_amount": 750000,
    "paid_at": "2026-07-10T14:00:00Z",
    "paid_by_admin_id": "uuid-admin",
    "payment_method": "CASH",
    "payment_notes": "Bayar cash tangan"
  }
}

INTERNAL LOGIC:
1. Validate invoice exists and payment_status = UNPAID
2. Validate payment_method is CASH or TRANSFER
3. Validate paid_amount > 0
4. Validate paid_amount == invoice.total_amount
5. Check database constraint: valid_paid_state (UNPAID + NULL timestamps → PAID + timestamps)
6. BEGIN ATOMIC TRANSACTION
7. Update invoices: payment_status = PAID, paid_at = NOW(), paid_amount, paid_by_admin_id, payment_notes
8. Insert audit log: PAYMENT_MARKED_PAID
9. END TRANSACTION
10. Return updated invoice

ERRORS:
- 400: payment_method missing or invalid
- 400: paid_amount invalid or missing
- 400: paid_amount != invoice.total_amount
- 404: Invoice tidak ditemukan
- 409: Invoice sudah dibayar (already PAID)
- 500: Database constraint violation (payment state machine failed)
```

##### 9.4 Get Unpaid Invoices
```
GET /api/admin/invoices/unpaid?branch_id=A&page=1&limit=20
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "uuid-invoice",
        "invoice_number": "INV-A-20260710-001",
        "pasien_name": "John Doe",
        "total_amount": 750000,
        "invoice_date": "2026-07-10",
        "days_overdue": 0
      }
    ],
    "total_unpaid_amount": 2250000,
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 20
    }
  }
}
```

##### 9.5 Manage Inventory
```
GET /api/admin/inventory?branch_id=A&page=1&limit=20
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "inventory": [
      {
        "id": "uuid-item-1",
        "item_name": "Amalgam Restorative",
        "item_code": "AMG001",
        "category": "Material",
        "quantity_in_stock": 50,
        "reorder_level": 10,
        "unit": "pcs"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20
    }
  }
}
```

##### 9.6 View Audit Log
```
GET /api/admin/audit-logs?branch_id=A&event_type=CHECK_IN_SUCCESS&page=1&limit=50
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "audit_logs": [
      {
        "id": "uuid-log-1",
        "event_type": "CHECK_IN_SUCCESS",
        "actor_name": "Admin Cabang A",
        "entity_type": "bookings",
        "entity_id": "uuid-booking",
        "details": {
          "pasien_name": "John Doe",
          "queue_number": 5
        },
        "created_at": "2026-07-10T09:00:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 50,
      "pages": 2
    }
  }
}
```

##### 9.7 Export Payment Report (CSV)
```
GET /api/admin/reports/payments/export?branch_id=A&date_from=2026-07-01&date_to=2026-07-31
Authorization: Bearer <admin_token>

RESPONSE (200 OK):
Content-Type: text/csv
Content-Disposition: attachment; filename="payment-report-A-202607.csv"

invoice_number,pasien_name,total_amount,payment_method,paid_at,status
INV-A-20260710-001,John Doe,750000,CASH,2026-07-10T14:00:00Z,PAID
INV-A-20260710-002,Jane Doe,500000,,,,UNPAID
...
```

##### 9.8 Get NO-SHOW Appointments (NEW - Issue #5)
```
GET /api/admin/no-shows?branch_id=A&date=2026-07-10&status=pending
Authorization: Bearer <admin_token>

QUERY PARAMETERS:
- branch_id (required): Branch identifier (A, B, C)
- date (optional): Filter by specific date (YYYY-MM-DD); if omitted, returns all no-shows
- status (optional): Filter by status - pending/resolved (default: pending)

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "no_shows": [
      {
        "booking_id": "uuid-booking-1",
        "patient_id": "uuid-patient-1",
        "patient_name": "John Doe",
        "patient_phone": "+6281234567890",
        "doctor_id": "uuid-doctor-1",
        "doctor_name": "drg. Siti Nurhaliza",
        "appointment_date": "2026-07-10",
        "appointment_time": "09:00",
        "appointment_end": "12:00",
        "no_show_marked_at": "2026-07-10T09:15:00Z",
        "status": "PENDING",
        "notes": "Patient tidak datang tanpa notifikasi"
      },
      {
        "booking_id": "uuid-booking-2",
        "patient_name": "Jane Smith",
        "doctor_name": "drg. Ahmad Riyadi",
        "appointment_date": "2026-07-10",
        "appointment_time": "13:00",
        "no_show_marked_at": "2026-07-10T13:20:00Z",
        "status": "PENDING"
      }
    ],
    "total_count": 2,
    "pending_count": 2,
    "resolved_count": 0
  }
}

USAGE:
- Admin dashboard: Show pending NO-SHOW list for follow-up
- Report generation: Export NO-SHOW records for billing/policy enforcement
- Patient management: Track patient attendance rate

**PRIVACY & SECURITY:**
- Requires: Admin role
- Branch isolation: Only shows no-shows from user's branch (WHERE branch_id)
- Audit log: Query logged with admin_id + timestamp

ERRORS:
- 400: Invalid date format / Invalid status parameter
- 401: Unauthorized (not admin)
- 403: Forbidden (not admin for this branch)
```

---

#### 9. TV QUEUE DISPLAY ENDPOINTS

##### 9.1 Get Queue Display Data (TV Screen)
```
GET /api/tv/queue?branch_id=A
Authorization: (no auth required, public endpoint)

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "branch_id": "A",
    "doctors": [
      {
        "doctor_id": "uuid-doctor-1",
        "doctor_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM",
        "session_start": "09:00",
        "session_end": "12:00",
        "now_serving": 3,
        "queue": [4, 5, 6, 7]
      },
      {
        "doctor_id": "uuid-doctor-2",
        "doctor_name": "drg. Ahmad Riyadi",
        "specialization": "Sp.KG",
        "session_start": "13:00",
        "session_end": "16:00",
        "now_serving": null,
        "queue": [1, 2, 3, 4]
      }
    ],
    "last_updated": "2026-07-10T09:15:00Z"
  }
}
```

##### 9.2 WebSocket - TV Real-time Updates
```
WS ws://localhost:3001/ws/tv-display/{branch_id}

SUBSCRIPTION:
Client connects, automatically subscribes to branch queue updates

MESSAGES FROM SERVER:
{
  "type": "queue-updated",
  "data": {
    "doctor_id": "uuid-doctor-1",
    "now_serving": 3,
    "queue": [4, 5, 6, 7],
    "timestamp": "2026-07-10T09:15:00Z"
  }
}
```

---

#### 10. PUBLIC ENDPOINTS (Landing Page & Mobile)

##### 9.1 Get All Doctors
```
GET /api/public/doctors?branch_id=A
(No auth required)

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "doctors": [
      {
        "id": "uuid-doctor-1",
        "full_name": "drg. Siti Nurhaliza",
        "specialization": "Sp.BM",
        "branch_name": "Cabang A",
        "photo_url": "https://...",
        "rating": 4.8,
        "schedule": [
          {"day": "Senin", "session_start": "09:00", "session_end": "12:00"},
          {"day": "Rabu", "session_start": "09:00", "session_end": "12:00"},
          {"day": "Jumat", "session_start": "09:00", "session_end": "12:00"}
        ]
      }
    ]
  }
}
```

##### 9.2 Get Specializations
```
GET /api/public/specializations
(No auth required)

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "specializations": [
      {"code": "Sp.BM", "name": "Bedah Mulut", "icon_url": "https://..."},
      {"code": "Sp.KG", "name": "Konservasi Gigi", "icon_url": "https://..."},
      ...
    ]
  }
}
```

##### 9.3 Get FAQ List
```
GET /api/public/faq
(No auth required)

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "faq": [
      {
        "id": "uuid-faq-1",
        "question": "Bagaimana cara booking?",
        "answer": "1. Buka aplikasi 2. Pilih dokter & jadwal 3. Lakukan pembayaran"
      },
      {
        "id": "uuid-faq-2",
        "question": "Apakah DP bisa dikembalikan?",
        "answer": "Tidak, DP bersifat non-refundable dan untuk konfirmasi booking."
      }
    ]
  }
}
```

##### 9.4 AI Smart Chat (Gemini Integration)
```
POST /api/public/chat/ai
Content-Type: application/json
(No auth required)

REQUEST:
{
  "message": "Saya ingin scaling gigi, berapa harganya?",
  "conversation_id": "uuid-conv-123" (optional)
}

RESPONSE (200 OK):
{
  "success": true,
  "data": {
    "response": "Scaling adalah prosedur pembersihan plak & tartar...",
    "suggested_specialist": "Sp.Perio",
    "booking_url": "https://dentflow.io/booking?specialist=Sp.Perio",
    "conversation_id": "uuid-conv-123"
  }
}

INTERNAL LOGIC:
1. Check if message matches hardcoded FAQ
2. If match: return FAQ answer
3. If not: send to Gemini API with FAQ context
4. Gemini enriches answer with dynamic content
5. Extract specialist recommendation (if applicable)
6. Return response + suggested booking link
```

---

### API Validation Rules (CRITICAL)

#### Input Validation (All Endpoints)
```
BOOKING:
- check_in_code: 6-char alphanumeric, unique, immutable
- dp_amount: must be 50000 (Rp), exact
- session_date: must be >= TODAY, weekday only
- pasien_id: must exist in users table
- doctor_id: must exist with role DOCTOR

PAYMENT:
- amount: must be >= 50000, <= 999999999
- gateway_transaction_id: required for gateway payments
- payment_method: enum CASH, TRANSFER, GATEWAY

EMR:
- complaint: required, min 10 chars, max 1000 chars
- treatment: required, min 5 chars, max 500 chars
- diagnosis: optional, max 500 chars
- prescription: optional, max 1000 chars

CHECK-IN:
- check_in_code: required, 6 chars
- branch_id: required, must be A/B/C
- Timing: NOW() must be within session_start to session_end

PAGINATION:
- page: >= 1
- limit: 1-100 (default 20)
```

#### Rate Limiting
```
Endpoint: 5 requests per second per IP
Check-in: 10 requests per minute per admin
Payment: 3 redirect attempts per booking
Auth: 5 login attempts per email per hour
```

---

## 6. Business Logic Flow

### A. Payment Gateway Flow (Midtrans Webhook)
```
Step 1: Pasien booking + create booking (status: PENDING_PAYMENT)
Step 2: Pasien klik "Bayar Sekarang" → frontend request redirect URL
Step 3: Backend create Midtrans transaction → return payment URL
Step 4: Pasien redirect ke Midtrans → pilih payment method
Step 5: Pasien submit → Midtrans process payment (instant sandbox)
Step 6: Midtrans send webhook to backend POST /webhook/payment-confirmation
Step 7: Backend validate signature (HS256 HMAC)
   IF signature invalid: log error, reject, return 403
   IF signature valid: continue
Step 8: Fetch booking by order_id
   IF booking.status != PENDING_PAYMENT: skip update (idempotent), return 200
   IF booking.status == PENDING_PAYMENT: update to PAYMENT_CONFIRMED
Step 9: Create payment record in payments table
Step 10: Send FCM push to pasien (Pembayaran Berhasil + Kode Booking)
Step 11: Audit log: PAYMENT_CONFIRMED event
Step 12: Return 200 OK to Midtrans (webhook success)

ERROR HANDLING:
- Webhook signature mismatch: reject (403), alert admin
- Database update fails: return 500 (Midtrans retry 3x with backoff)
- Duplicate webhook: idempotent (check booking.status), return 200
- Payment timeout: cron job auto-cancel after 24h
```

### B. Check-in Flow (Admin Input Code)
```
Step 1: Pasien datang ke klinik → approach admin
Step 2: Admin input kode booking di admin panel
Step 3: Backend validate:
   a) Check kode exists in bookings table
      IF not: return error "Kode tidak valid"
   b) Check booking.status == PAYMENT_CONFIRMED
      IF not: return error "Pembayaran belum dikonfirmasi"
   c) Check NOW() within session_start..session_end
      IF not: return error "Sesi belum dimulai/sudah selesai"
   d) Check booking not already checked-in today
      IF yes: return info + existing queue_number (prevent duplicate)
Step 4: Generate queue_number using Redis INCR atomic counter
   Key: "queue:{branch_id}:{doctor_id}:{session_date}"
   Result: queue_number = INCR → 5
Step 5: Create queue record (status: WAITING)
Step 6: Update booking (status: CHECKED_IN, queue_number: 5)
Step 7: Broadcast events:
   - WebSocket to admin panel: queue updated
   - WebSocket to TV display: queue updated
   - FCM push to pasien: Nomor Antrian 5 siap
Step 8: Audit log: CHECK_IN_SUCCESS event
Step 9: Return response (queue_number, doctor_name, etc)
```

### C. EMR → Invoice Auto-generation
```
Step 1: Doctor input EMR + complete (status: DRAFT → COMPLETED)
Step 2: Backend trigger auto-invoice generation:
   a) Calculate invoice_number: INV-{branch_id}-{YYYYMMDD}-{sequence}
   b) Set dp_amount: 50000 (from booking.dp_amount)
   c) Calculate treatment_cost: 0 (optional, can be admin override later)
   d) Calculate total: dp + treatment_cost
   e) Create invoice record (payment_status: UNPAID)
Step 3: Broadcast event to admin: invoice created (unpaid list updated)
Step 4: Audit log: EMR_COMPLETED + INVOICE_GENERATED events
Step 5: Return response (invoice_number, etc)

IMPORTANT: 
- No manual invoice creation by admin
- Admin only marks as PAID after collecting payment
- Invoice immutable (no edit after created)
```

### D. Webhook Recovery Cron Job (Every 30 Minutes)
```
OBJECTIVE: Automatic recovery for failed webhook deliveries

TRIGGER: Run every 30 minutes (scheduled by Node-cron)

LOGIC:
Step 1: Query payment_gateway_webhooks WHERE processed = FALSE
Step 2: For each unprocessed webhook:
   a) Retry webhook processing logic (same as 3.3 Webhook endpoint)
   b) If success: mark processed = TRUE
   c) If still fails: increment retry_count, log error
Step 3: Query bookings WHERE status = PENDING_PAYMENT AND created_at < NOW() - 24h
Step 4: For each orphaned booking:
   a) Check Midtrans API: is payment confirmed?
   b) If YES: mark booking → PAYMENT_CONFIRMED (recovery)
   c) Create payment record
   d) Send alert to admin: "Payment webhook recovered automatically"
   e) Log audit event: PAYMENT_RECOVERED_AUTO
Step 5: Mark webhook as processed
Step 6: Email alert to admin if any recoveries occurred

EXAMPLE SCENARIO:
- 10:00 AM: Webhook delivery attempt 1 fails (500 Database timeout)
- Midtrans retries: 10:05 AM (fails), 10:10 AM (fails)
- 10:30 AM: Cron job runs, finds orphaned webhook
- 10:31 AM: Cron job queries Midtrans API, confirms payment settled
- 10:31 AM: Mark booking → PAYMENT_CONFIRMED, create payment record
- 10:32 AM: Send FCM push to patient + email alert to admin
- Result: Booking recovered, no manual intervention needed

DATABASE UPDATES:
- UPDATE booking.status = PAYMENT_CONFIRMED
- UPDATE booking.payment_confirmed_at = NOW()
- INSERT payment record
- UPDATE payment_gateway_webhooks.processed = TRUE
- INSERT audit log: PAYMENT_RECOVERED_AUTO

FAILURES:
- If cron fails: retry next cycle (30 min)
- Max retries: 3 (after that, manual admin action needed)
```

### E. NO-SHOW Automation (Every 30 Minutes)
```
OBJECTIVE: Automatically mark appointments as NO-SHOW if patient doesn't check in

TRIGGER: Run every 30 minutes (scheduled by Node-cron)

DETECTION CRITERIA:
- Appointment session_end time has passed (NOW() > session_end)
- Booking.status is PAYMENT_CONFIRMED (not yet checked in)
- Check-in deadline: 15 minutes after session_start
  - If NOW() > (session_start + 15 minutes) AND NOT checked in → NO_SHOW

LOGIC:
Step 1: Query bookings WHERE:
   - status = PAYMENT_CONFIRMED
   - session_end < NOW() (session already finished)
   - checked_in_at IS NULL (not checked in)
Step 2: For each matching booking:
   a) Mark booking.status = NO_SHOW
   b) Update booking.updated_at = NOW()
   c) Create audit log: APPOINTMENT_NO_SHOW
   d) Send SMS/FCM to patient: "Appointment marked as no-show"
   e) Notify doctor via dashboard
Step 3: Update queue record (if exists): mark as CANCELLED
Step 4: Create notification for admin dashboard

AUTOMATIC ACTIONS AFTER NO-SHOW:
- Keep invoice as UNPAID (admin can collect payment later if no-show fee applies)
- Log no-show event in audit trail (for reporting)
- Update patient profile: track no-show count (optional feature)
- Send email receipt to admin: "NO-SHOW Report"

EXAMPLE SCENARIO:
- Appointment scheduled: 2026-07-10, 10:00-12:00
- Patient doesn't check in
- 12:30 PM (30 min after session_end): Cron job runs
- Cron detects: PAYMENT_CONFIRMED + session_end passed + no check-in
- Cron marks: booking.status = NO_SHOW
- Cron sends notification: Admin sees "Patient did not show up"
- Admin can manually follow up with patient

NO-SHOW POLICY:
- First NO-SHOW: warning + admin follow-up
- Second NO-SHOW within 30 days: charge 50% of appointment fee
- Third NO-SHOW within 30 days: blacklist patient (require admin approval for new bookings)
(Note: Policy details are in PRD, cron just marks NO-SHOW status)

DATABASE UPDATES:
- UPDATE booking.status = NO_SHOW
- UPDATE queue.status = CANCELLED (if exists)
- INSERT audit log: APPOINTMENT_NO_SHOW
- Send notification (store in notifications table if implemented)

MANUAL OVERRIDE:
- Admin can override: mark checked-in manually (convert NO_SHOW back to COMPLETED)
- Audit log records: APPOINTMENT_OVERRIDE_BY_ADMIN
```

---

## 7. Non-Functional Requirements

### Performance
- **API Response Time (p95):** <200ms for simple queries, <500ms for complex
- **Database Query Time:** <100ms for indexed queries
- **Queue Update Latency:** <2 seconds (WebSocket broadcast)
- **Payment Webhook Processing:** <500ms end-to-end
- **Concurrent Users:** Support 500+ simultaneous connections (TV display, multiple admins)

### Scalability
- **Database Connection Pooling:** Min 5, Max 20 connections
- **Cache Hit Rate:** >80% for session & rate-limit checks
- **Memory Usage:** <500MB for backend process (Node.js)
- **Disk I/O:** Optimize with indexes on branch_id, doctor_id, booking_date

### Availability
- **Uptime Target:** 99.5% (max 3.6 hours downtime/month)
- **Backup Frequency:** Daily PostgreSQL backups (automated)
- **Recovery Time Objective (RTO):** <1 hour
- **Recovery Point Objective (RPO):** <15 minutes
- **Health Checks:** Every 30 seconds (backend, database, Redis, MinIO)

### Security
- **Password Hashing:** bcrypt with salt rounds 10+
- **JWT Tokens:** HS256 algorithm, 24h expiry for access, 30d for refresh
- **HTTPS:** TLS 1.3 (production)
- **CORS:** Whitelist specific origins (no *)
- **Rate Limiting:** 5 req/sec per IP global, 10 req/min per admin for check-in
- **SQL Injection:** Parameterized queries only (prepared statements)
- **CSRF:** Implement CSRF tokens for state-changing operations
- **Data Encryption:** PII encrypted in transit (HTTPS), at rest (if using cloud storage)

### Data Integrity
- **ACID Compliance:** PostgreSQL transactions for payment + booking flows
- **Idempotency:** Webhook handler, payment API, check-in API must be idempotent
- **Audit Trail:** Immutable audit_logs for 100% traceability
- **Soft Deletes:** No hard deletes; use deleted_at for compliance + undo
- **Row-level Security:** branch_id filter on every query (prevent data leak across branches)

### Monitoring & Alerting
- **Logging:** Structured logs (JSON) using Pino
  - Log levels: DEBUG, INFO, WARN, ERROR
  - Include: timestamp, level, message, context (user_id, booking_id, etc)
- **Error Tracking:** Sentry integration (errors, warnings)
- **Metrics:** Prometheus metrics for:
  - API endpoint response times
  - Database query times
  - Queue depth per doctor
  - Payment success/failure rate
  - JWT token refresh rate
- **Alerts:** PagerDuty / Email alerts for:
  - Payment webhook failures (>5 errors in 5 min)
  - Database connection pool exhaustion
  - High API response times (p95 > 500ms)
  - Unusual queue depths (>20 per doctor)

---

## 8. Security & Authentication

### JWT Token Structure
```
Access Token (24 hours):
{
  "sub": "uuid-user-id",
  "email": "john@gmail.com",
  "role": "PATIENT",
  "branch_id": "A",
  "iat": 1688001000,
  "exp": 1688087400,
  "iss": "dentflow-api"
}

Refresh Token (30 days):
{
  "sub": "uuid-user-id",
  "type": "refresh",
  "iat": 1688001000,
  "exp": 1690593000,
  "iss": "dentflow-api"
}
```

### Password Policy
- **Minimum Length:** 8 characters
- **Complexity:** At least 1 uppercase + 1 lowercase + 1 digit + 1 special char
- **Hashing Algorithm:** bcrypt with 10+ rounds
- **Password Reset:** Token expires in 1 hour, single-use

### Multi-tenant Isolation
- **Row-level Security:** Every query includes `WHERE branch_id = ?`
- **Admin Access:** Admin can only see data for assigned branch_id
- **Doctor Access:** Doctor can only view queues, EMRs for their branch
- **Patient Access:** Patient can view own bookings regardless of branch (for transparency)
- **Audit Logs:** Separate audit logs per branch (for compliance)

### API Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### Webhook Security (Midtrans)
```
Signature Verification (CRITICAL):
1. Extract payload body (raw JSON)
2. Extract signature_key from webhook headers
3. Generate expected_signature:
   expected = SHA256({order_id}|{status_code}|{gross_amount}|{server_key})
4. Compare: signature_key == expected?
   IF match: proceed
   IF mismatch: reject (403), log security alert, alert admin
```

---

## 9. Error Handling & Logging

### Standardized Error Codes (Bahasa Indonesia)

```
1000-1099: Authentication Errors
- 1001: INVALID_EMAIL_FORMAT
- 1002: PASSWORD_TOO_WEAK
- 1003: EMAIL_ALREADY_EXISTS
- 1004: INVALID_CREDENTIALS
- 1005: TOKEN_EXPIRED
- 1006: TOKEN_INVALID
- 1007: REFRESH_TOKEN_EXPIRED

2000-2099: Booking Errors
- 2001: BOOKING_NOT_FOUND
- 2002: SLOT_NOT_AVAILABLE
- 2003: MAX_BOOKINGS_PER_DAY_REACHED
- 2004: BOOKING_CANCELLED
- 2005: BOOKING_ALREADY_COMPLETED
- 2006: DUPLICATE_BOOKING_SAME_SLOT

3000-3099: Payment Errors
- 3001: PAYMENT_FAILED
- 3002: PAYMENT_PENDING
- 3003: PAYMENT_TIMEOUT
- 3004: WEBHOOK_SIGNATURE_MISMATCH
- 3005: INVALID_AMOUNT
- 3006: PAYMENT_METHOD_NOT_SUPPORTED

4000-4099: Check-in Errors
- 4001: CHECK_IN_CODE_INVALID
- 4002: CHECK_IN_CODE_ALREADY_USED
- 4003: CHECK_IN_SESSION_NOT_STARTED
- 4004: CHECK_IN_SESSION_ENDED
- 4005: PAYMENT_NOT_CONFIRMED
- 4006: DUPLICATE_CHECK_IN

5000-5099: Queue Errors
- 5001: NO_QUEUE_AVAILABLE
- 5002: DOCTOR_OFFLINE
- 5003: QUEUE_FULL

6000-6099: EMR Errors
- 6001: EMR_NOT_FOUND
- 6002: EMR_ALREADY_COMPLETED
- 6003: INVALID_EMR_DATA
- 6004: BOOKING_NOT_FOUND_FOR_EMR

7000-7099: Invoice Errors
- 7001: INVOICE_NOT_FOUND
- 7002: INVOICE_ALREADY_PAID
- 7003: INVALID_INVOICE_DATA

8000-8099: Authorization Errors
- 8001: INSUFFICIENT_PERMISSIONS
- 8002: RESOURCE_NOT_ACCESSIBLE
- 8003: BRANCH_MISMATCH

9000-9099: System Errors
- 9001: DATABASE_ERROR
- 9002: EXTERNAL_SERVICE_ERROR
- 9003: RATE_LIMIT_EXCEEDED
- 9004: INTERNAL_SERVER_ERROR
- 9005: PAYMENT_GATEWAY_TIMEOUT
```

### Structured Logging (Pino JSON Format)
```json
{
  "level": "INFO",
  "timestamp": "2026-07-10T09:15:00Z",
  "request_id": "req-uuid-123",
  "method": "POST",
  "path": "/api/patient/bookings",
  "status": 201,
  "response_time_ms": 145,
  "user_id": "uuid-patient",
  "user_role": "PATIENT",
  "branch_id": "A",
  "message": "Booking created successfully",
  "data": {
    "booking_id": "uuid-booking",
    "check_in_code": "ABC123",
    "doctor_name": "drg. Siti Nurhaliza"
  }
}
```

### Error Response Example
```json
{
  "success": false,
  "data": null,
  "message": "Kode booking tidak valid. Silakan cek kembali kode Anda.",
  "error": {
    "code": "CHECK_IN_CODE_INVALID",
    "details": "Kode ABC12X tidak ditemukan di database",
    "timestamp": "2026-07-10T09:15:00Z",
    "request_id": "req-uuid-123"
  }
}
```

---

## 10. Testing Strategy (Automation)

### Test Framework & Tools
- **Unit Testing:** Jest + ts-jest
- **Integration Testing:** Jest + Supertest (for API endpoints)
- **E2E Testing:** Playwright / Cypress (future phase)
- **Mocking:** Jest mocks, Sinon, Mock Express
- **Database Testing:** PostgreSQL testcontainer
- **Coverage Tool:** Istanbul / nyc (>70% target)

### Test Categories

#### 1. Unit Tests (Service Layer)
```typescript
// Example: booking.service.test.ts
describe('BookingService', () => {
  describe('createBooking', () => {
    it('should create booking with PENDING_PAYMENT status', async () => {
      // Arrange
      const pasien_id = 'uuid-patient';
      const doctor_id = 'uuid-doctor';
      const slot_id = 'uuid-slot-1';
      
      // Act
      const result = await bookingService.createBooking({
        pasien_id,
        doctor_id,
        slot_id
      });
      
      // Assert
      expect(result.status).toBe('PENDING_PAYMENT');
      expect(result.check_in_code).toHaveLength(6);
      expect(result.dp_amount).toBe(50000);
    });
    
    it('should reject duplicate booking same slot', async () => {
      // Should throw DUPLICATE_BOOKING_SAME_SLOT error
    });
    
    it('should reject if slot is full', async () => {
      // Should throw SLOT_NOT_AVAILABLE error
    });
  });
});
```

#### 2. Integration Tests (API Endpoints)
```typescript
// Example: booking.integration.test.ts
describe('POST /api/patient/bookings', () => {
  it('should create booking and return 201', async () => {
    // Arrange
    const patient_token = 'valid-jwt-token';
    const payload = {
      branch_id: 'A',
      doctor_id: 'uuid-doctor',
      slot_id: 'uuid-slot-1',
      booking_date: '2026-07-10'
    };
    
    // Act
    const response = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patient_token}`)
      .send(payload);
    
    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.check_in_code).toHaveLength(6);
  });
  
  it('should return 401 if token is invalid', async () => {
    // Assert 401 Unauthorized
  });
  
  it('should return 422 if branch_id is invalid', async () => {
    // Assert 422 Unprocessable Entity
  });
});
```

#### 3. E2E Scenario Tests
```
Scenario 1: Booking → Payment → Check-in → Queue
1. Patient registers
2. Patient creates booking (status: PENDING_PAYMENT)
3. Patient triggers payment redirect
4. Mock Midtrans webhook (simulate payment confirmation)
5. Booking status changes to PAYMENT_CONFIRMED
6. Admin checks in patient (input code)
7. Queue generated, status changes to CHECKED_IN
8. Doctor calls next patient
9. Patient moved to BEING_CALLED status
10. Doctor completes patient + creates EMR
11. EMR completed → invoice auto-generated
12. Verify audit log has all events

Scenario 2: Payment Webhook Idempotency
1. Send webhook first time → booking.status = PAYMENT_CONFIRMED
2. Send same webhook again → booking.status stays PAYMENT_CONFIRMED (idempotent)
3. Verify no duplicate payment records

Scenario 3: Check-in Validation Error Paths
1. Invalid code → error "Kode tidak valid"
2. Payment not confirmed → error "Pembayaran belum dikonfirmasi"
3. Session not started → error "Sesi belum dimulai"
4. Session ended → error "Sesi sudah selesai"
5. Already checked-in → show existing queue_number

Scenario 4: Multi-tenant Isolation
1. Admin Cabang A should NOT see data from Cabang B
2. Patient should NOT see other patient's bookings
3. Doctor from Cabang A should NOT access queue from Cabang B
4. Every query must filter by branch_id
```

### Test Coverage Targets
- **Unit Tests:** >85% coverage (services, utils, validators)
- **Integration Tests:** >70% coverage (API endpoints)
- **Critical Paths:** 100% coverage (payment, check-in, EMR completion)
- **Error Paths:** >80% coverage (all error scenarios tested)

### CI/CD Testing Pipeline (GitHub Actions)
```yaml
name: Test & Build
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run coverage
      - uses: codecov/codecov-action@v3
```

---

## 11. Deployment & Environment

### Environment Configuration

#### Development (.env.local)
```
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dentflow_dev

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=dev-secret-key-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret-key

# Midtrans (Sandbox)
MIDTRANS_SANDBOX_URL=https://app.sandbox.midtrans.com
MIDTRANS_CLIENT_KEY=sandbox_client_key
MIDTRANS_SERVER_KEY=sandbox_server_key
MIDTRANS_WEBHOOK_URL=http://localhost:3001/webhook/payment-confirmation

# Ngrok (for webhook testing)
NGROK_AUTH_TOKEN=your_ngrok_token
NGROK_WEBHOOK_URL=https://your-ngrok-tunnel.ngrok.io/webhook/payment-confirmation

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Firebase (FCM)
FIREBASE_PROJECT_ID=dentflow-dev
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Logging
LOG_LEVEL=debug
SENTRY_DSN=

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
```

#### Production (.env.production)
```
NODE_ENV=production
PORT=3000
API_URL=https://api.dentflow.io
FRONTEND_URL=https://dentflow.io

# Database (Managed PostgreSQL)
DATABASE_URL=postgresql://user:password@prod-db.provider.com:5432/dentflow_prod
DB_POOL_MIN=5
DB_POOL_MAX=20

# Redis (Managed)
REDIS_URL=redis://prod-redis.provider.com:6379/0

# JWT (Strong secrets from env var)
JWT_SECRET=<strong-random-secret-from-vault>
JWT_REFRESH_SECRET=<strong-random-secret-from-vault>

# Midtrans (Production)
MIDTRANS_SANDBOX_URL=https://app.midtrans.com
MIDTRANS_CLIENT_KEY=prod_client_key
MIDTRANS_SERVER_KEY=prod_server_key
MIDTRANS_WEBHOOK_URL=https://api.dentflow.io/webhook/payment-confirmation

# MinIO (or S3)
MINIO_ENDPOINT=https://minio.dentflow.io
MINIO_ACCESS_KEY=<from-vault>
MINIO_SECRET_KEY=<from-vault>

# Firebase (FCM Production)
FIREBASE_PROJECT_ID=dentflow-prod
FIREBASE_PRIVATE_KEY=<from-vault>

# Gemini AI
GEMINI_API_KEY=<from-vault>

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/...

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=<from-vault>

# Security
CORS_ORIGINS=https://dentflow.io,https://www.dentflow.io

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=5
```

### Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: dentflow_user
      POSTGRES_PASSWORD: dentflow_password
      POSTGRES_DB: dentflow_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  rabbitmq:
    image: rabbitmq:3.12-management
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Deployment Steps

#### 1. GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - name: Deploy to Render.com
        env:
          RENDER_DEPLOY_KEY: ${{ secrets.RENDER_DEPLOY_KEY }}
        run: |
          curl -X POST https://api.render.com/deploy \
            -H "Authorization: Bearer $RENDER_DEPLOY_KEY"
```

#### 2. Database Migration
```bash
# Run migrations on deployment
npm run migrate:latest

# Rollback (if needed)
npm run migrate:rollback
```

#### 3. Seeding (Initial Data)
```bash
# Seed doctors, schedules, branches for demo
npm run seed:production

# This will populate:
# - 3 branches (Cabang A, B, C)
# - 24 doctors (8 per branch, across 8 specializations)
# - Doctor schedules (predefined)
# - Admin accounts (1 per branch)
```

---

## 12. Observability & Monitoring

### Metrics Collection (Prometheus)

```typescript
// Example: Prometheus metrics setup
import { register, Counter, Histogram, Gauge } from 'prom-client';

// API metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Database metrics
const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

// Queue metrics
const queueDepth = new Gauge({
  name: 'queue_depth_total',
  help: 'Current queue depth per doctor',
  labelNames: ['doctor_id', 'branch_id']
});

// Payment metrics
const paymentSuccess = new Counter({
  name: 'payment_success_total',
  help: 'Total successful payments',
  labelNames: ['payment_method']
});

const paymentFailure = new Counter({
  name: 'payment_failure_total',
  help: 'Total failed payments',
  labelNames: ['reason']
});
```

### Alerting Rules (Prometheus AlertManager)

```yaml
groups:
  - name: dentflow_alerts
    rules:
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "API latency high (p95 > 500ms)"
      
      - alert: PaymentWebhookFailure
        expr: rate(payment_webhook_error_total[5m]) > 0.1
        for: 1m
        annotations:
          summary: "Payment webhook errors detected"
      
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count > 18  # Near max of 20
        for: 2m
        annotations:
          summary: "Database connection pool near capacity"
```

### Logging Stack (ELK)

```
Backend (Express.js)
  ↓ Pino (structured logs)
  ↓ Send to LogStash
Elasticsearch (index: dentflow-*)
  ↓
Kibana (query & visualize logs)
```

### Health Check Endpoint

```typescript
GET /api/health
Response (200 OK):
{
  "status": "healthy",
  "timestamp": "2026-07-10T09:15:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "minio": "connected",
    "payment_gateway": "ok"
  },
  "version": "1.0.0",
  "uptime_seconds": 86400
}
```

---

## 13. Dependencies & Versioning

### Backend Dependencies

```json
{
  "name": "dentflow-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.4.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.10.0",
    "redis": "^4.6.5",
    "dotenv": "^16.0.3",
    "pino": "^8.14.1",
    "pino-http": "^8.3.3",
    "joi": "^17.9.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "uuid": "^9.0.0",
    "xml2js": "^0.5.0",  -- For Midtrans webhook parsing
    "googleapis": "^118.0.0", -- For Gemini AI integration
    "minio": "^7.0.32",
    "amqplib": "^0.10.3", -- RabbitMQ
    "node-cron": "^3.0.2" -- Scheduled jobs (cron)
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1",
    "tsx": "^3.12.0",
    "jest": "^29.6.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.12",
    "nodemon": "^2.0.22",
    "eslint": "^8.40.0",
    "@typescript-eslint/parser": "^5.59.0",
    "@typescript-eslint/eslint-plugin": "^5.59.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### Frontend Dependencies

```json
{
  "name": "dentflow-web",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.0",
    "react-hook-form": "^7.45.0",
    "axios": "^1.4.0",
    "zustand": "^4.3.8", -- State management
    "react-query": "^3.39.3",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.263.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.24"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Node.js Version Strategy
- **Development:** Node.js 18.x LTS (current)
- **Production:** Node.js 18.x LTS (same as dev for consistency)
- **Update Policy:** Minor version bumps quarterly, major versions only during major releases (breaking changes)

---

## 14. Known Limitations & Future Work

### V1.0 Limitations
1. **Single Language:** Only Bahasa Indonesia (no i18n)
2. **Mobile Platform:** Android only (Flutter), iOS in V2
3. **Payment Gateway:** Midtrans Sandbox only (production key needed for real payments)
4. **Notification:** FCM push only (no SMS, WhatsApp)
5. **Analytics:** None in V1 (defer to V2)
6. **Geolocation:** No location-based features
7. **Insurance:** No insurance integration

### V2.0 Planned Features
- ☐ Multi-language support (English, Indonesian)
- ☐ iOS app (Flutter)
- ☐ SMS & WhatsApp integration
- ☐ Advanced analytics & reporting
- ☐ Geolocation-based appointment recommendations
- ☐ Insurance billing integration
- ☐ Staff scheduling optimization (AI-powered)
- ☐ Mobile wallet integration (GoPay, OVO)
- ☐ Video consultation support
- ☐ GraphQL API (alongside REST)
- ☐ Kubernetes deployment
- ☐ Multi-language audit logs
- ☐ Advanced access control (RBAC roles)

### Known Technical Debt
1. **Redis Persistence:** Currently in-memory only (data loss on restart) → Add RDB snapshots in V2
2. **Email Service:** Resend only → Add Mailgun fallback in V2
3. **File Storage:** MinIO local → Add S3 cloud option in V2
4. **Real-time:** WebSocket polling fallback only → Add Redis Pub/Sub channels in V2
5. **Testing:** Jest only → Add Playwright E2E in V2
6. **Documentation:** API docs only → Add architecture deep-dives in V2

---

## IMPLEMENTATION CHECKLIST (PHASED)

### PHASE 1: Foundation (Weeks 1-2)
- ☐ Setup Node.js + TypeScript + Express project
- ☐ Setup PostgreSQL + Redis + Docker Compose locally
- ☐ Database schema + migrations (all 11 tables)
- ☐ JWT authentication (register, login, refresh, logout)
- ☐ Basic middleware (auth, error handler, logging)
- ☐ Unit tests for auth service
- ☐ Deployment skeleton (GitHub Actions, Render.com)

### PHASE 2: Core Business Logic (Weeks 3-4)
- ☐ Booking API (create, get, cancel, list, available-slots)
- ☐ Midtrans Sandbox payment integration
- ☐ Payment webhook handler (+ signature verification, idempotency)
- ☐ Check-in API (+ Redis queue counter)
- ☐ Queue management (get status, call next, complete)
- ☐ EMR API (create DRAFT, update, complete → auto-invoice)
- ☐ Invoice API (list unpaid, mark paid)
- ☐ Audit log service (append-only)
- ☐ Integration tests (>70% coverage)

### PHASE 3: Admin & Doctor Portals (Weeks 5-6)
- ☐ Next.js web app setup
- ☐ Admin dashboard (bookings, check-in form, queue, invoices, stok, audit log)
- ☐ Doctor portal (queue, EMR, patient list, invoice view)
- ☐ Patient landing page (info, doctors, FAQ)
- ☐ TV queue display (real-time queue per doctor)
- ☐ WebSocket real-time updates (queue, TV display)
- ☐ UI/UX responsive mobile-friendly

### PHASE 4: Mobile App & AI Chat (Weeks 7-8)
- ☐ Flutter Android setup
- ☐ Firebase + FCM integration
- ☐ Mobile app: booking, payment (Midtrans), check-in info, queue view, EMR history
- ☐ AI Smart Chat (Gemini integration, FAQ, specialist recommendation)
- ☐ Landing page chat widget
- ☐ APK build & signing
- ☐ Firebase App Distribution setup

### PHASE 5: Testing, Docs, & Deployment (Week 9)
- ☐ E2E scenario tests (Playwright)
- ☐ Performance testing (load test with k6 or Locust)
- ☐ Security audit (OWASP Top 10)
- ☐ Complete documentation (API, deployment, architecture)
- ☐ README with screenshots + demo account
- ☐ Staging deployment + smoke tests
- ☐ Production deployment
- ☐ Video walkthrough (3-5 min)
- ☐ GitHub repo public + clean commit history
- ☐ Portfolio writeup (architecture decisions, challenges, solutions)

---

## CONCLUSION

This TDD is **LOCKED & FINAL** for DENTFLOW v10.0 MVP. Every API endpoint, database schema, business logic flow, and non-functional requirement is documented with 100% alignment to PRD v10.0 + HALAMAN v1.0.

**Key Guarantees:**
✅ Zero mid-project API changes (all endpoints defined)
✅ All 13 core features included (booking, payment, check-in, queue, EMR, invoice, audit, multi-tenant, admin, doctor, patient, landing, mobile)
✅ Production-ready architecture (modulith, clean code, >70% tests)
✅ Security-first design (JWT, bcrypt, webhook signature, rate limiting, row-level security)
✅ Portfolio-grade documentation (for international recruiters)

**Next Step:** Proceed to Design System & Hi-Fi Prototype (DESIGN.MD / Figma), then TDD Implementation.

---

**Document Version:** 1.0 (FINAL)  
**Last Updated:** 2026-07-07  
**Status:** ✅ APPROVED FOR DEVELOPMENT  
**Target Portfolio Rating:** 9-9.5/10
