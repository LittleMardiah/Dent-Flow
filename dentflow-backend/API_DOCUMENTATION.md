# DentFlow API Documentation v1.0
## Backend API Reference for Phase 2

**Base URL:** `http://localhost:3000/api`
**Authentication:** JWT Bearer Token
**Format:** JSON

---

## 1. AUTHENTICATION

### 1.1 Patient Register
- **POST** `/auth/patient/register`
- **Auth:** None
- **Request:** `{"email":"patient@test.com","password":"TestPassword123!","fullName":"Budi Santoso","phone":"081234567890"}`
- **Response:** `{"success":true,"data":{"userId":"...","token":"..."}}`

### 1.2 Patient Login
- **POST** `/auth/patient/login`
- **Auth:** None
- **Request:** `{"username":"budi_santoso","password":"TestPassword123!"}`
- **Response:** `{"success":true,"data":{"token":"...","user":{...}}}`

### 1.3 Admin Login
- **POST** `/auth/admin/login`
- **Auth:** None
- **Request:** `{"username":"admin_a","password":"Admin123!","branch_id":"A"}`
- **Response:** `{"success":true,"data":{"token":"...","user":{...}}}`

### 1.4 Doctor Login
- **POST** `/auth/doctor/login`
- **Auth:** None
- **Request:** `{"username":"dr_bm_a","password":"Doctor123!","branch_id":"A"}`
- **Response:** `{"success":true,"data":{"token":"...","user":{...}}}`

---

## 2. BOOKING (Patient)

### 2.1 Get Doctor Availability
- **GET** `/doctors/:doctorId/availability?date=2026-08-10&branch_id=...`
- **Auth:** JWT
- **Response:** `{"success":true,"data":{"available_slots":[...]}}`

### 2.2 Create Booking
- **POST** `/patient/bookings`
- **Auth:** JWT (Patient)
- **Request:** `{"doctor_id":"...","slot_date_time":"2026-08-10T09:00:00.000Z","notes":"Test","session_slot_id":"..."}`
- **Response:** `{"success":true,"data":{"id":"...","bookingCode":"...","status":"PENDING_PAYMENT"}}`

### 2.3 List Patient Bookings
- **GET** `/patient/bookings?status=PENDING&branch_id=...&limit=10&offset=0`
- **Auth:** JWT (Patient)
- **Response:** `{"success":true,"data":{"bookings":[...],"pagination":{...}}}`

### 2.4 Cancel Booking
- **PUT** `/patient/bookings/:id/cancel`
- **Auth:** JWT (Patient)
- **Response:** `{"success":true,"message":"Booking cancelled"}`

---

## 3. QUEUE MANAGEMENT

### 3.1 Get Queue Status
- **GET** `/queue/status?branch_id=A&doctor_id=...`
- **Auth:** JWT
- **Response:** `{"success":true,"data":{"waiting_queue":[...],"now_serving":null}}`

### 3.2 Admin Check-in
- **POST** `/admin/check-in`
- **Auth:** JWT (Admin)
- **Request:** `{"check_in_code":"ABC123","branch_id":"A"}`
- **Response:** `{"success":true,"data":{"queue_number":5}}`

### 3.3 Doctor Call Patient
- **POST** `/queue/:id/check-in`
- **Auth:** JWT (Doctor)
- **Response:** `{"success":true,"data":{"queue_status":"BEING_CALLED"}}`

---

## 4. ENCOUNTER (EMR)

### 4.1 Start Encounter
- **POST** `/encounters`
- **Auth:** JWT (Doctor)
- **Request:** `{"booking_id":"...","diagnosis":"Flu","treatment":"Paracetamol","notes":"..."}`
- **Response:** `{"success":true,"data":{"id":"...","status":"ONGOING"}}`

### 4.2 Record Diagnosis
- **PUT** `/encounters/:id`
- **Auth:** JWT (Doctor)
- **Request:** `{"diagnosis":"J11.1","treatment":"...","notes":"..."}`
- **Response:** `{"success":true}`

### 4.3 Complete Encounter (Auto-Invoice)
- **POST** `/encounters/:id/complete`
- **Auth:** JWT (Doctor)
- **Response:** `{"success":true,"data":{"invoice_id":"..."}}`

---

## 5. INVOICE & PAYMENT

### 5.1 Get Invoice Detail
- **GET** `/admin/invoices/:id`
- **Auth:** JWT (Admin)
- **Response:** `{"success":true,"data":{"id":"...","status":"PAID","amount":200000}}`

### 5.2 Mark Invoice Paid
- **POST** `/admin/invoices/:id/mark-paid`
- **Auth:** JWT (Admin)
- **Request:** `{"payment_method":"CASH","paid_amount":200000,"notes":"..."}`
- **Response:** `{"success":true,"data":{"status":"PAID"}}`

### 5.3 Midtrans Webhook
- **POST** `/webhooks/midtrans`
- **Auth:** None (Signature Verified)
- **Response:** `{"success":true}`

---

## 6. WALK-IN

### 6.1 Create Temporary Profile
- **POST** `/walk-in/create-profile`
- **Auth:** None
- **Request:** `{"name":"Jane","phone":"081...","age":28}`
- **Response:** `{"success":true,"data":{"temp_patient_id":"..."}}`

### 6.2 Book Walk-in (Admin)
- **POST** `/walk-in/book-appointment`
- **Auth:** JWT (Admin)
- **Request:** `{"temporary_profile":{...},"doctor_id":"...","branch_id":"A"}`
- **Response:** `{"success":true,"data":{"booking_id":"...","queue_number":5}}`

---

## 7. ADMIN & REPORTS

### 7.1 Get NO-SHOW List
- **GET** `/admin/no-shows?branch_id=A&date=2026-08-10`
- **Auth:** JWT (Admin)
- **Response:** `{"success":true,"data":{"no_shows":[...]}}`

### 7.2 Audit Logs
- **GET** `/admin/audit-logs?entityType=BOOKING&entityId=...`
- **Auth:** JWT (Admin)
- **Response:** `{"success":true,"data":{"logs":[...]}}`

---

**Total Endpoints: 50+**
