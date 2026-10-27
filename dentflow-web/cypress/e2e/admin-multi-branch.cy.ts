describe('Admin Multi-Branch Ops (Task 5.1.3)', () => {
  const BRANCH_B_ID = '88d0b0a4-17f8-46c7-a8dc-8755fe8e8d4f';
  const BRANCH_C_ID = '7c1f0000-0000-4000-8000-00000000000c';

  beforeEach(() => {
    // Pastikan data branch A/B/C (pasien marker + grant admin A -> B) tersedia
    cy.task('seedMultiBranch');
  });

  it('Admin A melihat HANYA data Branch A di /admin/patients', () => {
    cy.adminLogin();
    cy.url().should('include', '/admin');

    cy.intercept('GET', '**/api/patients*').as('getPatients');
    cy.visit('/admin/patients');
    cy.wait('@getPatients');
    cy.wait(1000);
    cy.contains('h2.text-xl.font-bold', 'Manajemen Pasien').should('be.visible');

    // Data Branch A tampil (cari dulu karena daftar dipaginasi 20 per halaman)
    cy.get('input[placeholder*="Cari pasien"]').type('MB-Pasien{enter}');
    cy.contains('MB-Pasien', { timeout: 10000 }).should('exist');

    // Data Branch B TIDAK boleh tampil di daftar Branch A
    cy.contains('MB-Pasien B-1').should('not.exist');
  });

  it('Admin A pindah branch -> data Branch B muncul', () => {
    cy.adminLogin();
    cy.url().should('include', '/admin');

    // Tambahkan intercept ALAM sebelum visit agar @getPatients terdaftar
    cy.intercept('GET', '**/api/patients*').as('getPatients');
    cy.visit('/admin/patients');
    cy.wait('@getPatients');
    cy.get('select[data-testid="branch-switcher"]').should('be.visible');

    // Branch C tidak boleh ditawarkan (tidak di-grant)
    cy.get('select[data-testid="branch-switcher"] option').should('not.contain', 'Cabang C');

    // Ganti branch ke B -> daftar berisi data B, data A hilang
    cy.get('select[data-testid="branch-switcher"]').select(BRANCH_B_ID);
    cy.contains('MB-Pasien B-1').should('exist');
    cy.contains('MB-Pasien A-1').should('not.exist');
    cy.contains('MB-Pasien B-2').should('exist');
  });

  it('Admin A mencoba akses Branch C -> 403 (tenant isolation)', () => {
    cy.adminLogin();
    cy.url().should('include', '/admin');

    // Tambahkan intercept ALAM sebelum visit agar @getPatients terdaftar
    cy.intercept('GET', '**/api/patients*').as('getPatients');
    cy.visit('/admin/patients');
    cy.wait('@getPatients');
    cy.contains('h2.text-xl.font-bold', 'Manajemen Pasien').should('be.visible');

    // Ambil token dari localStorage dan paksa request ke Branch C
    cy.window().then((win) => {
      const token = win.localStorage.getItem('dentflow_token');
      expect(token).to.be.a('string').and.not.be.empty;

      cy.request({
        method: 'GET',
        url: `http://localhost:3001/api/patients?branchId=${BRANCH_C_ID}&page=1&limit=20`,
        failOnStatusCode: false,
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        expect(resp.status).to.eq(403);
      });
    });
  });
});