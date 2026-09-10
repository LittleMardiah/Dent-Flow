================================================================
BLUEPRINT INTEGRATION TESTS - TASK 2.7.3
DENTFLOW BACKEND - PHASE 2
================================================================
Tanggal       : 2026-07-26
Status        : DRAFT - Panduan Perbaikan Integration Test
Referensi     : ROADMAP FASE 2.md (Task 2.7.3)
Tujuan        : Mendokumentasikan 11 integration test cases, 
                status saat ini, root cause, dan rencana perbaikan
================================================================


1.  PENDAHULUAN
    ─────────────────────────────────────────────────────────────
    Task 2.7.3 mewajibkan kita membuat integration test suite 
    yang menguji end-to-end flow: 
    Booking → Check-in → Encounter → Invoice.

    Dari 11 test cases yang dirancang, hanya 3 yang berhasil 
    (PASS), 8 sisanya gagal (FAIL) atau di-skip (SKIP) karena 
    berbagai kendala teknis.

    Blueprint ini bertujuan untuk:
    - Menjadi pegangan saat kita perbaiki test di kemudian hari.
    - Mendokumentasikan akar masalah (root cause) setiap kegagalan.
    - Memberikan prioritas perbaikan yang jelas.
    - Menjadi referensi untuk pendekatan perbaikan (testcontainers,
      nock, fake timers, dll).

    Target akhir: 100% test cases PASS (atau 90% minimal) sebelum 
    Phase 2 dinyatakan COMPLETE.


