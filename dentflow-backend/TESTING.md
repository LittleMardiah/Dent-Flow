# Testing Documentation - DentFlow

## Coverage Report

**Generated:** Sat Jul 25 21:35:27 WIB 2026

### Summary (Unit Tests Only)
*Integration tests are skipped in this report and will be added in Task 2.7.3.*

| Metric | Actual |
|--------|--------|
| Statements | 59.27% |
| Branches | 40.97% |
| Functions | 63.63% |
| Lines | 58.98% |

### How to Run Tests



### Coverage Gap Analysis

Low coverage is primarily in:
- **Services**: booking.service.ts, queue.service.ts, paymentInput.service.ts, doctorQueue.service.ts
- **Repositories**: booking.repository.ts, queue.repository.ts
- **Handlers**: Many handler files have low coverage due to integration-heavy logic.

These will be covered by integration tests in Task 2.7.3.

**Technical Debt** (from TECHNICAL DEBT.txt):
- Audit log FK error (TD-DB-002) still appears in logs but does not break tests.
- Integration tests for webhook, invoice state machine, and booking flow are skipped until 2.7.3.

**Next Steps:** Proceed to Task 2.7.3 to write integration tests and achieve >=70% coverage.

**Last Updated:** Sat Jul 25 21:35:27 WIB 2026
