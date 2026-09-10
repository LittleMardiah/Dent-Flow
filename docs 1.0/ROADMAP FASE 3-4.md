# 💻 DENTFLOW ROADMAP - PHASE 3 & 4: FRONTEND & MOBILE
## Weeks 5-8: Web Dashboard, Mobile App, Real-Time Features & E2E Testing

**Phase Name:** Frontend & Mobile Implementation  
**Timeline:** Weeks 5-8 (20 days: Phase 3 Weeks 5-6, Phase 4 Weeks 7-8)  
**Target Token Count:** 12,000-14,000 tokens  
**Target Line Count:** 1,400-1,600 lines  
**Estimated Reading Time:** 15-20 minutes  
**Status:** PHASE 3-4 - Frontend, Mobile & Real-Time  
**Date Created:** 2026-07-10

---

## 📋 TABLE OF CONTENTS - PHASE 3 & 4

1. Executive Overview
2. Phase 3 Overview (Weeks 5-6: Web UI)
3. Phase 4 Overview (Weeks 7-8: Mobile App & E2E Testing)
4. Week 5 Detailed Breakdown (Days 21-25: Next.js Setup & Admin Portal)
5. Week 6 Detailed Breakdown (Days 26-30: Real-Time Features & Patient Portal)
6. Week 7 Detailed Breakdown (Days 31-35: Flutter Mobile App)
7. Week 8 Detailed Breakdown (Days 36-40: E2E Testing & Mobile Optimization)
8. All 6 Recommendations Integration in UI
9. Exit Criteria & Validation Matrix
10. Continuity Clue to Phase 5

---

## 🎯 EXECUTIVE OVERVIEW - PHASE 3 & 4

### Vision Statement
After Phase 2 (all backend APIs live and tested), Phase 3 & 4 transform DentFlow into a **complete user-facing system**. Web dashboard for admins/doctors, mobile app for patients and walk-in workflows, real-time queue display for TVs, and comprehensive E2E testing ensuring production readiness.

