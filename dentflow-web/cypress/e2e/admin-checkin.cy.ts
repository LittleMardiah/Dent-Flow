describe('Admin Check-in Flow', () => {
  beforeEach(() => {
    cy.seedFixtures()
  })

  it('should login admin and add a walk-in patient', () => {
    cy.adminLogin()

    // Login redirect ke halaman admin, lalu buka halaman antrian
    cy.visit('/admin/queue')
    cy.get('h2').contains('Daftar Antrian Hari Ini').should('be.visible')

    // Buka modal Walk-in
    cy.contains('button', 'Walk-in').click()
    cy.contains('Tambah Walk-in').should('be.visible')

    // Isi form walk-in (field tanpa name attribute, dipilih via placeholder)
    cy.get('form').within(() => {
      cy.get('input[placeholder="Masukkan nama pasien"]').type('Pasien Test Walk-in')
      cy.get('input[placeholder="081234567890"]').type('081234567890')
      cy.get('select').select('drg. Siti Nurhaliza - Sp.BM')
      cy.get('textarea').type('Sakit gigi geraham kanan')
    })

    // Submit pada tombol konfirmasi modal (= "Tambah")
    cy.contains('button', 'Tambah').click()

    // Modal menutup setelah berhasil & pasien muncul di tabel antrian
    cy.contains('Tambah Walk-in').should('not.exist')
    cy.contains('Pasien Test Walk-in').should('be.visible')
  })
})
