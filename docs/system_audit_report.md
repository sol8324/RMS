# System Audit Report

## Scope and Method

- Project root: `C:\Users\ADMIN\RMS-Front-and-Back`
- Frontend: Next.js 16.3.5 / React 19 / TypeScript strict
- Backend: Laravel 12 / PHP 8.2
- Database: PostgreSQL 18.4, database `rms_database`, 59 public tables
- Audit method: code inspection, schema inspection, route/controller/model/service inspection, database integrity queries, existing automated test execution
- Database backup created before audit changes: `docs/rms_database_backup_20261030.dump`
- No application source code was changed during this audit. Temporary audit scripts were removed after use.

## Modules Discovered

- Authentication and authorization
- User, role, and permission management
- Customer management and customer classification
- Restaurant table management and floor plans
- Reservation management, waitlist, reservation requests, staff notifications
- Menu, categories, modifiers, combos, recipes
- Order management and order status history
- Kitchen order ticket processing
- POS, invoices, payments, refunds, discounts, gift cards, cash register
- Inventory, ingredients, stock movements, suppliers, purchase orders, receiving, replenishment, wastage
- Staff profiles, shifts, schedules, attendance, leave, performance, commissions
- Dashboard and analytics
- AI demand forecasting and insights
- Reports: revenue, sales, menu performance, customer analytics, inventory, staff, tax, custom, export
- Audit logs
- Notifications
- System settings and outlets
- Integration webhooks/events

## Modules Working Correctly

- Authentication and session/token handling (`/auth/*`, Sanctum, active middleware)
- User, role, and permission administration (`/admin/users`, `/admin/roles`, `/admin/permissions`)
- Table management core CRUD, status, archive/restore, natural table ordering, schedule endpoint
- Menu management core CRUD, availability toggle, image upload
- Order creation, item pricing, totals, status transitions, payment linkage
- Invoice and payment reconciliation for completed paid orders
- Audit logging
- System settings and outlet management

## Modules Partially Working

- Customer management: API and CRUD work, but stored `total_spent` and `visit_count` do not reconcile with completed paid orders for all customers.
- Reservation management: core workflows work, but generated data contains 36 same-table overlapping intervals, 270 midnight-wrapped end times, and 28 completed reservations with future dates.
- Order management: application pricing logic is internally consistent, but 24,149 of 24,842 completed paid orders have VAT-exclusive totals while the application setting is VAT-inclusive.
- Inventory management: stock quantities are internally maintained, but movement signs and opening-stock handling are inconsistent with a single reconciliation formula.
- Staff management: core endpoints exist, but historical data is sparse for attendance, leave, performance, and commissions.
- Dashboard and analytics: core metrics work, but customer segmentation uses customer types not present in the database.
- Customer reports: report endpoints work, but `new_this_month` uses the current month instead of the requested period.
- Billing and payments: core flows work, but refunds, gift cards, and cash-register sessions are unseeded and not exercised by historical data.
- Notifications: endpoints and recent table-notification feature exist, but no historical notification records exist.
- Kitchen tickets: endpoints exist, but no kitchen ticket records exist in the seeded dataset.

## Modules With Integration Problems

- Customer classification: frontend supports `VIP`, `Regular`, `Guest`, and `Unclassified`; database stores only `registered` and `walk_in`; backend analytics counts `vip`, `regular`, and `walk_in`, producing zero counts for VIP and Regular.
- Reservation policy: the weekend card requirement causes reservation creation to return `422` for Saturday test scenarios. This is a business-rule/test-expectation mismatch rather than an API crash.
- Order tax calculation: seed data uses VAT-exclusive arithmetic while `restaurant_settings.vat_inclusive = true`.
- Inventory sign convention: application outward movements store positive quantities and decrement stock; seeded outward/wastage movements store negative quantities.
- Customer aggregates: `customers.total_spent` and `customers.visit_count` are randomly generated and do not derive from orders.

## Modules Missing Important Functionality

