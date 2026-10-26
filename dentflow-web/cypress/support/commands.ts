declare namespace Cypress {
  interface Chainable {
    adminLogin(): Chainable<void>;
    doctorLogin(): Chainable<void>;
    seedFixtures(): Chainable<void>;
  }
}

Cypress.Commands.add('adminLogin', () => {
  cy.visit('/login');
  cy.get('input[type="email"]').type('admin@clinic.com');
  cy.get('input[type="password"]').type('Admin123!');
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/admin');
});

Cypress.Commands.add('doctorLogin', () => {
  cy.visit('/login');
  cy.get('input[type="email"]').type('dr_bm_a@clinic.com');
  cy.get('input[type="password"]').type('Doctor123!');
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/doctor');
});

// Seed fixture E2E (queue + invoice) via dentflow-backend/scripts/seed-e2e.cjs
// (cy.task('seedE2E') di cypress.config.ts). Idempotent: hapus semua booking
// bercode E2E-% lalu buat ulang, sehingga tiap spec selalu punya antrian dokter
// & invoice UNPAID hari ini.
Cypress.Commands.add('seedFixtures', () => {
  cy.task('seedE2E');
});