2.  DAFTAR 11 INTEGRATION TEST CASES
    ─────────────────────────────────────────────────────────────

    GRUP A: PATIENT BOOKING FLOW (3 tests - ✅ PASS)
    ─────────────────────────────────────────────────────────────
    ID: TC-01
    Nama: Get Doctor Availability
    Deskripsi: Menguji endpoint GET /api/doctors/:id/availability
               dengan parameter branch_id dan date.
    Status: ✅ PASS
    Error: Tidak ada (200 OK)
    Akar Masalah: -
    Rencana Perbaikan: -
    Dependencies: -

    ID: TC-02
    Nama: Create Booking
    Deskripsi: Menguji endpoint POST /api/patient/bookings untuk
               membuat booking baru.
    Status: ✅ PASS
    Error: Tidak ada (201 Created)
    Akar Masalah: -
    Rencana Perbaikan: -
    Dependencies: TC-01 (harus ada slot tersedia)

    ID: TC-03
    Nama: List Patient Bookings
    Deskripsi: Menguji endpoint GET /api/patient/bookings dengan
               filter status.
    Status: ✅ PASS
    Error: Tidak ada (200 OK)
    Akar Masalah: -
    Rencana Perbaikan: -
    Dependencies: TC-02 (harus ada booking yang dibuat)


    GRUP B: ADMIN CHECK-IN & QUEUE (2 tests - ❌ FAIL / SKIP)
    ─────────────────────────────────────────────────────────────
    ID: TC-04
    Nama: Admin Checks-in Patient
    Deskripsi: Admin mengkonfirmasi kehadiran pasien dengan kode 
               booking, menghasilkan nomor antrian.
    Status: ❌ FAIL (400 Bad Request)
    Error: Booking status masih PENDING_PAYMENT (belum dibayar).
    Akar Masalah: 
      - Endpoint check-in mengharuskan status booking = 
        PAYMENT_CONFIRMED.
      - Kita tidak memiliki mekanisme otomatis untuk mengubah
        status PENDING_PAYMENT → PAYMENT_CONFIRMED di test.
      - Mock payment gateway (Midtrans) belum diimplementasikan.
    Rencana Perbaikan:
      1. Implementasikan mock payment webhook (nock) untuk 
         mensimulasikan Midtrans.
      2. Setelah booking dibuat, panggil webhook mock untuk 
         mengubah status menjadi PAYMENT_CONFIRMED.
      3. Atau, langsung update status di database via query
         (cara cepat, tapi tidak ideal untuk E2E).
    Dependencies: TC-02 (butuh booking_id)

    ID: TC-05
    Nama: Get Queue Status (Doctor / Admin)
    Deskripsi: Mengambil status antrian untuk dokter tertentu.
    Status: ⏭️ SKIP (belum diimplementasikan)
    Error: -
    Akar Masalah: 
      - Test case belum ditulis.
      - Butuh data queue yang valid (TC-04 harus pass dulu).
    Rencana Perbaikan:
      1. Tulis test case GET /api/queue/status?doctor_id=...
      2. Pastikan TC-04 sudah PASS untuk menghasilkan queue data.
    Dependencies: TC-04 (harus ada queue record)


    GRUP C: DOCTOR ENCOUNTER FLOW (3 tests - ❌ FAIL / SKIP)
    ─────────────────────────────────────────────────────────────
    ID: TC-06
    Nama: Doctor Starts Encounter
    Deskripsi: Dokter memulai encounter (EMR) untuk pasien yang 
               sudah check-in.
    Status: ❌ FAIL (403 Forbidden)
    Error: Role check gagal (DOCTOR tidak diizinkan di route).
    Akar Masalah:
      - Route /api/encounters hanya mengizinkan role ADMIN_BRANCH
        di middleware, padahal seharusnya DOCTOR juga diizinkan.
      - Ini karena di src/routes/encounter.routes.ts, roleMiddleware
        hanya diberi ['ADMIN_BRANCH'].
    Rencana Perbaikan:
      1. Perbaiki encounter.routes.ts: tambahkan DOCTOR ke array
         allowedRoles.
      2. Pastikan perubahan sudah di-commit.
    Dependencies: TC-04 (harus ada check-in yang selesai)

    ID: TC-07
    Nama: Doctor Records Diagnosis
    Deskripsi: Dokter mencatat diagnosis dan treatment ke encounter.
    Status: ❌ FAIL (403 Forbidden)
    Error: Sama seperti TC-06 (role check gagal).
    Akar Masalah:
      - Sama dengan TC-06, route PUT /api/encounters/:id hanya
        mengizinkan ADMIN_BRANCH.
    Rencana Perbaikan:
      1. Sama dengan TC-06, perbaiki roleMiddleware.
    Dependencies: TC-06 (harus ada encounter yang dimulai)

    ID: TC-08
    Nama: Doctor Completes Encounter → Invoice Auto-Generated
    Deskripsi: Dokter menyelesaikan encounter, yang seharusnya 
               memicu pembuatan invoice otomatis.
    Status: ❌ FAIL (403 Forbidden)
    Error: Sama seperti TC-06 dan TC-07.
    Akar Masalah:
      - Route POST /api/encounters/:id/complete hanya mengizinkan
        ADMIN_BRANCH.
    Rencana Perbaikan:
      1. Perbaiki roleMiddleware (tambahkan DOCTOR).
    Dependencies: TC-07 (harus ada diagnosis yang dicatat)


    GRUP D: ADMIN INVOICE PAYMENT (2 tests - ❌ FAIL / SKIP)
    ─────────────────────────────────────────────────────────────
    ID: TC-09
    Nama: Admin Marks Invoice as Paid
    Deskripsi: Admin menandai invoice yang sudah dibayar oleh pasien.
    Status: ❌ FAIL (404 Not Found)
    Error: Invoice tidak ditemukan (karena TC-08 gagal).
    Akar Masalah:
      - Invoice tidak pernah terbuat karena encounter tidak selesai.
      - TC-08 harus PASS dulu.
    Rencana Perbaikan:
      1. Pastikan TC-08 PASS.
      2. Test akan otomatis jalan setelah invoice terbuat.
    Dependencies: TC-08 (harus ada invoice yang di-generate)

    ID: TC-10
    Nama: Get Invoice Detail
    Deskripsi: Mengambil detail invoice berdasarkan ID.
    Status: ❌ FAIL (404 Not Found)
    Error: Invoice tidak ditemukan.
    Akar Masalah:
      - Sama dengan TC-09, invoice belum terbuat.
    Rencana Perbaikan:
      1. Sama dengan TC-09, pastikan TC-08 PASS.
    Dependencies: TC-08 (harus ada invoice)


    GRUP E: WALK-IN & MULTI-TENANT (2 tests - ❌ FAIL / SKIP)
    ─────────────────────────────────────────────────────────────
    ID: TC-11
    Nama: Admin Creates Walk-in Patient
    Deskripsi: Admin menambahkan pasien walk-in (tanpa booking 
               online) langsung ke antrian.
    Status: ❌ FAIL (501 Not Implemented)
    Error: Handler walk-in masih return 501.
    Akar Masalah:
      - Endpoint /api/admin/check-in/walk-in belum diimplementasikan
        sepenuhnya (masih placeholder).
      - Handler di src/handlers/checkin.handler.ts hanya return
        res.status(501).json(...).
    Rencana Perbaikan:
      1. Implementasikan logic walk-in di handler:
         - Buat temporary patient profile.
         - Buat booking dengan status CONFIRMED.
         - Generate queue number (Redis INCR).
         - Return queue number + temp patient ID.
      2. Pastikan unit test untuk walk-in juga ditambahkan.
    Dependencies: TC-04 (check-in flow untuk referensi)

    ID: TC-12
    Nama: Multi-tenant Isolation - Branch A Admin Cannot Access Branch B
    Deskripsi: Admin dari cabang A tidak bisa mengakses data cabang B.
    Status: ⏭️ SKIP (belum diimplementasikan)
    Error: -
    Akar Masalah:
      - Test case belum ditulis.
      - Butuh data di cabang B (branch_id = 'B').
      - Butuh admin token dari cabang A.
    Rencana Perbaikan:
      1. Buat data branch B di database (jika belum ada).
      2. Login sebagai admin cabang A.
      3. Coba akses endpoint dengan branch_id = 'B'.
      4. Expect 403 Forbidden.
    Dependencies: TC-02 (butuh booking di branch B untuk diakses)


