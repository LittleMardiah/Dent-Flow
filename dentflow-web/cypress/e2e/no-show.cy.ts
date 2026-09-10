describe('NO-SHOW Detection & Management E2E', () => {
  const API_URL = 'http://localhost:3001';
  const BRANCH_ID = '494a607c-d109-4330-a3a9-68f54326f0c7';

  const adminLoginToken = (): Cypress.Chainable<string> => {
    return cy.request({
      method: 'POST',
      url: `${API_URL}/auth/admin/login`,
      body: { username: 'admin_a', password: 'Admin123!' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body.data.token as string;
    });
  };

  const patientLoginToken = (): Cypress.Chainable<string> => {
    return cy.request({
      method: 'POST',
      url: `${API_URL}/auth/patient/login`,
      body: { username: 'budi_santoso', password: 'Patient123!' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body.data.token as string;
    });
  };

  const findBookingId = (token: string, bookingCode: string): Cypress.Chainable<string> => {
    return cy.request({
      method: 'GET',
      url: `${API_URL}/api/patient/bookings`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(200);
      const bookings = res.body.data?.bookings || [];
      const booking = bookings.find((b: any) => b.booking_code === bookingCode);
      expect(booking, `booking ${bookingCode} should exist`).to.exist;
      return booking.id as string;
    });
  };

  before(() => {
    cy.task('seedNoShow');
  });

  it('should let admin view NO-SHOW list for the branch', () => {
    adminLoginToken().then((token) => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/no-shows/admin/no-shows?branchId=${BRANCH_ID}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.be.true;
        expect(res.body.count).to.be.gte(1);

        const rows = res.body.data as any[];
        expect(rows.map((r) => r.status)).to.include('NO_SHOW');
        cy.log(`NO-SHOW count for branch: ${rows.length}`);
      });
    });
  });

  it('should let admin manually mark a booking as NO-SHOW (idempotent)', () => {
    patientLoginToken().then((patientToken) => {
      findBookingId(patientToken, 'E2E-NS-MANUAL-001').then((bookingId) => {
        return adminLoginToken().then((token) => {
          // Mark pertama
          cy.request({
            method: 'PUT',
            url: `${API_URL}/api/no-shows/admin/bookings/${bookingId}/mark-no-show`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(200);
            expect(res.body.success).to.be.true;
            expect(res.body.data.status).to.eq('NO_SHOW');
          }).then(() => {
            // Idempotent: panggil lagi, harus tetap 200
            cy.request({
              method: 'PUT',
              url: `${API_URL}/api/no-shows/admin/bookings/${bookingId}/mark-no-show`,
              headers: { Authorization: `Bearer ${token}` },
              failOnStatusCode: false,
            }).then((res2) => {
              expect(res2.status).to.eq(200);
              expect(res2.body.success).to.be.true;
              expect(res2.body.data.status).to.eq('NO_SHOW');
            });
          });
        });
      });
    });
  });

  it('should display NO-SHOW badge in patient booking history', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('patient@test.com');
    cy.get('input[type="password"]').type('Patient123!');
    cy.get('button[type="submit"]').click();

    cy.url({ timeout: 20000 }).should('include', '/patient/dashboard');

    cy.visit('/patient/bookings');

    cy.contains('Riwayat Janji Temu').should('be.visible');
    cy.contains('Tidak Datang').should('be.visible');
  });
});