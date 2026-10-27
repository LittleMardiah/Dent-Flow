describe('Payment Webhook E2E (Task 5.1.5)', () => {
  const BASE_API = 'http://localhost:3001';
  const SERVER_KEY = 'test-key'; // fallback handler (MIDTRANS_SERVER_KEY tidak di-set di .env dev)
  const SEED_INVOICE = 'INV-E2E-20260906-001'; // invoice UNPAID Rp 150.000 dari seed-e2e.cjs
  const REPLAY_INVOICE = 'INV-E2E-WH-REPLAY-001'; // dibuat oleh task seedWebhookReplay

  // HMAC-SHA256(order_id + status_code + gross_amount + server_key) via Web Crypto
  const sign = async (orderId: string, statusCode: string, grossAmount: string) => {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SERVER_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(orderId + statusCode + grossAmount + SERVER_KEY)
    );
    return Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const sendWebhook = (
    orderId: string,
    webhookId: string,
    onResponse: (res: Cypress.Response<any>) => void
  ) => {
    return cy.then(async () => {
      const signature = await sign(orderId, '200', '150000');
      cy.request({
        method: 'POST',
        url: `${BASE_API}/webhooks/midtrans`,
        headers: {
          'x-midtrans-signature': signature,
          'x-midtrans-webhook-id': webhookId,
        },
        body: {
          status_code: '200',
          order_id: orderId,
          transaction_status: 'capture',
          gross_amount: '150000',
          transaction_id: `cy-txn-${Date.now()}`,
        },
        failOnStatusCode: false,
      }).then(onResponse);
    });
  };

  beforeEach(() => {
    cy.seedFixtures();
  });

  it('T1: admin melihat invoice status berubah UNPAID → PAID', () => {
    cy.adminLogin();

    // 1. Invoice seed tampil UNPAID di finance
    cy.visit('/admin/finance');
    cy.contains('Manajemen Keuangan & Invoice').should('be.visible');
    cy.get('select').first().select('UNPAID');
    cy.contains('td', SEED_INVOICE).closest('tr').contains('Belum Bayar').should('be.visible');

    // 2. Webhook Midtrans valid masuk → respons 200
    sendWebhook(SEED_INVOICE, `cy-pay-${Date.now()}`, (res) => {
      expect(res.status).to.eq(200);
      expect(res.body.success).to.eq(true);
    });

    // 3. Reload → invoice kini berstatus Lunas (PAID)
    cy.contains('Manajemen Keuangan & Invoice').should('be.visible');
    cy.get('select').first().select('PAID');
    cy.contains('td', SEED_INVOICE).closest('tr').contains('Lunas').should('be.visible');
  });

  it('T2: admin replay webhook yang gagal berhasil (200)', () => {
    cy.adminLogin();
    cy.visit('/admin/finance');
    cy.contains('Manajemen Keuangan & Invoice').should('be.visible');

    // 1. Webhook gagal karena invoice belum ada → 403 + error record dibuat
    const replayWebhookId = `cy-replay-${Date.now()}`;
    sendWebhook(REPLAY_INVOICE, replayWebhookId, (res) => {
      expect(res.status).to.eq(403);
      expect(res.body.success).to.eq(false);
    });

    // 2. Invoice baru dengan nomor yang sama dibuat (task seeding)
    cy.task('seedWebhookReplay');

    // 3. Admin replay via backend API → sukses (200)
    cy.window().then((win) => {
      const token = win.localStorage.getItem('dentflow_token');
      expect(token).to.be.a('string').and.not.be.empty;

      cy.request({
        method: 'POST',
        url: `${BASE_API}/api/admin/webhooks/${replayWebhookId}/replay`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });

    // 4. Invoice hasil replay tampil Lunas (PAID) di finance
    cy.reload();
    cy.contains('Manajemen Keuangan & Invoice').should('be.visible');
    cy.get('select').first().select('PAID');
    cy.contains('td', REPLAY_INVOICE).closest('tr').contains('Lunas').should('be.visible');
  });
});