import { InvoiceStateValidator } from '../../../src/services/invoiceStateValidator.service';

describe('InvoiceStateValidator', () => {
  describe('validateTransition', () => {
    it('should return true for valid transitions', () => {
      expect(InvoiceStateValidator.validateTransition('UNPAID', 'PARTIAL')).toBe(true);
      expect(InvoiceStateValidator.validateTransition('UNPAID', 'PAID')).toBe(true);
      expect(InvoiceStateValidator.validateTransition('PARTIAL', 'PAID')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(InvoiceStateValidator.validateTransition('UNPAID', 'UNPAID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('UNPAID', 'INVALID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('PARTIAL', 'UNPAID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('PARTIAL', 'PARTIAL')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('PAID', 'UNPAID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('PAID', 'PARTIAL')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('PAID', 'PAID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('REFUNDED', 'PAID')).toBe(false);
    });

    it('should return false for unknown current status', () => {
      expect(InvoiceStateValidator.validateTransition('UNKNOWN', 'PAID')).toBe(false);
      expect(InvoiceStateValidator.validateTransition('', 'PAID')).toBe(false);
    });
  });

  describe('validatePaidState', () => {
    it('should return true for UNPAID with null paidAt and null amountPaid', () => {
      expect(InvoiceStateValidator.validatePaidState('UNPAID', null, null)).toBe(true);
    });

    it('should return false for UNPAID with paidAt not null', () => {
      expect(InvoiceStateValidator.validatePaidState('UNPAID', new Date(), null)).toBe(false);
    });

    it('should return false for UNPAID with amountPaid not null', () => {
      expect(InvoiceStateValidator.validatePaidState('UNPAID', null, 100)).toBe(false);
    });

    it('should return false for UNPAID with both not null', () => {
      expect(InvoiceStateValidator.validatePaidState('UNPAID', new Date(), 100)).toBe(false);
    });

    it('should return true for PARTIAL with paidAt and amountPaid > 0', () => {
      expect(InvoiceStateValidator.validatePaidState('PARTIAL', new Date(), 50)).toBe(true);
    });

    it('should return false for PARTIAL with paidAt null', () => {
      expect(InvoiceStateValidator.validatePaidState('PARTIAL', null, 50)).toBe(false);
    });

    it('should return false for PARTIAL with amountPaid null', () => {
      expect(InvoiceStateValidator.validatePaidState('PARTIAL', new Date(), null)).toBe(false);
    });

    it('should return false for PARTIAL with amountPaid <= 0', () => {
      expect(InvoiceStateValidator.validatePaidState('PARTIAL', new Date(), 0)).toBe(false);
      expect(InvoiceStateValidator.validatePaidState('PARTIAL', new Date(), -10)).toBe(false);
    });

    it('should return true for PAID with paidAt and amountPaid > 0', () => {
      expect(InvoiceStateValidator.validatePaidState('PAID', new Date(), 100)).toBe(true);
    });

    it('should return false for PAID with paidAt null', () => {
      expect(InvoiceStateValidator.validatePaidState('PAID', null, 100)).toBe(false);
    });

    it('should return false for PAID with amountPaid null', () => {
      expect(InvoiceStateValidator.validatePaidState('PAID', new Date(), null)).toBe(false);
    });

    it('should return false for PAID with amountPaid <= 0', () => {
      expect(InvoiceStateValidator.validatePaidState('PAID', new Date(), 0)).toBe(false);
      expect(InvoiceStateValidator.validatePaidState('PAID', new Date(), -10)).toBe(false);
    });

    it('should return false for unknown status', () => {
      expect(InvoiceStateValidator.validatePaidState('UNKNOWN', null, null)).toBe(false);
    });
  });
});
