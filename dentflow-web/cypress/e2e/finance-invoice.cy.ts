describe('Admin Finance & Invoice Flow', () => {
  beforeEach(() => {
    cy.seedFixtures()
  })

  it('should login admin, view unpaid invoices, and input payment', () => {
    cy.adminLogin()

    // Buka halaman keuangan
    cy.visit('/admin/finance')
    cy.get('h1').contains('Keuangan', { timeout: 20000 }).should('be.visible')

    // Filter status "Belum Bayar" (UNPAID)
    cy.get('select').first().select('UNPAID')
    cy.contains('Belum Bayar').should('be.visible')

    // Buka detail invoice pertama
    cy.get('button[title="Detail"]').first().click()
    cy.contains(/^Invoice #/).should('be.visible')

    // Input pembayaran (buka modal pembayaran)
    cy.contains('button', 'Input Pembayaran').click()

    // Isi nominal & metode pembayaran di modal pembayaran
    cy.get('input[placeholder="Masukkan nominal"]').type('150000')
    cy.get('select').last().select('CASH')

    // Simpan pembayaran (tombol konfirmasi modal pembayaran)
    cy.contains('button', 'Simpan').click()

    // Modal pembayaran menutup setelah berhasil
    cy.get('input[placeholder="Masukkan nominal"]').should('not.exist')
  })
})
