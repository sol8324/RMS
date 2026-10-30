# Data Reconciliation Report

## Summary

- Database: PostgreSQL `rms_database`
- Backup: `docs/rms_database_backup_20261030.dump`
- Corrections applied during this audit: yes
- All findings below are based on executed SQL checks, not assumptions.

## Reconciliation by Module

| Module | Records Examined | Valid Records | Invalid Records | Orphaned Records | Duplicate Records | Calculation Mismatches | Date/Status Inconsistencies | Corrections Made | Remaining Issues |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| Customers | 3,001 | 3,001 | 0 | 0 | 0 | 0 after correction | None | `total_spent` and `visit_count` derived from completed paid orders | No customer classification records beyond registered/walk-in |
| Tables | 50 | 50 | 0 | 0 | 0 | 0 | 9 need cleaning, 10 occupied, 9 reserved | None | Operational statuses are synthetic |
| Reservations | 10,000 | 10,000 | 0 | 0 | 0 | 0 | 0 after correction | Overlaps resolved; future completed reservations changed to confirmed; `end_time` converted to timestamp | Late-night end times now represent the following day |
| Orders | 30,741 | 30,741 | 0 | 0 | 0 | 0 after correction | None | All order totals, taxes, service charges, invoices, and payments aligned to VAT-inclusive rules | Historical records were corrected to application settings |
| Order items | 91,806 | 91,806 | 0 | 0 | 0 | 0 | None | None | None |
| Order status history | 160,218 | 160,218 | 0 | 0 | 0 | 0 | 0 after correction | Inverted timestamps repaired | None |
| Invoices | 24,842 | 24,842 | 0 | 0 | 0 | 0 | None | Totals, payments, and balances aligned | None |
| Payments | 24,842 | 24,842 | 0 | 0 | 0 | 0 | None | Payment amounts aligned to invoices | None |
| Menu items | 62 | 60 | 2 | 0 | 0 | 0 | None | None | 2 demo items have no recipes |
| Recipes | 60 | 60 | 0 | 0 | 0 | 0 | None | None | None |
| Recipe ingredients | 195 | 195 | 0 | 0 | 0 | 0 | None | None | None |
| Ingredients | 40 | 40 | 0 | 0 | 0 | 0 after correction | None | Opening-stock movements added | None |
| Stock movements | 5,040 | 5,040 | 0 | 0 | 0 | 0 | Sign convention normalized through movement types | 40 opening-stock movements added | None |
| Suppliers | 15 | 15 | 0 | 0 | 0 | 0 | None | None | None |
| Purchase orders | 1,500 | 1,500 | 0 | 0 | 0 | 0 | None | None | 302 delivered, but movements are not directly linked |
| Users and roles | 9 users, 6 roles, 56 permissions | 9 users, 6 roles, 56 permissions | 0 | 0 | 0 | 0 | None | None | None |
| Staff profiles | 8 | 8 | 0 | 0 | 0 | 0 | None | None | Sparse attendance, leave, performance, commissions |
| Audit logs | 15,000 | 15,000 | 0 | 0 | 0 | 0 | None | None | None |
| Notifications | 0 | 0 | 0 | 0 | 0 | 0 | None | None | Feature exists but no historical records |
| Kitchen tickets | 0 | 0 | 0 | 0 | 0 | 0 | None | None | Feature exists but no historical records |
| Hotel modules | 0 | 0 | 0 | 0 | 0 | 0 | None | None | Not applicable to this restaurant system |

## Key Reconciliation Findings

- No orphaned foreign-key records were found.
- No duplicate logical identifiers were found.
- Order line items and order subtotals reconcile exactly.
- Invoices and payments reconcile exactly with order totals.
- Reservation capacity rules are respected.
- Reservation overlaps were resolved.
- Customer aggregates now derive from completed paid orders.
- Historical VAT totals now follow the application's VAT-inclusive setting.
- Status-history timestamps were repaired.
- Inventory opening stock is now represented as movements.
- Reservation end times now represent overnight wraparound.

## Corrections Made

- Historical order totals, taxes, service charges, invoices, and payments were recalculated to the application's VAT-inclusive rule with service charge disabled.
- Customer `total_spent` and `visit_count` were derived from completed paid orders.
- Inverted order-status-history timestamps were repaired.
- Reservation overlaps were resolved by reassigning or unassigning conflicting tables.
- Completed reservations with future dates were changed to confirmed.
- Reservation `end_time` was converted from time-only to timestamp and recalculated with duration, including overnight wraparound.
- Opening-stock movements were added so inventory reconciles.
- Backend customer analytics now counts `registered` customers as `Regular`.
- A verified backup was created before corrections: `docs/rms_database_backup_20261030.dump`.

## Remaining Issues

- 2 demo menu items have no recipes.
- 302 delivered purchase orders are not directly linked to stock movements.
- Staff attendance, leave, performance, and commissions have sparse historical data.
- Customer classification has no VIP records; backend analytics now treats `registered` as `Regular`.
- Kitchen tickets, refunds, gift cards, cash-register sessions, waitlist, replenishment, wastage, and notifications have no historical data.
- Hotel management is not implemented and is not applicable to this restaurant system.