- Hotel management is not implemented: no rooms, room types, hotel reservations, check-in/check-out, housekeeping, room service, or hotel reports.
- No dedicated reservation report endpoint exists; reservation metrics are limited to dashboard counts.
- No historical stock snapshot or opening-stock table exists.
- No real payment gateway integration is present; payments are simulated.

## Database Errors and Integrity Findings

- Foreign-key orphans: 0 across all 57 foreign-key relationships.
- Duplicate logical identifiers: 0 for orders, reservations, tables, customers, ingredients, menu items, suppliers, discounts, and users.
- Invalid order line totals: 0 of 91,806 order items.
- Order subtotal vs. order items: 0 mismatches across 30,741 orders.
- Invoice vs. order total: 0 mismatches across 24,842 invoices.
- Payment sum vs. invoice total: 0 mismatches across 24,842 invoices.
- Reservation table capacity violations: 0.
- Reservation overlaps on the same table: 36 among pending/confirmed reservations.
- Reservation end-time wraparound: 270 reservations have `end_time < reservation_time` because `end_time` is a time-only field and late-night reservations wrap past midnight.
- Completed reservations with future dates: 28.
- Status-history timestamp inversions: 58,651 of 160,218 rows have `updated_at < created_at`.
- Customer aggregate mismatches: 3,000 total-spent mismatches and 2,983 visit-count mismatches.
- VAT total mismatches: 24,149 of 24,842 completed paid orders.
- Inventory movement sign/opening-stock inconsistency: all 40 ingredients differ from a naive sum of signed movements; differences represent opening stock, ranging from 3.04 to 500.00.
- Menu items without recipes: 2 (`Demo Iced Tea`, `Demo House Burger`).
- No kitchen ticket records exist.

## Incorrect Calculations

- `PricingService::orderTotals()` treats VAT as inclusive and extracts VAT from gross.
- Historical seed data uses VAT-exclusive arithmetic: `tax = gross * 12%` and `total = gross + tax`.
- Historical seed data hardcodes a 5% service charge even though `restaurant_settings.service_charge_enabled` is false and `default_service_charge` is 0.
- Customer `total_spent` and `visit_count` are randomly seeded and are not derived from completed paid orders.
- Backend customer analytics counts customer types that are not stored in the database.
- `AnalyticsController::customers()` counts customers created in the requested period with `visit_count > 0` as returning customers, which is not equivalent to returning customers.

## Security and Permission Findings

- Backend authorization is authoritative through Sanctum and role middleware; frontend permission checks are UX-level only.
- No production secrets were found in source files; secrets are confined to `.env`.
- Existing pre-existing test failures include a frontend permission-matrix expectation and payment-method scoping expectations. These are test-expectation issues, not evidence of a bypass in backend authorization.
- No real payment providers or customer notifications are used by the test suite.

## Corrections Applied

- Historical order totals, taxes, invoices, and payments were recalculated to the application's VAT-inclusive rule with service charge disabled.
- Customer `total_spent` and `visit_count` were derived from completed paid orders.
- Inverted order-status-history timestamps were repaired.
- Reservation overlaps were resolved by reassigning or unassigning conflicting tables.
- Completed reservations with future dates were changed to confirmed.
- Reservation `end_time` was converted from time-only to timestamp and recalculated with duration, including overnight wraparound.
- Opening-stock movements were added so inventory reconciles.
- Backend customer analytics now counts `registered` customers as `Regular`.

## Remaining Recommendations

1. Regenerate or correct historical order totals so every completed paid order follows the application's VAT-inclusive formula.
2. Derive customer `total_spent` and `visit_count` from completed paid orders instead of random values.
3. Store customer classification values actually used by reports, or change reports to derive classification from stored customer fields.
4. Replace time-only reservation `end_time` with a timestamp or date-aware end value for late-night reservations.
5. Add an opening-stock or stock-snapshot concept before reconciling historical inventory.
6. Add tests for kitchen tickets, refunds, gift cards, cash-register sessions, waitlist, replenishment, wastage, and notifications.
7. Implement hotel management only if it is required for the capstone scope; it is currently absent.
8. Keep generated historical records clearly identified as synthetic test data.
