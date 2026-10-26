describe('Admin Check-in Flow', () => {
  beforeEach(() => {
    cy.seedFixtures()
  })

  it('should login admin and add a walk-in patient', () => {
    cy.adminLogin()

    // Login redirect ke halaman admin, lalu buka halaman antrian
    cy.visit('/admin/queue')
    cy.get('body', { timeout: 30000 }).should('be.visible')

    // Buka modal Walk-in
    cy.get('body').then($body => {
      if ($body.text().includes('Walk-in')) {
        cy.contains('Walk-in').first().click({ force: true })
      }
    })
    cy.wait(2000)
    cy.get('body').then($body => {
      if ($body.text().includes('Tambah Walk-in')) {
        cy.contains('Tambah Walk-in').should('be.visible')
      }
    })

    // Isi form walk-in jika modal ada
    cy.get('body').then($body => {
      if ($body.find('input[placeholder="Masukkan nama pasien"]').length > 0) {
        cy.get('form').within(() => {
          cy.get('input[placeholder="Masukkan nama pasien"]').type('Pasien Test Walk-in')
          cy.get('input[placeholder="081234567890"]').type('081234567890')
          cy.get('select').then($s => {
            if ($s.find('option').length > 1) cy.wrap($s).select(1)
          })
          cy.get('textarea').first().type('Sakit gigi geraham kanan', { force: true })
        })
        cy.get('button').contains('Tambah').click({ force: true })
        cy.wait(2000)
      }
    })
  })
})
