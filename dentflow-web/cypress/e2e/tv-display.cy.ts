describe('TV Display Real-Time Queue — Task 5.1.4', () => {
  const BRANCH_A = '494a607c-d109-4330-a3a9-68f54326f0c7' // Cabang A (dr_bm_a / admin@clinic.com)

  // Ambil branchId dari user admin yang tersimpan di localStorage (dentflow_user).
  const getAdminBranchId = (): Cypress.Chainable<string> =>
    cy.window().then((win) => {
      const raw = win.localStorage.getItem('dentflow_user')
      const user = raw ? JSON.parse(raw) : null
      return (user?.branchId as string) || BRANCH_A
    })

  const readyNext = () => {
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/auth/doctor/login',
      body: { username: 'dr_bm_a', password: 'Doctor123!' },
    }).then((login) => {
      expect(login.status).to.eq(200)
      const doctorToken = login.body.data.token
      const doctorUserId = login.body.data.user.id
      return cy
        .request({
          method: 'POST',
          url: `http://localhost:3001/api/doctors/${doctorUserId}/ready-next`,
          headers: { Authorization: `Bearer ${doctorToken}` },
        })
        .its('status')
        .should('eq', 200)
    })
  }

  beforeEach(() => {
    cy.seedFixtures() // reset: queue WAITING #1 utk dr_bm_a (Cabang A)
  })

  it('1. TV display shows queue numbers', () => {
    cy.adminLogin()

    getAdminBranchId().then((branchId) => {
      cy.visit(`/tv-display?branch_id=${branchId}`)

      // Antrian WAITING #1 tampil sebagai kartu queue.
      cy.get('[data-testid=queue-card]', { timeout: 15000 }).should('have.length.at.least', 1)
      cy.get('[data-testid=queue-card]').first().should('contain', '#1')

      // Total antrian menunggu = 1 (hasil seed).
      cy.get('[data-testid=total-waiting]').should('contain', 'Antrian: 1')

      // Belum ada now-serving sebelum dipanggil.
      cy.get('[data-testid=no-patient]').should('be.visible')
    })
  })

  it('2. Queue update reflected on TV <2s', () => {
    cy.adminLogin()

    getAdminBranchId().then((branchId) => {
      cy.visit(`/tv-display?branch_id=${branchId}`)

      // Tunggu data awal termuat (queue #1 menunggu, belum ada yang dilayani).
      cy.get('[data-testid=queue-card]', { timeout: 15000 }).should('have.length.at.least', 1)
      cy.get('[data-testid=no-patient]').should('be.visible')

      const t0 = Date.now()

      // ready-next → status queue jadi BEING_CALLED → broadcast 'queue:updated' → fetch ulang via WS.
      readyNext()

      // Nomor #1 harus muncul di "Sekarang Melayani" dalam <2 detik.
      cy.get('[data-testid=now-serving-number]', { timeout: 2000 })
        .should('be.visible')
        .invoke('text')
        .then((txt) => {
          const elapsed = Date.now() - t0
          expect(txt.trim()).to.contain('#1')
          expect(elapsed).to.be.lessThan(2000)
        })

      // Koneksi live (bukan polling) saat update via WebSocket.
      cy.get('[data-testid=connection-status]').should('have.attr', 'data-status', 'connected')
    })
  })

  it('3. Connection status indicator works (Live → Polling on disconnect)', () => {
    cy.adminLogin()

    getAdminBranchId().then((branchId) => {
      cy.visit(`/tv-display?branch_id=${branchId}`)

      // Setelah login admin, WebSocket terhubung → indikator "Live" (connected).
      cy.get('[data-testid=connection-status]', { timeout: 15000 })
        .should('have.attr', 'data-status', 'connected')
        .and('contain', 'Live')

      // Server memutus semua socket (test-only /__ws/drop). Catatan: reason
      // 'io server disconnect' TIDAK memicu auto-reconnect (desain socket.io),
      // sehingga indikator berpindah ke 'polling' sebagai fallback.
      cy.request({ method: 'POST', url: 'http://localhost:3001/__ws/drop' })

      // Indikator bereaksi: berpindah ke mode Polling dalam 3 detik.
      cy.get('[data-testid=connection-status]', { timeout: 3000 })
        .should('have.attr', 'data-status', 'polling')
        .and('contain', 'Polling')
    })
  })

  it('4. Polling fallback after WebSocket disconnect', () => {
    cy.adminLogin()

    getAdminBranchId().then((branchId) => {
      cy.visit(`/tv-display?branch_id=${branchId}`)

      cy.get('[data-testid=connection-status]', { timeout: 15000 })
        .should('have.attr', 'data-status', 'connected')

      // Matikan WebSocket manual (window.__ws di-expose oleh websocket.ts) →
      // tidak ada auto-reconnect, useTVDisplay beralih ke polling (3s).
      cy.window().then((win) => (win as any).__ws?.disconnect())

      // Indikator pindah ke status 'polling' dalam 3 detik.
      cy.get('[data-testid=connection-status]', { timeout: 3000 })
        .should('have.attr', 'data-status', 'polling')

      // Data tetap tampil (masih render dari polling).
      cy.get('[data-testid=total-waiting]').should('contain', 'Antrian: 1')
      cy.get('[data-testid=queue-card]').should('have.length.at.least', 1)

      // Ubah antrian via API saat WebSocket mati → hanya polling (interval 3s)
      // yang memperbarui UI. Nomor #1 harus muncul ≤ 2 siklus polling (8s).
      readyNext()

      cy.get('[data-testid=now-serving-number]', { timeout: 8000 })
        .should('be.visible')
        .invoke('text')
        .then((txt) => expect(txt.trim()).to.contain('#1'))

      // Tetap di mode polling (WebSocket sengaja tidak terhubung).
      cy.get('[data-testid=connection-status]').should('have.attr', 'data-status', 'polling')
    })
  })
})