### Phase 3-4 Combined Success Metrics
- ✅ **Next.js web app** deployed to Vercel (staging)
- ✅ **Admin portal** with 7 menu items fully functional (Antrian, Dokter, Pasien, Keuangan, Inventaris, Audit Log, Pengaturan)
- ✅ **Doctor portal** with queue management, patient check-in, EMR entry
- ✅ **Patient portal** with booking, payment, history, prescriptions
- ✅ **Real-time TV display** (Recommendation #1) - WebSocket live queue updates
- ✅ **Flutter mobile app** (Android) signed APK, Firebase App Distribution ready
- ✅ **Walk-in workflow** (Recommendation #5) functional on mobile and web
- ✅ **AI chat assistant** integrated in patient portal
- ✅ **E2E tests** (Cypress) covering critical user journeys (70%+ passing)
- ✅ **Performance validated:** Web <2s load, Mobile <3s, API p95 <200ms

### Key Dependencies From Previous Phases
- **Phase 2 Exit:** All 50+ backend APIs working, 70%+ coverage, Midtrans verified
- **TDD v1.0:** API contracts, WebSocket spec, security tokens, real-time event types
- **HALAMAN.txt:** Exact UI layouts, menu structures, field placements
- **LOGIC_FLOW.txt:** User workflows, state transitions, real-time data flows
- **Design documents:** Color schemes, typography, component specs

### High-Level Risk Overview (Details in DRP Phase 5)
| Risk | Severity | Mitigation |
|------|----------|-----------|
| WebSocket connection loss | HIGH | Auto-reconnect + fallback to polling (Rec #1) |
| Real-time TV display lag | MEDIUM | Redis pub/sub optimized, <500ms latency |
| Mobile payment flow complexity | HIGH | Thorough testing, clear error messaging |
| E2E test flakiness | MEDIUM | Proper waits, retry logic, environment isolation |
| Firebase distribution permission issues | MEDIUM | Setup key, test signing early in Week 7 |

---

## 🎨 PHASE 3 OVERVIEW (Weeks 5-6: Web UI Implementation)

### What Phase 3 Achieves
By end of Week 6, DentFlow web dashboard will have:
1. **Next.js application** deployed (dev + staging environments)
2. **Admin portal** with all 7 menu pages fully functional
3. **Doctor portal** optimized for queue management
4. **Patient portal** with booking, history, payment
5. **Real-time displays** for TV and doctor screens (WebSocket + polling fallback)
6. **AI chat** integration in patient portal
7. **Responsive design** working on desktop and tablet
8. **Swagger integration** (API docs accessible in app)
9. **20+ E2E test specs** written (validation in Week 8)

### Phase 3 Exit Criteria
```
VERIFY BEFORE STARTING PHASE 4 (MOBILE):

[Gate 1] Next.js project: npm run dev starts without errors
[Gate 2] Admin portal: All 7 menu items clickable, all pages load
[Gate 3] Doctor portal: Queue display, patient check-in working
[Gate 4] Patient portal: Book appointment, view history, payment flow
[Gate 5] Real-time: TV display updates <1 second after event (WebSocket working)
[Gate 6] Fallback: Polling works if WebSocket disconnects (Recommendation #1)
[Gate 6a] TV Display Fallback Verified: Manual disconnect WebSocket → polling starts within 3s
[Gate 6b] TV Display Recovery: WebSocket reconnects automatically every 30s
[Gate 7] Patient EMR History: GET /api/patient/emr-history works with pagination
[Gate 7a] Patient EMR Privacy: Diagnosis field NOT visible in patient portal (doctor-only)
[Gate 7b] Patient EMR Access: Patient can only view own EMR, not other patients
[Gate 8] AI Chat: Responds to patient queries (basic responses OK)
[Gate 8] Responsive: Tablet view (1024px) displays correctly
[Gate 9] API auth: All requests include JWT token, refresh works
[Gate 10] Staging deployed: App live on Vercel, all features accessible

IF ANY GATE FAILS → Fix before Phase 4 starts
```

---

## 📱 PHASE 4 OVERVIEW (Weeks 7-8: Mobile App & E2E Testing)

### What Phase 4 Achieves
By end of Week 8, DentFlow mobile ecosystem will have:
1. **Flutter mobile app** (Android) fully functional
2. **Patient booking** flow optimized for mobile
3. **Walk-in workflow** (Rec #5) implemented and tested
4. **Real-time updates** on mobile (same WebSocket/polling as web)
5. **APK signed** and uploaded to Firebase App Distribution
6. **E2E tests** (Cypress) covering critical journeys (70%+ passing)
7. **Performance** validated: <3s load time, smooth animations
8. **Offline capability** (basic: show cached data when no network)

### Phase 4 Exit Criteria
```
VERIFY BEFORE MOVING TO PHASE 5 (TESTING & DEPLOYMENT):

[Gate 1] Flutter project: flutter run executes without errors
[Gate 2] Mobile UI: All patient portal screens visible and responsive
[Gate 3] Booking flow: Patient can book, pay, get confirmation on mobile
[Gate 4] Walk-in: Temporary profile creation, auto-SMS delivery working
[Gate 5] Real-time: Queue updates visible on mobile <1 second
[Gate 6] APK signed: Signed APK generated, <100MB size
[Gate 7] Firebase distribution: APK uploaded, testable via invite link
[Gate 8] E2E tests: Cypress suite running, ≥70% critical paths passing
[Gate 9] Performance: Lighthouse score ≥90 (mobile), API <200ms p95
[Gate 10] Multi-tenant: Mobile app correctly isolated per branch selection

IF ANY GATE FAILS → Fix before Phase 5 starts
```

---

## 📅 WEEK 5 DETAILED BREAKDOWN (Days 21-25)
### Theme: "Next.js Setup, Design System & Admin Portal Foundation"

**Prerequisites from Phase 2:**
- ✅ Backend APIs deployed to staging (db.dentflow-staging.local)
- ✅ All 50+ endpoints documented and tested
- ✅ Midtrans webhook verified
- ✅ 70%+ test coverage confirmed

**Week 5 Objectives:**
1. Initialize Next.js + TypeScript + Tailwind project structure
2. Implement design system (colors, typography, components)
3. Build authentication layer (JWT token management + refresh token flow)
4. Create Admin Portal sidebar + basic navigation (7 menu items)
5. Setup API integration layer (@tanstack/react-query with interceptors)
6. Implement role-based access control (RBAC) for Patient/Doctor/Admin
7. Setup Vercel deployment pipeline (staging environment + CI/CD)

**Week 5 Success Criteria:**
- [ ] Next.js project starts: `npm run dev` → http://localhost:3000 ✅
- [ ] Design system documented (colors, spacing, typography)
- [ ] Login page working with JWT token storage
- [ ] Admin portal loads with all 7 menu items visible
- [ ] API requests include JWT in Authorization header
- [ ] Staging deployment to Vercel working
- [ ] Lighthouse score ≥85 (desktop)

---

### **Day 21-22 (Next.js Foundation & Design System)**

#### Task 3.1.1: Next.js Project Setup & Configuration
- [ ] Initialize Next.js 14.x project: `npx create-next-app@latest dentflow-web --typescript`
- [ ] Configure TypeScript paths (`@/*` aliases)
- [ ] Setup environment variables:
  - `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3001`
  - `.env.staging`: `NEXT_PUBLIC_API_URL=https://api.dentflow-staging.local`
  - `.env.production`: `NEXT_PUBLIC_API_URL=https://api.dentflow.com`
- [ ] Install core dependencies:
  ```
  npm install @tanstack/react-query axios zod lucide-react tailwindcss
  npm install -D @types/node @testing-library/react jest cypress
  ```
- [ ] Reference: TDD Section 5 (API Contract) for endpoint paths
- [ ] Test: `npm run dev` starts on http://localhost:3000

#### Task 3.1.2: Tailwind CSS Design System Setup
- [ ] Configure Tailwind: `npx tailwindcss init -p`
- [ ] Define color palette (reference HALAMAN.txt for color specs):
  ```typescript
  // tailwind.config.ts
  colors: {
    primary: '#0066cc',      // DentFlow blue
    secondary: '#00cc99',    // Teal accent
    danger: '#cc0000',       // Red for warnings
    success: '#00cc00',      // Green for success
    neutral: '#f5f5f5',      // Light gray
  }
  ```
- [ ] Create component system folder structure:
  ```
  src/components/
    ├── ui/
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── Modal.tsx
    │   ├── Dropdown.tsx
    │   └── Loading.tsx
    ├── layouts/
    │   ├── AdminLayout.tsx (sidebar + top nav)
    │   ├── PatientLayout.tsx
    │   └── DoctorLayout.tsx
    └── shared/
        ├── Header.tsx
        ├── Sidebar.tsx
        └── Footer.tsx
  ```
- [ ] Reference: HALAMAN.txt (admin portal 7 menu items + patient portal layout)

#### Task 3.1.3: Authentication Flow & JWT Token Management
- [ ] Create auth service:
  ```typescript
  // src/services/authService.ts
  export class AuthService {
    login(email: string, password: string): Promise<{token, refreshToken}>
    logout(): void
    refreshToken(): Promise<string>
    getCurrentUser(): User | null
    setToken(token: string): void
  }
  ```
- [ ] Setup context/store for auth state:
  ```typescript
  // src/context/AuthContext.tsx
  - useAuth() hook for components
  - Token refresh on app load
  - Redirect to login if token expired
  ```
- [ ] Configure axios interceptor to add JWT to all requests
- [ ] Test: Register, login, verify JWT in localStorage, auto-logout after 1hr

#### Task 3.1.4: Admin Portal - Sidebar & Navigation System
- [ ] Create AdminSidebar component with 7 menu items:
  ```
  1. Antrian (Queue Management)
  2. Dokter (Doctor Management)
  3. Pasien (Patient Management)
  4. Keuangan (Finance & Invoices)
  5. Inventaris (Inventory)
  6. Audit Log (Activity Log)
  7. Pengaturan (Settings)
  ```
- [ ] Active menu highlighting (CSS class based on current route)
- [ ] Collapsible mobile view (hamburger menu)
- [ ] Reference: HALAMAN.txt Section 10 (Admin Portal Layout)
- [ ] Include logo + user profile dropdown in header

---

### **Day 23 (Admin Portal - Core Pages - Part 1)**

#### Task 3.1.5: Admin Portal - Antrian (Queue Management) Page
- [ ] Fetch queue data from backend: `GET /admin/queues?branchId=xxx`
- [ ] Display real-time queue (WebSocket updates + polling fallback)
  - Patient name, service type, check-in time, current status
  - Show assigned doctor
  - Show wait time estimate
- [ ] Features:
  - [ ] Call next patient button → `POST /queues/{id}/call-next`
  - [ ] Manually check-in walk-in → opens modal with temp profile
  - [ ] Filter by doctor/service
  - [ ] Export queue list (CSV)
- [ ] Real-time indicator: Green dot = live data, gray = last updated 5s ago
- [ ] Reference: LOGIC_FLOW.txt (Queue State Machine)
- [ ] Reference: Recommendation #1 (TV Display real-time)

#### Task 3.1.6: Admin Portal - Dokter (Doctor Management) Page
- [ ] Create table of all doctors in current branch:
  - [ ] Columns: Name, Specialization, License #, Status (Active/Inactive)
  - [ ] Show current queue count per doctor
  - [ ] Schedule view (weekly calendar)
- [ ] Features:
  - [ ] Add doctor button → form modal
  - [ ] Edit doctor → modal with current details
  - [ ] Deactivate/activate toggle
  - [ ] View doctor schedule
  - [ ] Bulk assign to time slots
- [ ] Backend endpoints used:
  - GET /doctors?branchId=xxx
  - POST /doctors
  - PUT /doctors/{id}
  - PATCH /doctors/{id}/status
- [ ] Reference: TDD Section 5 (Doctor API endpoints)

#### Task 3.1.7: Admin Portal - Pasien (Patient Management) Page
- [ ] Create searchable patient list with pagination:
  - [ ] Columns: Name, Phone, Email, Total Bookings, Last Visit
  - [ ] Search by name/phone/email
  - [ ] Pagination: 20 rows per page
- [ ] Features:
  - [ ] View patient details modal (history, EMR, invoices)
  - [ ] Edit patient info
  - [ ] Merge duplicate patient records (if found)
  - [ ] View patient audit trail (all actions on this patient)
- [ ] Backend endpoints:
  - GET /patients?search=xxx&page=1
  - GET /patients/{id}
  - PUT /patients/{id}
  - GET /patients/{id}/audit-trail
- [ ] Reference: TDD Section 5 (Patient API endpoints)

---

### **Day 24 (Admin Portal - Core Pages - Part 2)**

#### Task 3.1.8: Admin Portal - Keuangan (Finance & Invoices) Page
- [ ] Dashboard view:
  - [ ] Revenue card (today, this month, YTD)
  - [ ] Outstanding invoices count
  - [ ] Payment method breakdown (chart)
- [ ] Invoice management table:
  - [ ] Columns: Invoice #, Patient, Amount, Status (UNPAID/PAID), Due Date
  - [ ] Filter by status, date range
  - [ ] Sort by amount descending
- [ ] Features:
  - [ ] View invoice details modal (items, payment method, notes)
  - [ ] Manual payment entry → `POST /invoices/{id}/payments`
  - [ ] Send payment reminder email
  - [ ] Download invoice as PDF
- [ ] Real-time invoice state (Recommendation #3):
  - [ ] Display state: UNPAID → PAID (one-way, grayed out after PAID)
  - [ ] No back-button or undo (emphasize immutability)
- [ ] Backend endpoints:
  - GET /invoices?filter=xxx
  - GET /invoices/{id}
  - POST /invoices/{id}/payments
  - POST /invoices/{id}/send-reminder
- [ ] Reference: Recommendation #3 (Invoice Payment State Machine)
- [ ] Reference: DRP.md (payment failure scenarios)

#### Task 3.1.9: Admin Portal - Inventaris (Inventory) Page
- [ ] Create inventory list (medications, equipment):
  - [ ] Columns: Item Name, Category, Quantity, Unit Cost, Min Level, Supplier
- [ ] Features:
  - [ ] Low stock alert (red if below min level)
  - [ ] Add new item button
  - [ ] Edit item details
  - [ ] Record stock adjustment (manual count)
  - [ ] Supplier contact list
- [ ] Backend endpoints:
  - GET /inventory?branchId=xxx
  - POST /inventory
  - PUT /inventory/{id}
  - PATCH /inventory/{id}/quantity
- [ ] Reference: PRD.txt (Inventory requirements)

#### Task 3.1.10: Admin Portal - Audit Log Page & Pengaturan (Settings)
**Audit Log Page:**
- [ ] Display immutable audit log (append-only, no edit/delete):
  - [ ] Columns: Timestamp, User, Action, Resource, Changes (JSON), IP Address
  - [ ] Filter by action type, date range, user
  - [ ] Export to CSV
- [ ] Backend endpoint: `GET /audit-logs?filter=xxx`
- [ ] Reference: PRD Line 189-192 (Immutable Audit Logs)
- [ ] Reference: STP P0 Feature (Audit Log 100% coverage)

**Settings Page:**
- [ ] Clinic info (branch name, address, phone, email)
- [ ] Business hours (operational hours, break times)
- [ ] Payment settings (Midtrans key, webhook URL)
- [ ] Notification settings (email reminders on/off, SMS gateway)
- [ ] Features:
  - [ ] Edit and save clinic info
  - [ ] Verify Midtrans webhook (test button)
  - [ ] Export API docs (Swagger link)
- [ ] Backend endpoints:
  - GET /settings
  - PUT /settings

---

### **Day 25 (Patient Portal Setup & Real-Time Integration)**

#### Task 3.1.11: Patient Portal - Dashboard & Booking Page
- [ ] Patient dashboard (after login):
  - [ ] Welcome card with next appointment
  - [ ] Recent bookings (last 5)
  - [ ] Health tips carousel
  - [ ] Upcoming appointments calendar view
- [ ] Book appointment flow:
  - [ ] Select doctor → Select time slot → Confirm → Pay
  - [ ] Show available slots based on doctor schedule
  - [ ] Real-time slot availability (WebSocket or polling every 5s)
  - [ ] Payment integration (Midtrans SNAP popup)
  - [ ] Booking confirmation SMS/email
- [ ] Backend endpoints:
  - GET /doctors?branchId=xxx&available=true
  - GET /doctor/{id}/slots?date=2026-07-15
  - POST /bookings
  - POST /bookings/{id}/payment
- [ ] Reference: LOGIC_FLOW.txt (Booking Flow)

#### Task 3.1.12: WebSocket Setup for Real-Time Features (Recommendation #1) ⭐ CRITICAL
**Objective:** Implement real-time communication for queue updates, slot availability, and TV displays

**Tech Stack:**
- Socket.IO client (React integration)
- @tanstack/react-query for cache synchronization
- Custom React hooks for connection management
- Fallback polling strategy (5-second intervals)

**Implementation Details:**

1. **WebSocket Service Setup:**
   ```typescript
   // lib/websocket.ts
   import io from 'socket.io-client';
   
   export const createWebSocketService = () => {
     const socket = io(process.env.NEXT_PUBLIC_API_URL, {
       auth: { token: localStorage.getItem('token') },
       reconnection: true,
       reconnectionDelay: 1000,
       reconnectionAttempts: 5,
     });
   
     socket.on('queue:updated', (data) => {
       // Invalidate React Query cache
       queryClient.invalidateQueries(['queue-display']);
     });
   
     socket.on('disconnect', () => {
       console.warn('WebSocket disconnected, falling back to polling');
       // Activate polling fallback
     });
   
     return socket;
   };
   ```

2. **Event Types (from TDD Section 5):**
   - `queue:updated` - Queue number assigned, display updated
   - `slot:availability` - Doctor slot filled/cancelled
   - `tv:display:refresh` - TV display needs update (Rec #1)
   - `invoice:paid` - Invoice payment received (Rec #3)
   - `appointment:confirmed` - Booking confirmed notification

3. **Polling Fallback (Auto-activate if WS fails):**
   ```typescript
   const useQueueDisplay = () => {
     const [isWebSocketConnected, setIsConnected] = useState(true);
     const pollInterval = isWebSocketConnected ? null : 5000; // 5s if disconnected
     
     const { data } = useQuery(
       ['queue-display'],
       fetchQueueDisplay,
       { refetchInterval: pollInterval }
     );
   
     return data;
   };
   ```

4. **Connection Status Indicator:**
   - [ ] Visual indicator (dot: green=connected, red=disconnected)
   - [ ] Auto-reconnect every 30 seconds if disconnected
   - [ ] Show toast notification if fallback activated
   - [ ] Reference: Recommendation #1 (WebSocket fallback requirement)

**Acceptance Criteria:**
- [ ] WebSocket connects on app load: Connection establishes within 2s
- [ ] TV display updates: Updates visible <1s after queue event
- [ ] Polling fallback: If WebSocket dies, polling starts within 3s
- [ ] Reconnection: Auto-reconnects within 30s if connection lost
- [ ] Performance: No memory leaks (test with DevTools)
- [ ] Security: JWT token refreshed before expiry
- [ ] Error handling: Graceful degradation, no app crashes
- [ ] Logging: Connection events logged (for debugging)

**Reference:**
- TDD Section 5.2: Real-Time API Spec
- Recommendation #1: TV Display Real-Time (WebSocket + polling fallback)
- DRP.md: Real-time connection failures mitigation

---
  ```typescript
  // src/services/realtimeService.ts
  export class RealtimeService {
    connect(token: string): void
    onQueueUpdate(branchId: string, callback: (data) => void): void
    onSlotUpdate(doctorId: string, callback: (slots) => void): void
    disconnect(): void
  }
  ```
- [ ] Backend expects WebSocket server at `ws://localhost:3001` (already running from Phase 2)
- [ ] Events to subscribe to:
  - `queue:updated` → queue list changed
  - `slot:available` → new time slot opened
  - `booking:confirmed` → patient's booking confirmed
- [ ] Fallback mechanism: If WebSocket unavailable, poll API every 5s
- [ ] Reference: TDD Section 6 (WebSocket Spec)
- [ ] Reference: Recommendation #1 (TV Display real-time with fallback)

#### Task 3.1.13: Real-Time TV Display Component (Recommendation #1 + Fallback)
- [ ] Create `/tv-display` page (simple, auto-refresh every 5s if no WS):
  - [ ] Large queue display: Patient names + queue numbers (25+ font size)
  - [ ] Current patient being served (highlighted)
  - [ ] "Now serving: #5 (John Doe)" banner
  - [ ] Next 3 patients in queue below
  - [ ] No navigation, no buttons (kiosk mode)

- [ ] Implement WebSocket + Polling Fallback (Recommendation #1 - TV Display):
  - [ ] Primary: WebSocket connection to `ws://backend/ws/queue/{branch_id}/{doctor_id}`
    - Instant updates when queue changes
    - Broadcast to all connected TV displays
    - **[FIXED]** Updated to match TDD Section 5, Line 1679
  - [ ] Fallback: Polling if WebSocket fails
    - Detect WebSocket connection failure (onclose, onerror)
    - Switch to polling: `GET /api/queue/status?branch_id=...&doctor_id=...` every 2-3 seconds
    - Show indicator: "Offline mode - refreshing every 3s"
    - Retry WebSocket connection every 30s
    - **[FIXED]** Standardized to canonical endpoint path
  - [ ] Graceful degradation:
    - If polling also fails: Show cached last-known state + "Connection lost" banner
    - Admin alert: Send email if TV display disconnected for >5 min

- [ ] Features:
  - [ ] Full-screen mode (F11 compatible)
  - [ ] Auto-refresh: WS updates instant, polling 2-3s if no WS, retry every 30s
  - [ ] Branch selector: URL param `?branch_id=xxx` (use snake_case per TDD standards)
  - [ ] Connection status indicator (Connected / Polling / Offline)
  - [ ] Last updated timestamp (HH:MM:SS format)

- [ ] Backend requirements (reference TDD Section 5 & 10 - TV Display):
  - GET /api/queue/status?branch_id=...&doctor_id=... (polling endpoint - CANONICAL)
  - WebSocket: ws://backend/ws/queue/{branch_id}/{doctor_id} (real-time broadcast)
  - Response includes: current_patient, next_3_patients, updated_at
  - **[FIXED]** Standardized all queue endpoint paths to canonical form

- [ ] Reference: HALAMAN.txt (TV Display Layout)
- [ ] Reference: TDD Section 5 (Queue APIs), TDD Section 10 (TV Display)
- [ ] Reference: Recommendation #1 (TV Display real-time with fallback)

#### Task 3.1.14: Testing & Build Validation
- [ ] Run `npm run build` - no errors
- [ ] Run `npm run lint` - no ESLint errors
- [ ] Test admin navigation: Click all 7 menu items, all pages load
- [ ] Test patient booking: Register → Book → Pay (mock Midtrans)
- [ ] Test WebSocket: Open TV display + Queue page, verify updates sync
- [ ] Create Vercel project and deploy staging: `vercel --prod`
- [ ] Test staging: Verify all pages accessible via HTTPS

---

## 📅 WEEK 6 DETAILED BREAKDOWN (Days 26-30)
### Theme: "Real-Time Features, Patient Portal Completion & AI Chat Integration"

**Prerequisites from Week 5:**
- ✅ Next.js app running locally
- ✅ Admin portal all 7 pages accessible
- ✅ Patient portal basic flow working
- ✅ WebSocket connected and receiving updates
- ✅ Staging deployed to Vercel
- ✅ Design system locked (colors, typography, spacing)
- ✅ Authentication working (login/logout/token refresh)

**Week 6 Objectives:**
1. Complete patient portal (medical history, invoices, appointments, profile)
2. Implement all real-time features (queue updates, slot availability, TV display)
3. Integrate AI chat assistant (Dialogflow or OpenAI)
4. Implement all 6 recommendations visually on patient/doctor surfaces
5. Complete E2E test specs for critical patient flows
6. Performance optimization (Lighthouse ≥85)
7. Responsive design validation (mobile/tablet/desktop)

**Week 6 Success Criteria:**
- [ ] Patient portal fully functional (all 4 sub-pages working)
- [ ] Real-time queue display <1 second latency on TV + web + mobile
- [ ] AI chat responds to basic patient queries (≥80% user satisfaction)
- [ ] All 6 recommendations visible in UI (no hidden features)
- [ ] Lighthouse performance score ≥85 (mobile + desktop)
- [ ] E2E test specs written for patient booking flow
- [ ] Zero critical bugs on staging deployment
- [ ] Responsive design validated on 3+ screen sizes

---

### **Day 26-27 (Patient Portal - History, Prescriptions, Invoices)**

#### Task 3.2.1: Patient Portal - Medical History (Patient EMR History)
**Objective:** Display patient's EMR history with privacy enforcement (Recommendation #1)

- [ ] Create tabbed interface:
  - [ ] Tab 1: Visit History (EMR Encounters)
    - [ ] List all past encounters with doctor
    - [ ] Columns: Date, Doctor, Reason, Status (Completed/Cancelled)
    - [ ] Click to expand: Full encounter details, diagnosis (doctor-visible only), treatment notes
    - [ ] Download encounter summary as PDF (no diagnosis, patient-safe version)
    - [ ] Show appointment fee + payment status
  - [ ] Tab 2: Prescriptions (if implemented in later phase)
    - [ ] List active/past prescriptions
    - [ ] Columns: Medication, Dosage, Frequency, Prescribed Date, Expiry
    - [ ] Show prescription refill count remaining
    - [ ] Refill button → request to clinic

- [ ] Backend endpoints (reference TDD Section 7 - Patient EMR):
  - [ ] **GET /api/patient/emr-history?page=1&limit=10** (TDD Section 7.1)
    - List patient's encounters (pagination supported)
    - Returns: encounter_id, date, doctor_name, branch_name, status, fee, payment_status
    - **PRIVACY:** Diagnosis NOT included in this endpoint (doctor-only)
  - [ ] **GET /api/patient/emr/{emr_id}** (TDD Section 7.2)
    - View single encounter details
    - Returns: full encounter + treatment notes
    - **PRIVACY:** Diagnosis hidden from patient (doctor field only)
    - Shows: date, doctor, chief_complaint, treatment_notes, fee, invoice_id
  - ~~GET /patients/{id}/prescriptions~~ **[DEFERRED TO V2.0]**
  - ~~POST /prescriptions/{id}/refill-request~~ **[DEFERRED TO V2.0]**
    - **Note:** Prescription management is complex feature (refill logic, doctor approval, etc.)
    - Out of scope for v1.0 MVP (9-week sprint)
    - Audit Fix: Issue #7 Resolution - Move to v2.0 backlog
    - TDD Section 14 (Known Limitations): Prescriptions NOT IMPLEMENTED v1.0

- [ ] Privacy & Security:
  - [ ] Patient can only view OWN EMR history (not other patients)
  - [ ] Diagnosis field NOT shown to patient (read doctor notes instead)
  - [ ] Only patient + assigned doctor can access (verified via JWT + branchId)
  - [ ] Audit log: "PATIENT_EMR_VIEWED" for every access

- [ ] Reference: TDD Section 7 (Patient EMR Endpoints - NEW)
- [ ] Reference: LOGIC_FLOW.txt (EMR Flow)
- [ ] Reference: Recommendation #1 (Patient privacy enforcement)

#### Task 3.2.2: Patient Portal - Invoices & Payment History
- [ ] Create invoice section:
  - [ ] List all invoices (paid + unpaid)
  - [ ] Columns: Invoice #, Date, Amount, Status (UNPAID/PAID/OVERDUE), Due Date
  - [ ] Filter by status
- [ ] Features:
  - [ ] Click unpaid invoice → payment modal (auto-show Midtrans SNAP)
  - [ ] Click paid invoice → view receipt (PDF download)
  - [ ] Payment history timeline (when did each invoice get paid)
- [ ] Real-time state (Recommendation #3):
  - [ ] Once PAID, show payment date + method
  - [ ] Emphasize: "Payment received" message, no edit/undo option
- [ ] Backend endpoints:
  - GET /patients/{id}/invoices
  - GET /invoices/{id}
  - POST /invoices/{id}/pay (Midtrans redirect)
- [ ] Reference: Recommendation #3 (Invoice state machine)

#### Task 3.2.3: Patient Portal - Appointment Management
- [ ] Create booking management page:
  - [ ] Upcoming appointments: Large cards showing date/time/doctor/reason
  - [ ] Reschedule button → calendar picker → new time slot selection
  - [ ] Cancel button (only if >24hrs before appointment)
  - [ ] Add to calendar (iCal download)
- [ ] Features:
  - [ ] SMS + Email reminders (1 day before, 1 hour before)
  - [ ] Show check-in status (if appointment is today: "Check in here" button)
  - [ ] Feedback form (rate doctor + appointment)
- [ ] Backend endpoints:
  - GET /patients/{id}/bookings?status=upcoming
  - PATCH /bookings/{id} (reschedule)
  - DELETE /bookings/{id} (cancel)
  - POST /bookings/{id}/feedback
- [ ] Reference: LOGIC_FLOW.txt (Booking State Machine)

#### Task 3.2.4: Patient Portal - Profile & Settings
- [ ] Profile editing page:
  - [ ] Edit name, phone, email
  - [ ] Upload profile photo
  - [ ] Add emergency contacts
  - [ ] Add medical conditions/allergies
  - [ ] Privacy settings (share data with doctors Y/N)
- [ ] Settings section:
  - [ ] Notification preferences (SMS/Email/None)
  - [ ] Language (EN/ID)
  - [ ] Password change
  - [ ] Logout button
- [ ] Backend endpoints:
  - PUT /patients/{id}
  - PATCH /patients/{id}/photo
  - POST /patients/{id}/emergency-contacts
  - PATCH /patients/{id}/settings

---

### **Day 28-29 (AI Chat Assistant & Doctor Portal Enhancements)**

#### Task 3.2.5: AI Chat Assistant Integration (Patient Portal)
- [ ] Integrate AI chat component (bottom-right floating button):
  ```typescript
  // src/components/AIChatWidget.tsx
  - Send message → call backend AI API
  - Show typing indicator while waiting
  - Display responses in chat bubble
  - Maintain conversation history (5-10 last messages)
  ```
- [ ] Chat capabilities (basic for v1):
  - [ ] "What is my next appointment?" → parse patient's booking
  - [ ] "When can I see Dr. Budi?" → show available slots
  - [ ] "How much do I owe?" → calculate total unpaid invoices
  - [ ] "What's my prescription?" → list current prescriptions
  - [ ] Generic health questions → OpenAI API (gpt-4-turbo)
- [ ] Features:
  - [ ] Only available for logged-in patients
  - [ ] Conversation context (knows patient's name, medical history)
  - [ ] Fallback: "Contact admin for more help" with admin phone link
- [ ] Backend endpoint:
  - POST /ai/chat (accepts message, returns response)
- [ ] Reference: PRD.txt (AI Chat Assistant requirement)

#### Task 3.2.6: Doctor Portal - Queue Management & Patient Check-In
- [ ] Create doctor dashboard:
  - [ ] Today's queue (live updates via WebSocket)
  - [ ] Show patient names + wait time
  - [ ] "Ready for next" button
  - [ ] Search patient by name/queue number (quick lookup)
- [ ] Check-in flow:
  - [ ] Click "Check in patient" → opens patient record
  - [ ] Can see patient's history, allergies, current medications
  - [ ] Start consultation → EMR form
  - [ ] Once done → "Complete encounter" saves EMR + generates invoice auto
- [ ] Queue view:
  - [ ] Current patient (highlighted in green)
  - [ ] Next 3 patients (queued)
  - [ ] Waiting room count
- [ ] Backend endpoints:
  - GET /doctors/{id}/queue-today
  - POST /doctors/{id}/ready-next
  - GET /patients/{id}/quick-view (reduced data)
  - POST /encounters (create new EMR)
- [ ] Reference: LOGIC_FLOW.txt (Doctor Queue Flow)

#### Task 3.2.7: Doctor Portal - EMR Entry & Prescription Writing
- [ ] EMR form (on-patient check-in):
  - [ ] Complaint/reason input
  - [ ] Vital signs (BP, HR, temp, weight)
  - [ ] Diagnosis selection (dropdown + search)
  - [ ] Notes (free text)
  - [ ] Upload images (X-ray, lab results)
- [ ] Prescription writing:
  - [ ] Add medications (autocomplete from inventory)
  - [ ] Set dosage/frequency/duration
  - [ ] Add notes to patient
  - [ ] Save prescription (auto-generates on patient portal)
- [ ] Features:
  - [ ] Auto-save draft every 30s
  - [ ] Submit button → creates Encounter record + auto Invoice + updates queue
  - [ ] Show patient's past prescriptions for reference
- [ ] Backend endpoints:
  - POST /encounters (create EMR)
  - POST /prescriptions (create prescription)
  - GET /inventory (medication list for autocomplete)
- [ ] Reference: LOGIC_FLOW.txt (EMR Flow)

#### Task 3.2.8: Doctor Portal - Schedule & Settings
- [ ] Doctor schedule page:
  - [ ] Weekly calendar view
  - [ ] Show booked slots, available slots, breaks
  - [ ] Add/edit working hours
  - [ ] Bulk assign days off
  - [ ] View replacement doctor if taking leave
- [ ] Settings:
  - [ ] Personal info (phone, email, license #)
  - [ ] Specialization
  - [ ] Consultation fee
  - [ ] Availability preferences (alert if overbooking)
- [ ] Backend endpoints:
  - GET /doctors/{id}/schedule
  - PUT /doctors/{id}/schedule
  - PATCH /doctors/{id}/availability

---

### **Day 30 (E2E Test Setup, Performance Optimization & Staging Validation)**

#### Task 3.2.9: E2E Test Suite Setup (Cypress)
- [ ] Initialize Cypress: `npm install -D cypress`
- [ ] Create test structure:
  ```
  cypress/
    ├── e2e/
    │   ├── auth.cy.ts (login, logout, token refresh)
    │   ├── patient-booking.cy.ts (full booking flow)
    │   ├── admin-queue.cy.ts (queue management)
    │   ├── doctor-workflow.cy.ts (check-in, EMR, invoice)
    │   ├── real-time.cy.ts (WebSocket updates)
    │   └── payments.cy.ts (invoice payment flow)
    └── fixtures/
        └── testData.json
  ```
- [ ] Key tests to write:
  - [ ] **Patient Booking E2E:**
    ```
    1. Login as patient
    2. Book appointment (select doctor → select slot → pay)
    3. Verify booking in profile
    4. Verify invoice generated
    5. Pay invoice
    6. Verify receipt
    ```
  - [ ] **Admin Queue E2E:**
    ```
    1. Login as admin
    2. View queue (real-time updates)
    3. Call next patient
    4. Doctor checks in
    5. Complete encounter (invoice auto-generated)
    ```
  - [ ] **Real-Time E2E:**
    ```
    1. Open TV display page
    2. Admin calls next patient
    3. Verify TV display updates <1s
    4. Close WebSocket, verify polling fallback
    ```
- [ ] Backend test data setup (Phase 2 already has this)
- [ ] Run tests: `npm run cypress:open` (interactive) or `npm run cypress:run` (CI)

#### Task 3.2.10: Performance Optimization & Final Staging Validation
- [ ] Performance audits:
  - [ ] Run Lighthouse: target ≥90 score (mobile + desktop)
  - [ ] Optimize images: Use next/image, WebP format
  - [ ] Code splitting: Lazy load heavy components
  - [ ] API caching: Use React Query staleTime strategically
- [ ] Staging deployment checklist:
  - [ ] Environment variables set (NEXT_PUBLIC_API_URL pointing to staging backend)
  - [ ] All 7 admin pages load <2s
  - [ ] Patient booking end-to-end works
  - [ ] Real-time updates visible (TV display + queue updates)
  - [ ] Mobile responsive (test on actual tablet/phone)
  - [ ] WebSocket fallback to polling verified (disconnect Wi-Fi test)
  - [ ] Vercel analytics enabled (measure real user performance)
  - [ ] Sentry error tracking configured (catch production errors)
- [ ] Final validation: Deploy to staging + test all critical flows
- [ ] Create deployment checklist doc (for Phase 5 production deployment)

---

## 📅 WEEK 7 DETAILED BREAKDOWN (Days 31-35)
### Theme: "Flutter Mobile App Development & Walk-In Workflow"

**Prerequisites from Phase 3 (Weeks 5-6):**
- ✅ Next.js web app fully functional on staging
- ✅ All admin portal 7 pages working
- ✅ Real-time WebSocket operational
- ✅ Patient portal complete (booking, history, invoices)

---

### **Day 31-32 (Flutter Setup & Patient Mobile App Foundation)**

#### Task 4.1.1: Flutter Project Setup & Dependencies
- [ ] Initialize Flutter project: `flutter create dentflow_mobile`
- [ ] Configure for Android only (iOS in v2)
- [ ] Install core dependencies in pubspec.yaml:
  ```yaml
  dependencies:
    flutter:
      sdk: flutter
    http: ^1.1.0
    provider: ^6.0.0
    socket_io_client: ^2.0.0
    jwt_decoder: ^2.0.1
    get_storage: ^2.1.1
    google_maps_flutter: ^2.5.0 (optional)
    image_picker: ^1.0.0
    permission_handler: ^11.0.0
  ```
- [ ] Configure Android project:
  - [ ] Minimum SDK: 21, Target SDK: 34
  - [ ] Add Internet permission in AndroidManifest.xml
  - [ ] Setup Firebase for push notifications (APK distribution)
- [ ] Test: `flutter run` launches on emulator without errors

#### Task 4.1.2: Authentication & Secure Token Storage
- [ ] Create auth provider (using Provider package):
  ```dart
  class AuthProvider with ChangeNotifier {
    login(email, password): Future<void>
    logout(): void
    refreshToken(): Future<void>
    getCurrentUser(): User?
    isLoggedIn: bool
  }
  ```
- [ ] Token storage (secure, using get_storage):
  - [ ] Store JWT token locally (encrypted)
  - [ ] Refresh token logic (auto-refresh if expiry <5min)
  - [ ] Logout: clear all tokens
- [ ] HTTP client interceptor:
  - [ ] Add JWT to all requests
  - [ ] Handle 401 responses (redirect to login)
- [ ] Test: Login flow, token persistence, logout

#### Task 4.1.3: Patient Mobile App - Navigation & Screens
- [ ] Create bottom navigation (4 tabs):
  ```
  Tab 1: Home (Dashboard + upcoming appointment)
  Tab 2: Bookings (List all bookings + book new)
  Tab 3: Health (History + prescriptions + AI chat)
  Tab 4: Profile (Settings + account + documents)
  ```
- [ ] Create navigation structure:
  - [ ] AuthStack (login, register screens)
  - [ ] AppStack (4 tabs + modals for booking, payment)
- [ ] Implement simple splash screen (2s on app launch)
- [ ] Reference: HALAMAN.txt (Mobile screen layout)

#### Task 4.1.4: Patient Mobile - Home Screen & Quick Actions
- [ ] Home screen components:
  - [ ] Greeting card (Hello, [Name])
  - [ ] Next appointment card (if any):
    - [ ] Show doctor name, time, location
    - [ ] "Reschedule" + "Cancel" buttons
  - [ ] Recent bookings (carousel, swipeable)
  - [ ] Health reminders (medication refills, follow-ups)
  - [ ] Quick action buttons: "Book Now", "Emergency"
- [ ] Features:
  - [ ] Pull-to-refresh (fetch latest data)
  - [ ] Error handling (network unavailable → show cached data)
- [ ] Backend calls:
  - GET /patients/{id} (user info)
  - GET /patients/{id}/bookings?limit=5 (upcoming)
  - GET /patients/{id}/prescriptions (active)

---

### **Day 33 (Mobile Booking & Payment Flow)**

#### Task 4.1.5: Patient Mobile - Book Appointment Flow
- [ ] Booking flow (step-by-step):
  ```
  Step 1: Select Branch (dropdown, remember last selection)
  Step 2: Select Doctor (list, filter by specialization)
  Step 3: Select Time (calendar + time slots, real-time availability)
  Step 4: Review & Confirm (show doctor, time, fee)
  Step 5: Payment (Midtrans SNAP webview)
  Step 6: Confirmation (success screen + SMS sent)
  ```
- [ ] Features:
  - [ ] Search doctor by name/specialization
  - [ ] Show doctor availability (green = available)
  - [ ] Real-time slot updates (polling every 10s)
  - [ ] Show consultation fee upfront
  - [ ] Confirmation SMS/email
- [ ] Backend endpoints:
  - GET /branches
  - GET /doctors?branchId=xxx
  - GET /doctors/{id}/slots?date=2026-07-15
  - POST /bookings
  - POST /bookings/{id}/payment (redirect to Midtrans)

#### Task 4.1.6: Patient Mobile - Payments & Invoice Management
- [ ] Invoice section (Tab 2):
  - [ ] List invoices (paid + unpaid)
  - [ ] Unpaid invoice: "Pay Now" button → Midtrans SNAP webview
  - [ ] Paid invoice: View receipt (PDF preview)
  - [ ] Payment history timeline
- [ ] Real-time state (Recommendation #3):
  - [ ] Once paid, show "Payment received" badge
  - [ ] No edit/undo after PAID
- [ ] Features:
  - [ ] Payment method display (credit card, e-wallet, etc)
  - [ ] Download invoice as PDF
  - [ ] Share invoice (WhatsApp, email)
- [ ] Backend endpoints:
  - GET /patients/{id}/invoices
  - POST /invoices/{id}/pay

#### Task 4.1.7: Patient Mobile - Walk-In Booking (Recommendation #5)
- [ ] Walk-in special flow:
  - [ ] "Check In As Walk-In" button on home screen
  - [ ] Flow: Select service → Accept T&C → Enter temp name → Auto SMS with temp ID
  - [ ] Temporary profile creation:
    - [ ] Phone number (for SMS link)
    - [ ] Preferred doctor (optional)
    - [ ] Service/reason
  - [ ] System sends SMS: "Your queue number: #23. Check-in code: ABC123"
  - [ ] Patient can then track their queue via SMS link (no login needed)
- [ ] Backend flow (created in Phase 2):
  - POST /bookings/walk-in (creates temp patient + booking)
  - Response includes: tempPatientId, queueNumber, checkInCode
- [ ] Features:
  - [ ] Walk-in can view queue status (polling, no WebSocket)
  - [ ] Show wait time estimate
  - [ ] Notification when approaching
  - [ ] If chooses to pay online: capture email/name for invoice
- [ ] Reference: Recommendation #5 (Walk-in Profiles)

---

### **Day 34-35 (Doctor Mobile App & Real-Time)**

#### Task 4.1.8: Doctor Mobile App - Queue Management & Check-In
- [ ] Doctor auth:
  - [ ] Login with doctor credentials (username/password)
  - [ ] Store JWT token + refresh token
  - [ ] Pin code or biometric lock (security)
- [ ] Doctor main screen:
  - [ ] Today's queue (live WebSocket updates)
  - [ ] Show current patient (large card, green)
  - [ ] Next 3 patients (below)
  - [ ] "Ready for next" button
- [ ] Patient check-in flow:
  - [ ] Click patient → opens patient quick view (history, allergies, current meds)
  - [ ] "Start consultation" → opens EMR form (simplified for mobile)
- [ ] EMR form (mobile optimized):
  - [ ] Vital signs inputs (BP, HR, temp, weight)
  - [ ] Diagnosis selector (searchable dropdown)
  - [ ] Notes (text area)
  - [ ] Attach images (camera/gallery)
  - [ ] "Complete" button → saves encounter + generates invoice
- [ ] Backend endpoints:
  - GET /doctors/{id}/queue-today
  - POST /doctors/{id}/ready-next
  - GET /patients/{id}/quick-view
  - POST /encounters

#### Task 4.1.9: Mobile - AI Chat Widget
- [ ] Floating chat button (bottom-right):
  - [ ] Only for patient app (not doctor app)
  - [ ] Tap opens chat modal
- [ ] Chat capabilities:
  - [ ] "What's my next appointment?"
  - [ ] "Show my prescriptions"
  - [ ] "How much do I owe?"
  - [ ] General health questions (OpenAI)
- [ ] Features:
  - [ ] Conversation history (last 5-10 messages)
  - [ ] Typing indicator while waiting for response
  - [ ] Fallback: "Contact us" button with clinic phone link

#### Task 4.1.10: Real-Time Features on Mobile (Recommendation #1)
- [ ] WebSocket integration:
  - [ ] Connect to same WebSocket server as web (wss://xxx)
  - [ ] Subscribe to doctor's queue channel
  - [ ] Live queue updates on doctor app (call status, new arrivals)
  - [ ] Polling fallback: if WebSocket disconnects, poll every 10s
- [ ] Doctor app: Real-time notification when new patient arrives in queue
  - [ ] Show notification badge on queue icon
  - [ ] Local notification sound/vibration
- [ ] Patient app: Real-time slot availability updates
  - [ ] If viewing doctor's slots, auto-update when new slot opens

---

## 📅 WEEK 8 DETAILED BREAKDOWN (Days 36-40)
### Theme: "E2E Testing, Performance Optimization, APK Signing & Mobile Polish"

**Prerequisites from Week 7:**
- ✅ Flutter mobile app functional (patient + doctor app)
- ✅ Walk-in booking working
- ✅ Real-time updates working on mobile
- ✅ Cypress E2E tests written for web

---

### **Day 36-37 (E2E Tests Expansion & Mobile Testing)**

#### Task 4.2.1: Cypress E2E Test Expansion & Integration
- [ ] Add advanced test scenarios:
  - [ ] **Complete patient journey (70+ assertions):**
    ```
    1. Register new patient
    2. Login
    3. Book appointment with payment
    4. Verify invoice generated
    5. Pay invoice
    6. Receive SMS confirmation
    7. View booking in profile
    8. Rate appointment
    ```
  - [ ] **Doctor workflow (50+ assertions):**
    ```
    1. Doctor login
    2. View today's queue
    3. Call next patient
    4. Fill EMR (vitals, diagnosis)
    5. Write prescription
    6. Complete encounter
    7. Verify invoice auto-generated
    8. Patient can see prescription
    ```
  - [ ] **Real-time flow (40+ assertions):**
    ```
    1. Open TV display + Admin queue pages
    2. Admin calls next patient
    3. TV display updates <1s
    4. Close WebSocket (simulate network disconnect)
    5. Verify polling fallback active
    6. Verify UI still updates
    ```
- [ ] Test data management:
  - [ ] Create/delete test patients before each suite
  - [ ] Reset queue state between doctor tests
  - [ ] Mock Midtrans payments (sandbox mode)
- [ ] Run tests: `npm run cypress:run` (headless)
- [ ] Target: ≥70% of critical paths covered, all tests passing

#### Task 4.2.2: Mobile App Testing & Bug Fixes
- [ ] Manual testing on Android emulator:
  - [ ] Login/logout flow (10 min)
  - [ ] Book appointment (real-time slots, payment) (15 min)
  - [ ] Walk-in booking (receive SMS) (10 min)
  - [ ] Profile management (update info, change password) (10 min)
  - [ ] AI chat (basic responses) (5 min)
- [ ] Doctor app testing:
  - [ ] Login as doctor (10 min)
  - [ ] View queue, call next, check-in patient (15 min)
  - [ ] Fill EMR, write prescription, complete (15 min)
- [ ] Network resilience:
  - [ ] Disable Wi-Fi → verify app doesn't crash (shows error)
  - [ ] Re-enable Wi-Fi → verify auto-reconnect
  - [ ] WebSocket disconnect → verify polling fallback
- [ ] Performance:
  - [ ] Login time: <2s
  - [ ] Booking page load: <3s
  - [ ] Queue updates: <1s (WebSocket), <10s (polling)
- [ ] Bug fixes: Fix any UI glitches, network issues, crashes found

#### Task 4.2.3: Performance Optimization (Web + Mobile)
- [ ] Web optimization:
  - [ ] Run Lighthouse again: target ≥90 score
  - [ ] Optimize critical images (use WebP)
  - [ ] Enable gzip compression (Vercel auto)
  - [ ] Reduce JavaScript bundle (lazy load modals)
  - [ ] API response caching (React Query)
- [ ] Mobile optimization:
  - [ ] App size: target <100MB (Flutter usually 40-60MB)
  - [ ] Remove unused assets
  - [ ] ProGuard rules for minification (Android)
  - [ ] Test APK size with `flutter build apk --split-per-abi`
- [ ] Benchmarking:
  - [ ] Web: API p95 <200ms (from backend logs)
  - [ ] Web: Page load <2s (from Vercel analytics)
  - [ ] Mobile: APK startup <3s, booking flow <5s

---

### **Day 38 (APK Building, Signing & Firebase Distribution)**

#### Task 4.2.4: APK Build & Signing Setup
- [ ] Generate signing key (only once):
  ```bash
  keytool -genkey -v -keystore ~/dentflow-release.keystore \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias dentflow-key
  ```
- [ ] Create key.properties file:
  ```
  storeFile=/home/user/dentflow-release.keystore
  storePassword=xxxxx
  keyPassword=xxxxx
  keyAlias=dentflow-key
  ```
- [ ] Configure build.gradle:
  ```gradle
  signingConfigs {
      release {
          keyStore file(keyStoreFile)
          keyStorePassword keystorePassword
          keyAlias keyAlias
          keyPassword keyPassword
      }
  }
  buildTypes {
      release {
          signingConfig signingConfigs.release
      }
  }
  ```
- [ ] Build signed APK:
  ```bash
  flutter build apk --release
  # Output: build/app/outputs/apk/release/app-release.apk
  ```
- [ ] Verify APK:
  - [ ] Size: should be 40-80MB
  - [ ] Can install on Android device
  - [ ] App launches without errors
  - [ ] All features work (login, booking, etc)

#### Task 4.2.5: Firebase App Distribution Setup
- [ ] Create Firebase project:
  - [ ] Go to Firebase Console, create new project "dentflow"
  - [ ] Register Android app (bundle ID: com.dentflow.app)
  - [ ] Download google-services.json
- [ ] Setup Firebase in Flutter:
  - [ ] Copy google-services.json → android/app/
  - [ ] Install Firebase: `flutter pub add firebase_core`
  - [ ] Initialize in main.dart:
    ```dart
    void main() async {
      WidgetsFlutterBinding.ensureInitialized();
      await Firebase.initializeApp();
      runApp(MyApp());
    }
    ```
- [ ] Setup Firebase App Distribution CLI:
  ```bash
  # Install Firebase CLI (if not already)
  npm install -g firebase-tools
  firebase login
  ```
- [ ] Create firebase.json configuration:
  ```json
  {
    "projects": {
      "default": "dentflow"
    }
  }
  ```
- [ ] Upload first build:
  ```bash
  firebase appdistribution:distribute build/app/outputs/apk/release/app-release.apk \
    --app 1:1234567890:android:abcdef1234567890 \
    --release-notes "v1.0.0 - Initial Release" \
    --testers "team@dentflow.com"
  ```
- [ ] Test invitation link: testers receive email, can install APK on their devices

#### Task 4.2.6: Version Bumping & Documentation
- [ ] Update version in pubspec.yaml:
  - [ ] Change `version: 1.0.0+1` → `version: 1.0.0+2` (for subsequent builds)
- [ ] Create CHANGELOG.md entry:
  ```markdown
  ## [1.0.0] - 2026-07-XX
  ### Features
  - Patient booking with real-time slot availability
  - Walk-in check-in with SMS notification
  - Doctor EMR and prescription management
  - Real-time queue display
  - AI chat assistant
  
  ### Fixes
  - WebSocket reconnection handling
  - Payment flow error messaging
  ```
- [ ] Tag commit: `git tag v1.0.0-mobile`

---

### **Day 39-40 (Staging Validation & Phase 4 Exit Criteria)**

#### Task 4.2.7: Final Staging & Production Readiness Validation
- [ ] Web app (Vercel):
  - [ ] All 7 admin portal pages load <2s
  - [ ] Patient booking end-to-end works (real payment → sandbox)
  - [ ] Real-time queue updates visible on TV display <1s
  - [ ] WebSocket health check + polling fallback verified
  - [ ] Responsive design on mobile (375px to 1920px)
  - [ ] Lighthouse score ≥90 (mobile + desktop)
  - [ ] No console errors in browser (check DevTools)
  - [ ] No security warnings (HTTPS, no mixed content)
- [ ] Mobile app (Firebase distribution):
  - [ ] APK <100MB
  - [ ] Installs without errors
  - [ ] Login/logout works
  - [ ] Book appointment: select doctor → select slot → pay → confirmation
  - [ ] Walk-in booking: check SMS received
  - [ ] Doctor app: queue management, EMR entry, prescription
  - [ ] AI chat responds to queries
  - [ ] Real-time queue updates (patient sees own status)
  - [ ] Network resilience: disconnect Wi-Fi → app shows error gracefully
  - [ ] Performance: booking flow <5s, queue updates <1s
- [ ] E2E tests (Cypress):
  - [ ] Run full suite: `npm run cypress:run`
  - [ ] All tests passing (≥70% of critical paths covered)
  - [ ] Test results exported (for portfolio documentation)
- [ ] Documentation:
  - [ ] README updated (new sections for web + mobile)
  - [ ] API_DOCUMENTATION.md (all 50+ endpoints with examples)
  - [ ] DEPLOYMENT.md (step-by-step: build web → deploy Vercel, build APK → distribute Firebase)
  - [ ] MOBILE_SETUP.md (Flutter installation, run locally, build APK)
  - [ ] E2E_TESTING.md (how to run Cypress tests, interpret results)

#### Task 4.2.8: Phase 3-4 Exit Criteria Validation & Handoff to Phase 5
- [ ] **Phase 3-4 Go/No-Go Decision Matrix (Production Ready Checklist):**

| Criterion | Target Benchmark | Check Method | Reference |
|-----------|-----------------|--------------|-----------|
| Web app (Next.js) deployment | Vercel staging live, HTTPS ✅ | `curl https://staging-dentflow.vercel.app/health` returns 200 | Phase 3 §3.1.1 |
| Admin portal completeness | All 7 pages + <2s load time | Chrome DevTools Network tab, click all menu items | Phase 3 §3.1.5-10 |
| Patient portal completeness | Book→Pay→History working, 3+ pages | User flow: login→book→pay→view history | Phase 3 §3.2.1-4 |
| Real-time TV display (Rec #1) | <1 second latency, <500ms p95 | Emit event, measure update time with stopwatch | Recommendation #1, Phase 3 §3.1.12-13 |
| WebSocket fallback (Rec #1) | Polling auto-activates if WS down | Kill connection, verify polling starts within 3s | Recommendation #1, TDD §5.2 |
| Invoice state machine (Rec #3) | UNPAID→PAID immutable, visual enforcement | Pay invoice, verify payment button disabled | Recommendation #3, Phase 3 §3.1.8 |
| Queue number display (Rec #4) | Redis counter accuracy, no duplicates | Check-in 5 patients, verify sequential numbers | Recommendation #4, TDD §4.2 |
| Walk-in workflow (Rec #5) | Temp profile→SMS delivery | Walk-in flow end-to-end, verify SMS received | Recommendation #5, Phase 4 §4.1.7 |
| NO-SHOW tracking (Rec #6) | Status visible in patient history | View past appointment, see NO-SHOW badge if applicable | Recommendation #6, Phase 4 §4.2.3 |
| Flutter mobile app | `flutter run` success, APK <100MB | Emulator launch + file size check | Phase 4 §4.1.1 |
| Mobile booking flow | Patient→Book→Pay→Confirmation on mobile | End-to-end user flow on emulator | Phase 4 §4.1.3 |
| APK signed & distributed | Firebase App Distribution ready | Tester can install via invite link | Phase 4 §4.1.6 |
| E2E test suite | Cypress ≥70% critical paths, 0 flaky tests | `npm run test:e2e` shows ≥14/20 tests passing | Phase 4 §4.2.1-5 |
| Performance benchmarks | Lighthouse ≥90 (mobile), p95 API <200ms | Lighthouse audit + k6 load test 100 concurrent users | Phase 4 §4.2.6 |
| Security audit | OWASP Top 10 checklist passed | Manual security review + OWASP validator | DRP.md §Security |
| Documentation complete | README + API docs + deployment + mobile setup | Spot check: all docs present, no missing sections | Phase 4 §4.2.7 |

**Critical Path Validation:**
1. ✅ Web deployment works (no staging blockers)
2. ✅ Real-time features <1s latency (Rec #1 critical)
3. ✅ All 6 recommendations integrated + visible
4. ✅ E2E tests ≥70% passing (confidence metric)
5. ✅ APK signed + distributed (mobile ready)

**Decision Rule:** Phase 3-4 is **COMPLETE** when **ALL 16 CRITERIA are MET**. If any benchmark misses by >10%, escalate to Phase 5 with documented workaround. No Phase 5 start until all CRITICAL PATH items pass.

#### Task 4.2.9: Continuity Clue & Handoff to Phase 5
**What's Complete:**
- ✅ Backend: All 50+ APIs deployed, tested, documented
- ✅ Web: Admin + patient portals, real-time features, staging deployment
- ✅ Mobile: Patient + doctor apps, APK signed, Firebase distributed
- ✅ Real-time: WebSocket + polling for TV display, queue updates, slot availability
- ✅ E2E: Cypress tests covering critical paths (70%+ coverage)

**What's Next (Phase 5):**
- Phase 5 focuses on: **System integration testing, all 6 recommendations validation, stress testing, performance benchmarking, demo preparation, production deployment, and portfolio mastery**
- Key activities:
  - Run full E2E test suite 5-10 times (ensure stability)
  - Load test API (verify <200ms p95 at 100 concurrent users)
  - All 6 recommendations validated in production scenario
  - Record video demo (3-5 min walkthrough)
  - Prepare portfolio presentation + talking points
  - Deploy production (AWS or Heroku backend, Vercel web, Firebase mobile)
  - Final security audit (OWASP Top 10)

**Phase 5 Prerequisites Met:**
- ✅ All user-facing features complete and tested
- ✅ Backend APIs stable on staging
- ✅ Mobile APK built and signed
- ✅ E2E test suite established and passing
- ✅ Team ready for final integration testing and deployment

---

## 🔗 ALL 6 RECOMMENDATIONS INTEGRATION IN PHASE 3-4 ⭐ CRITICAL VALIDATION

### Recommendation #1: Real-Time TV Display (WebSocket + Polling Fallback)
**Implementation Phases:**
- **Week 5:** WebSocket infrastructure setup (Task 3.1.12)
  - Socket.IO connection service
  - Auto-reconnection with exponential backoff
  - JWT authentication for WebSocket
- **Week 5:** TV display component created (Task 3.1.13)
  - Displays: "Now serving: #[number]" in large font
  - Updates on queue:updated event
  - Visual connection status indicator
- **Week 6:** Real-time queue updates verified on staging
  - End-to-end test: admin calls patient → TV updates <1s
  - Polling fallback tested: disconnect WebSocket → polling starts
- **Week 8:** E2E test for real-time (Task 4.2.1)
  - Cypress scenario: simulate WebSocket failure, verify polling
  - Measure latency: p95 <500ms for queue updates

**Acceptance Criteria (MUST PASS):**
- [ ] WebSocket connection: Establishes on app load <2 seconds
- [ ] Queue update latency: <1 second (p95 <500ms)
- [ ] Polling fallback: Activates within 3s if WebSocket disconnects
- [ ] Auto-reconnect: Attempts every 30s, succeeds within 60s
- [ ] Visual feedback: Connection status dot (green/red) visible on TV + web
- [ ] No memory leaks: DevTools heap snapshot after 30min stable

**Reference:**
- TDD Section 5.2 (WebSocket API spec)
- DRP.md (Real-time connection failures mitigation)
- Recommendation #1 Brief (TV Display real-time requirement)

### Recommendation #2: Webhook Retry Logic (3-Retry + Idempotency)
**Implementation Phases:**
- **Phase 2 (COMPLETED):** Midtrans webhook with 3-retry + idempotency
  - Signature validation (Midtrans secret key)
  - Idempotency key tracking (payment_webhooks table)
  - Automatic retry on network failure (3x with exponential backoff)
- **Phase 3-4 role:** Display invoice payment status correctly (paid/unpaid)
  - Admin Finance page reflects payment status immediately
  - Patient invoice shows "Payment received" after webhook processed
- **Test:** E2E payment flow validates webhook processing
  - Trigger Midtrans webhook manually (test console)
  - Verify invoice status updates in real-time
  - Verify retry logic (intentionally fail 1st attempt, 2nd succeeds)

**Acceptance Criteria (MUST PASS):**
- [ ] Webhook signature validation: Rejects unsigned requests
- [ ] Idempotency: Duplicate webhooks don't double-charge
- [ ] Retry logic: Fails 1st time, succeeds 2nd attempt automatically
- [ ] Invoice update latency: <5 seconds after webhook receipt
- [ ] Audit trail: All webhook attempts logged with timestamp + error
- [ ] Recovery: Invoice state consistent after retry attempts

**Reference:** Recommendation #2 Brief (Payment reliability critical)

---

### Recommendation #3: Invoice Payment State Machine (UNPAID → PAID)
**Implementation Phases:**
- **Week 5:** Admin Finance page shows UNPAID → PAID state (Task 3.1.8)
  - Database constraint enforced: UNPAID → PAID only (one-way)
  - Visual UI: Payment button disabled once status is PAID
- **Week 5:** Patient invoice page shows state correctly (Task 3.2.2)
  - Patient sees: "UNPAID" (red) or "PAID" (green)
  - Shows payment date + method once paid
- **Week 6:** Emphasis on immutability: "Payment received" badge, no undo
  - Can't click "pay again" or modify status
  - Shows clear audit trail: "Paid on [date] via [method]"
- **Test:** E2E invoice lifecycle
  - Create invoice → UNPAID
  - Pay invoice → PAID
  - Attempt to pay again → denied (state machine prevents)

**Acceptance Criteria (MUST PASS):**
- [ ] State transition enforced: Only UNPAID → PAID (no reversals)
- [ ] UI enforcement: Payment button disappears once PAID
- [ ] Immutability emphasized: "Payment received" text visible
- [ ] Payment date displayed: Shows exact timestamp of payment
- [ ] Audit log created: INVOICE_PAID event recorded
- [ ] No data inconsistency: Database + UI state always aligned

**Reference:** Recommendation #3 Brief (Financial integrity non-negotiable)

---

### Recommendation #4: Queue Number Uniqueness (Redis Atomic Counters)
**Implementation Phases:**
- **Phase 2 (COMPLETED):** Redis atomic counters for queue numbers
  - Increment counter atomically: INCR dentflow:queue:counter:branch_1
  - No duplicate queue numbers possible
- **Phase 3-4 role:** Display queue numbers on web + mobile + TV display
  - Admin Antrian page shows current queue number
  - Patient sees "You are queue #[N]" after check-in
  - TV displays "Now serving: #[N]" in large font (Rec #1)
- **Test:** E2E queue number uniqueness
  - Simultaneous check-ins (5 patients) → 5 unique sequential numbers
  - Redis counter never duplicates or skips

**Acceptance Criteria (MUST PASS):**
- [ ] Queue counter increments: Each check-in gets unique number
- [ ] No duplicates: 100 simultaneous check-ins = 100 unique numbers
- [ ] Counter persistence: Persists across app restarts
- [ ] Accuracy: Numbers sequential (1,2,3,4... no gaps or duplicates)
- [ ] Branch isolation: Each branch has independent counter
- [ ] Recovery: If Redis fails, graceful fallback (e.g., use timestamp)

**Reference:** Recommendation #4 Brief (System correctness database design)

---

### Recommendation #5: Walk-In Patient Profiles (Temp Patient Creation)
**Implementation Phases:**
- **Week 7:** Walk-in mobile flow implemented (Task 4.1.7)
  - "Walk-in" button on patient login screen
  - Minimal profile: Name + Phone → Auto-create temp patient
  - System generates temporary patient ID (no full registration needed)
- **Features:** 
  - Temp patient creation → SMS with queue number → no login needed
  - SMS includes: Clinic name, queue number, wait time estimate
  - Temp patient can view queue position on mobile without login
- **Backend:** Already in Phase 2, mobile completes the UX
- **Test:** E2E walk-in flow (register, receive SMS, view queue)
  - Walk-in → enter name/phone → receive SMS with queue #
  - View queue status on mobile via SMS link (no login)

**Acceptance Criteria (MUST PASS):**
- [ ] Temp patient creation: <30 seconds end-to-end
- [ ] SMS delivery: Received within 2 minutes (twilio/local mock)
- [ ] Queue number assigned: Sequential + unique
- [ ] Mobile view: Patient can see queue status from SMS link
- [ ] No registration required: Walk-ins never asked for password
- [ ] Privacy: Temp data deleted after 24 hours
- [ ] Conversion: Temp patient can become full registered patient later

**Reference:** Recommendation #5 Brief (Operational flexibility real-world requirement)

---

### Recommendation #6: NO-SHOW Automation (Cron Job Execution)
**Implementation Phases:**
- **Phase 2 (COMPLETED):** Cron job marks appointments as no-show
  - Scheduled job runs every 5 minutes
  - Checks appointments 15min past appointment time
  - No doctor check-in → marks as NO-SHOW + sends SMS to patient
- **Phase 3-4 role:** Display no-show status in patient history
  - Patient history shows "NO-SHOW" badge on past appointments
  - Doctor app shows no-show count per patient (repeat no-shows)
  - Admin dashboard shows NO-SHOW rate per doctor (optional v1)
- **Test:** E2E NO-SHOW automation
  - Create appointment → Don't check in → Wait 15min+
  - Verify appointment marked NO-SHOW automatically
  - Verify SMS sent to patient

**Acceptance Criteria (MUST PASS):**
- [ ] Cron execution: Job runs reliably every 5 minutes
- [ ] Accuracy: Only marks missed appointments as NO-SHOW
- [ ] SMS notification: Patient notified of no-show
- [ ] UI display: "NO-SHOW" badge visible in patient history
- [ ] Doctor visibility: Doctor sees patient no-show history
- [ ] Reversal prevention: Admin can't manually undo no-show (audit trail only)
- [ ] Recovery: If cron fails, manual trigger via admin panel (safety valve)

**Reference:** Recommendation #6 Brief (Business process automation)

---

## ✅ PHASE 3-4 EXIT CRITERIA VALIDATION

**Final Checklist Before Phase 5:**

- [ ] Web app (Next.js) deployed to Vercel, all 7 admin pages + patient portal working
- [ ] Real-time features working: TV display, queue updates, slot availability (<1s)
- [ ] Mobile app (Flutter) signed APK built, <100MB
- [ ] Mobile APK uploaded to Firebase App Distribution, testers can install
- [ ] E2E tests (Cypress) written and passing (≥70% critical paths)
- [ ] Walk-in workflow functional on mobile + web
- [ ] AI chat integrated (basic responses working)
- [ ] Performance validated: Web <2s, Mobile <3s, API p95 <200ms
- [ ] Documentation complete (README, API docs, deployment, mobile setup, E2E guides)
- [ ] All 6 recommendations visible/working in UI
- [ ] Zero critical bugs on staging
- [ ] Lighthouse score ≥90 (mobile + desktop)
- [ ] Team ready to move to Phase 5 (testing, deployment, portfolio mastery)

---

## 🎯 CONTINUITY CLUE TO PHASE 5

**What's complete after Phase 3-4:**
- Complete user-facing system (web + mobile)
- All business logic APIs working
- Real-time features operational
- E2E tests established (70%+ coverage)
- Staging environment fully validated
- APK signed and distributed to testers

**What's next (Phase 5 - Week 9):**
- System integration testing (full flows end-to-end)
- All 6 recommendations validated in production scenario
- Load testing & performance benchmarking
- Final security audit (OWASP Top 10)
- Demo preparation & video recording
- Production deployment (AWS/Heroku backend, Vercel web, Firebase mobile)
- Portfolio documentation & presentation mastery

**Starting assumptions for Phase 5:**
- All Phase 3-4 exit criteria met
- Backend on staging stable, all endpoints tested
- Web app on Vercel staging, all pages accessible
- Mobile APK signed and in Firebase distribution
- E2E test suite passing
- No critical bugs on staging
- Team fully trained on system architecture

**Phase 5 Success = DentFlow v1.0 Production Ready ✅**

---

## 📊 PHASE 3-4 SUMMARY

**Total Duration:** Weeks 5-8 (20 days)  
**Target Tokens:** 12,000-14,000  
**Target Lines:** 1,400-1,600  
**Key Deliverables:** Next.js web app (Vercel), Flutter mobile app (Firebase), Cypress E2E suite  
**Critical Path:** Real-time features (Recommendation #1) → All UI portals complete → E2E tests passing  
**Risk Mitigation:** WebSocket fallback to polling, error handling on network failures, comprehensive E2E testing  

**End Goal:** DentFlow has a complete, user-facing, production-quality frontend and mobile system. All 6 recommendations integrated. Ready for Phase 5 system integration, deployment, and portfolio mastery.

---

**END OF PHASE 3-4 ROADMAP**

*This roadmap is the complete guide for Weeks 5-8. Follow each task, validate exit criteria, and hand off to Phase 5 with confidence.*
