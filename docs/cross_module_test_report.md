# Cross-Module Test Report

## Automated Test Execution

### Backend

- Command: `php artisan test`
- Result: 391 passed, 20 failed, 1,983 assertions
- Duration: 71.79 seconds
- Framework: PHPUnit / Laravel

Failed backend tests:

- `Tests\Feature\AuditCoverageTest` - reservation lifecycle audited
- `Tests\Feature\CoreCustomerReservationTest` - 10 reservation creation and validation cases
- `Tests\Feature\ReservationDateTimePayloadTest` - 2 reservation date/time cases
- `Tests\Feature\ReservationTableLifecycleTest` - 6 table lifecycle and eligibility cases
- `Tests\Feature\SecurityHardeningTest` - reservation mutation restricted

Failure cause: reservation creation returns `422` because the policy requires a card on file for Saturday reservations, while the tests create Saturday reservations without card details.

### Frontend

- Command: `npm test`
- Result: 258 passed, 3 failed
- Total test files: 55

Failed frontend tests:

- `src/lib/utils/permissions.test.ts` - waiter POS/report permission expectation
- `src/features/pos/components/PaymentScope.test.tsx` - payment method scoping, 2 cases

### Static Checks

- TypeScript: `npx tsc --noEmit` passed with no output.
- ESLint: touched frontend files passed; a full-project lint run was not executed during this audit.
- Playwright: dependency is installed, but no Playwright spec files were found.

## Cross-Module Workflow Results

### Workflow 1: Restaurant Reservation

- Status: Partially Working
- Evidence: reservation CRUD, availability, policy, and calendar endpoints exist; targeted tests pass.
- Issues: 36 same-table overlaps and 270 midnight-wrapped end times in generated data; weekend card policy causes 20 backend test failures.

### Workflow 2: Restaurant Order and Payment

- Status: Passed for core flows
- Evidence: order item totals reconcile exactly; invoice totals match order totals; payment sums match invoice totals; no backend order/payment test failures were observed.
- Issues: historical order totals use VAT-exclusive arithmetic while the application setting is VAT-inclusive.

### Workflow 3: Inventory Purchasing

- Status: Partially Working
- Evidence: 1,500 purchase orders, 6,914 purchase order items, 5,000 stock movements, and 40 ingredients exist.
- Issues: 302 delivered purchase orders are not directly linked to stock movements; wastage records are absent.

### Workflow 4: Hotel Reservation

- Status: Not Applicable
- Evidence: no hotel modules, routes, models, tables, or pages exist.

### Workflow 5: User Permissions and Audit Logs

- Status: Partially Working
- Evidence: audit logs contain 15,000 records; backend authorization is enforced by role middleware.
- Issues: one frontend permission-matrix test fails due to an updated permission expectation.

## Test Coverage Gaps

- No historical kitchen ticket records exist.
- No refund, gift card, or cash-register session records exist.
- No waitlist, replenishment, or wastage records exist.
- No notification records exist.
- No hotel records or tests exist.
- No end-to-end Playwright tests exist.
- Reservation overlap and midnight-wraparound behavior are not covered by automated tests.
- Historical VAT reconciliation is not covered by automated tests.