3.  PRIORITAS PERBAIKAN (RENCANA EKSEKUSI)
    ─────────────────────────────────────────────────────────────
    Urutan perbaikan yang disarankan (berdasarkan dependency chain):

    PRIORITAS 1 (High) - Fix Role Middleware
    ───────────────────────────────────────
    - TC-06, TC-07, TC-08 → Perbaiki encounter.routes.ts
    - Tambahkan 'DOCTOR' ke roleMiddleware.
    - Estimasi: 15 menit.

    PRIORITAS 2 (High) - Implement Walk-in Handler
    ──────────────────────────────────────────────
    - TC-11 → Implementasikan logic walk-in di handler.
    - Buat temporary patient, booking, dan queue number.
    - Estimasi: 1-2 jam.

    PRIORITAS 3 (High) - Mock Payment Webhook
    ──────────────────────────────────────────
    - TC-04 → Butuh status PAYMENT_CONFIRMED.
    - Setup nock untuk mock Midtrans webhook.
    - Setelah booking dibuat, panggil webhook mock.
    - Estimasi: 2-3 jam.

    PRIORITAS 4 (Medium) - Fix Check-in dengan Mock Date
    ────────────────────────────────────────────────────
    - TC-04 → Butuh tanggal yang valid untuk check-in.
    - Gunakan fake timers (jest.useFakeTimers()) setelah login,
      bukan sebelumnya.
    - Atau, hardcode tanggal yang valid (misal H+1).
    - Estimasi: 1-2 jam.

    PRIORITAS 5 (Medium) - Tulis Test Case yang Belum Ada
    ────────────────────────────────────────────────────
    - TC-05 (Get Queue Status)
    - TC-12 (Multi-tenant Isolation)
    - Estimasi: 1-2 jam per test.

    PRIORITAS 6 (Low) - Cleanup & Idempotency
    ────────────────────────────────────────
    - Pastikan setiap test membersihkan data setelah selesai.
    - Gunakan transaction rollback atau delete query.
    - Estimasi: 1 jam.


