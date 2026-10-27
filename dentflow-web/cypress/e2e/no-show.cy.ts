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
      const token = res.body?.data?.token;
      expect(res.status).to.eq(200, `Admin login gagal: ${JSON.stringify(res.body)}`);
      expect(token).to.be.a('string').and.not.be.empty;
      return token;
    });
  };

  const patientLoginToken = (): Cypress.Chainable<string> => {
    return cy.request({
      method: 'POST',
      url: `${API_URL}/auth/patient/login`,
      body: { username: 'mb_patient_a_1', password: 'Patient123!' },
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
      const rawData = res.body.data || [];
      const bookings = Array.isArray(rawData) ? rawData : (rawData.bookings || []);
      const booking = bookings.find((b: any) => (b.booking_code === bookingCode || b.bookingCode === bookingCode));
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

  


  
});