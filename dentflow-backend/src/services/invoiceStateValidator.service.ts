export class InvoiceStateValidator {
  static readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    UNPAID: ['PARTIAL', 'PAID'],
    PARTIAL: ['PAID'],
    PAID: [], // no transitions from PAID
  };

  static validateTransition(currentStatus: string, newStatus: string): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed) return false;
    return allowed.includes(newStatus);
  }

  static validatePaidState(
    status: string,
    paidAt: Date | null,
    amountPaid: number | null
  ): boolean {
    if (status === 'UNPAID') {
      return paidAt === null && amountPaid === null;
    }
    if (status === 'PARTIAL') {
      return paidAt !== null && amountPaid !== null && amountPaid > 0;
    }
    if (status === 'PAID') {
      return paidAt !== null && amountPaid !== null && amountPaid > 0;
    }
    return false;
  }
}
