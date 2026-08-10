# DentFlow Backend

> Dental Clinic Management System - Backend (Modular Monolith)

## 📋 Prasyarat

- Node.js 18.x atau lebih tinggi
- Docker & Docker Compose
- PostgreSQL 15, Redis 7, MinIO (via Docker)

## 🚀 Setup Development

1. Clone repository
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Start Docker services: `docker-compose up -d`
5. Run migration: `npm run migrate`
6. Run seed: `npm run seed`
7. Start server: `npm run dev`

## 🧪 Testing

### Setup Database Test

Pastikan database test sudah siap:

```bash
cp .env.example .env.test
npm run migrate
npm run seed
```

### Run Tests

| Perintah | Deskripsi |
|----------|-----------|
| `npm test` | Semua unit + integration test |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:integration` | Integration test saja |

### Contoh

```bash
npm test -- tests/unit/services/booking.service.test.ts
npm run test:integration
```

## 📁 Script Lainnya

| Perintah | Deskripsi |
|----------|-----------|
| `npm run build` | Build TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test:postman` | API Contract test |

---

**DentFlow v1.0 - Production Ready** 🚀