4.  REKOMENDASI TEKNIS UNTUK PERBAIKAN
    ─────────────────────────────────────────────────────────────
    Untuk memudahkan perbaikan dan menghindari error yang sama,
    berikut rekomendasi tools dan pendekatan:

    A. Testcontainers (Database Terisolasi)
       ───────────────────────────────────
       - Gunakan @testcontainers/postgresql untuk membuat database
         terisolasi per test suite.
       - Keuntungan: Tidak perlu cleanup manual, data fresh setiap
         test.
       - Instalasi: npm install --save-dev @testcontainers/postgresql
       - Contoh:
         const container = await new PostgreSqlContainer().start();

    B. Nock (Mock HTTP Request untuk Midtrans)
       ───────────────────────────────────────
       - Gunakan nock untuk mock webhook Midtrans.
       - Keuntungan: Tidak perlu koneksi internet, response cepat.
       - Instalasi: npm install --save-dev nock @types/nock
       - Contoh:
         nock('https://api.midtrans.com')
           .post('/v2/transactions/...')
           .reply(200, { status: 'settlement' });

    C. Timekeeper / Sinon (Mock Date yang Stabil)
       ──────────────────────────────────────────
       - Gunakan @sinonjs/fake-timers atau jest.useFakeTimers()
         dengan urutan yang benar (setelah login).
       - Keuntungan: Token JWT tidak expired.
       - Contoh:
         jest.useFakeTimers();
         jest.setSystemTime(new Date('2026-08-10T10:00:00Z'));

    D. Transaction Rollback per Test
       ─────────────────────────────
       - Bungkus setiap test dalam transaksi dan rollback di akhir.
       - Keuntungan: Data tidak mengganggu test lain.
       - Contoh:
         await pool.query('BEGIN');
         // ... test ...
         await pool.query('ROLLBACK');


5.  EXIT CRITERIA - KAPAN TASK 2.7.3 BISA DINYATAKAN SELESAI?
    ─────────────────────────────────────────────────────────────
    Task 2.7.3 dianggap COMPLETE jika:

    [ ] Semua 11 test cases PASS (100%) atau minimal 10 dari 11
        (≥90%) dengan alasan yang jelas untuk yang 1 gagal.

    [ ] Tidak ada test yang di-skip (semua harus dieksekusi).

    [ ] Semua error yang muncul sudah diidentifikasi dan diperbaiki
        (role middleware, walk-in handler, payment mock, dll).

    [ ] Test dapat dijalankan secara konsisten di lokal dan CI/CD
        tanpa flaky (hasil selalu sama setiap run).

    [ ] Dokumentasi perbaikan dicatat di LOGBOOK.txt dan
        TECHNICAL DEBT.txt (jika ada yang masih tertunda).

    Jika semua kriteria di atas terpenuhi, kita bisa lanjut ke
    Task 2.7.4 (Database Integrity) dan 2.7.5 (Documentation)
    dengan tenang.


6.  CATATAN TAMBAHAN
    ─────────────────────────────────────────────────────────────
    - Perbaikan test ini akan memakan waktu estimasi 6-10 jam
      jika dilakukan secara terstruktur (bukan debugging acak).
    - Gunakan pendekatan incremental: perbaiki satu test case
      dulu (misal TC-06), baru lanjut ke berikutnya.
    - Jangan lupa jalankan unit test terlebih dahulu untuk
      memastikan tidak ada regresi.
    - Commit setiap perubahan kecil agar mudah di-rollback jika
      terjadi error.

================================================================
END OF BLUEPRINT
================================================================