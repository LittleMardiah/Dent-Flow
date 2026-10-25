# DentFlow v1.0 - Multi-Branch Dental Clinic Management

DentFlow adalah sistem manajemen klinik gigi komprehensif yang dirancang untuk mengelola operasional 3 cabang dengan 24 dokter spesialis. Dibangun dengan arsitektur Modular Monolith yang siap di-deploy sebagai Full Express Server.

## Tech Stack
- Backend: Node.js, Express.js, TypeScript, PostgreSQL, Redis, Socket.IO, node-cron, MinIO (S3-compatible)
- Frontend Web: Next.js 14 (App Router), React, Tailwind CSS, Axios
- Mobile App: Flutter (Android)
- Testing & CI/CD: Jest, Cypress, GitHub Actions (Lint, Type Check, Build)

## Fitur Utama
- Booking & Payment: Integrasi Payment Gateway (Midtrans Sandbox) untuk DP.
- Queue Management: Sistem antrean real-time (Socket.IO) dengan TV Display.
- EMR & Auto-Invoice: Rekam medis elektronik dengan auto-generate invoice.
- Security: JWT Auth + Refresh Token, Role-Based Access Control (Admin, Doctor, Patient), Multi-tenant isolation (Row-level security).
- CI/CD: Automated GitHub Actions Pipeline (Lint, TSC, Build).

## Struktur Repositori
- `dentflow-backend/` - Core API Express (Modulith)
- `dentflow-web/` - Admin & Doctor Dashboard (Next.js)
- `dentflow-mobile/` - Patient Mobile App (Flutter)
- `docs 1.0/` - Technical Documentation, PRD, TDD, System Flow

## Cara Menjalankan (Local)
1. `cd dentflow-backend && docker compose up -d`
2. `npm install && npm run migrate && npm run dev`
3. `cd dentflow-web && npm install && npm run dev`

## Lisensi
Proyek ini dibuat untuk tujuan portofolio. Silakan lihat dokumentasi di folder `docs 1.0/` untuk detail arsitektur lengkap.
