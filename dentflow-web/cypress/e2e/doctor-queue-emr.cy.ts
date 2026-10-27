describe('Doctor Queue & EMR Flow', () => {
  beforeEach(() => {
    cy.seedFixtures()
  })

  it('should login doctor, open patient, and input EMR (happy path)', () => {
    cy.doctorLogin()

    // Buka antrian dokter
    cy.visit('/doctor/queue')
    cy.contains('Antrian Hari Ini').should('be.visible')

    // Buka detail pasien pertama
    cy.contains('button', 'Detail').first().click()
    cy.contains('Detail Pasien').should('be.visible')

    // Lanjut ke konsultasi EMR (tombol konfirmasi modal)
    cy.contains('button', 'Mulai Konsultasi').click()
    cy.contains('Input Rekam Medis (EMR)').should('be.visible')

    // Isi form EMR (field tanpa name attribute, dipilih via placeholder)
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').type('Sakit gigi geraham kanan')
    cy.get('input[placeholder="Tindakan yang dilakukan"]').type('Scaling')

    // Simpan & selesaikan konsultasi (tombol konfirmasi modal)
    cy.contains('button', 'Simpan & Selesai').click()

    // Modal EMR menutup setelah berhasil
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').should('not.exist')
  })

  it('should block EMR save when complaint is empty (validation error)', () => {
    cy.doctorLogin()

    cy.visit('/doctor/queue')
    cy.contains('Antrian Hari Ini').should('be.visible')

    cy.contains('button', 'Detail').first().click()
    cy.contains('Detail Pasien').should('be.visible')
    cy.contains('button', 'Mulai Konsultasi').click()
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').should('exist')

    // Spy native alert (frontend validation: Keluhan & Tindakan wajib diisi)
    cy.window().then((win) => cy.stub(win, 'alert').as('alert'))

    // Hanya isi treatment, biarkan complaint (keluhan) kosong
    cy.get('input[placeholder="Tindakan yang dilakukan"]').type('Scaling')
    cy.contains('button', 'Simpan & Selesai').click()

    cy.get('@alert').should('have.been.calledWith', 'Keluhan dan Tindakan wajib diisi')
    // Modal tetap terbuka (validasi frontend menahan simpan)
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').should('exist')
    cy.get('input[placeholder="Tindakan yang dilakukan"]').should('exist')
  })

  it('should block EMR save when treatment is empty (validation error)', () => {
    cy.doctorLogin()

    cy.visit('/doctor/queue')
    cy.contains('Antrian Hari Ini').should('be.visible')

    cy.contains('button', 'Detail').first().click()
    cy.contains('Detail Pasien').should('be.visible')
    cy.contains('button', 'Mulai Konsultasi').click()
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').should('exist')

    cy.window().then((win) => cy.stub(win, 'alert').as('alert'))

    // Hanya isi complaint, biarkan treatment (tindakan) kosong
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').type('Sakit gigi geraham kanan')
    cy.contains('button', 'Simpan & Selesai').click()

    cy.get('@alert').should('have.been.calledWith', 'Keluhan dan Tindakan wajib diisi')
    cy.get('textarea[placeholder="Apa yang dikeluhkan pasien?"]').should('exist')
    cy.get('input[placeholder="Tindakan yang dilakukan"]').should('exist')
  })

  it('should reject EMR by non-doctor (403 Forbidden)', () => {
    // Login sebagai PATIENT (non-doctor), lalu coba buat encounter
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/auth/patient/login',
      body: { email: 'patient@test.com', password: 'Patient123!' },
    }).then((res) => {
      expect(res.status).to.eq(200)
      const patientToken = res.body.data.token

      // Patient tidak boleh membuat encounter (route DOCTOR/ADMIN_BRANCH only)
      cy.request({
        method: 'POST',
        url: 'http://localhost:3001/api/encounters',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: {
          bookingId: '00000000-0000-4000-8000-000000000000',
          complaint: 'Sakit gigi',
          treatment: 'Scaling',
        },
        failOnStatusCode: false,
      }).then((post) => {
        expect(post.status).to.eq(403)
        expect(post.body).to.have.property('error', 'Forbidden')
      })
    })
  })

  it('should not create duplicate encounter for same booking (idempotent)', () => {
    // Login doctor via API
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/auth/doctor/login',
      body: { username: 'dr_bm_a', password: 'Doctor123!' },
    }).then((login) => {
      expect(login.status).to.eq(200)
      const doctorToken = login.body.data.token
      const doctorUserId = login.body.data.user.id

      // Ambil bookingId dari antrian hari ini
      cy.request({
        method: 'GET',
        url: `http://localhost:3001/api/doctors/${doctorUserId}/queue-today`,
        headers: { Authorization: `Bearer ${doctorToken}` },
      }).then((queueRes) => {
        expect(queueRes.status).to.eq(200)
        const queue = queueRes.body.data.data
        expect(queue.length).to.be.greaterThan(0)
        const bookingId = queue[0].bookingId

        const body = { bookingId, complaint: 'Sakit gigi geraham', treatment: 'Scaling' }
        const headers = { Authorization: `Bearer ${doctorToken}` }

        cy.request({
          method: 'POST',
          url: 'http://localhost:3001/api/encounters',
          headers,
          body,
        }).then((first) => {
          expect(first.status).to.eq(201)
          const firstEncounterId = first.body.data.id

          // Panggil lagi dengan booking yang sama — harus idempotent (encounter yang sama)
          cy.request({
            method: 'POST',
            url: 'http://localhost:3001/api/encounters',
            headers,
            body,
          }).then((second) => {
            expect(second.status).to.eq(201)
            expect(second.body.data.id).to.eq(firstEncounterId)
          })
        })
      })
    })
  })
})