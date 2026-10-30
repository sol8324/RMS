# Database Schema Audit

## attendance

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| staff_id | uuid | NO |  |  | staff_profiles.id |
| clock_in | timestamp without time zone | NO |  |  |  |
| clock_out | timestamp without time zone | YES |  |  |  |
| hours_worked | numeric | YES |  |  |  |
| status | character varying | NO | 'present'::character varying |  |  |
| notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## audit_logs

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| user_id | uuid | YES |  |  | users.id |
| auditable_type | character varying | NO |  |  |  |
| auditable_id | uuid | NO |  |  |  |
| action | character varying | NO |  |  |  |
| old_values | json | YES |  |  |  |
| new_values | json | YES |  |  |  |
| ip_address | character varying | YES |  |  |  |
| user_agent | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## cache

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| key | character varying | NO |  | PK |  |
| value | text | NO |  |  |  |
| expiration | integer | NO |  |  |  |

## cache_locks

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| key | character varying | NO |  | PK |  |
| owner | character varying | NO |  |  |  |
| expiration | integer | NO |  |  |  |

## cash_register_sessions

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| user_id | uuid | NO |  |  | users.id |
| opening_balance | numeric | NO | '0'::numeric |  |  |
| closing_balance | numeric | YES |  |  |  |
| actual_balance | numeric | YES |  |  |  |
| difference | numeric | YES |  |  |  |
| status | character varying | NO | 'open'::character varying |  |  |
| notes | text | YES |  |  |  |
| opened_at | timestamp without time zone | NO |  |  |  |
| closed_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## customers

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| email | character varying | YES |  |  |  |
| phone | character varying | YES |  |  |  |
| customer_type | character varying | NO | 'registered'::character varying |  |  |
| loyalty_points | integer | NO | 0 |  |  |
| total_spent | numeric | NO | '0'::numeric |  |  |
| visit_count | integer | NO | 0 |  |  |
| notes | text | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| address | character varying | YES |  |  |  |
| birthday | date | YES |  |  |  |
| dietary_restrictions | text | YES |  |  |  |
| no_show_counter | integer | NO | 0 |  |  |
| partial_show_counter | integer | NO | 0 |  |  |
| guest_flag_level | integer | NO | 0 |  |  |

## discounts

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| code | character varying | YES |  |  |  |
| type | character varying | NO | 'percentage'::character varying |  |  |
| value | numeric | NO |  |  |  |
| min_order_amount | numeric | YES |  |  |  |
| max_discount_amount | numeric | YES |  |  |  |
| max_uses | integer | YES |  |  |  |
| used_count | integer | NO | 0 |  |  |
| start_date | timestamp without time zone | YES |  |  |  |
| end_date | timestamp without time zone | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| applies_to | character varying | NO | 'all'::character varying |  |  |
| description | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| promotion_kind | character varying | NO | 'automatic'::character varying |  |  |
| eligibility_type | character varying | NO | 'all'::character varying |  |  |
| minimum_loyalty_tier | character varying | YES |  |  |  |
| verification_required | boolean | NO | false |  |  |

## failed_jobs

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | bigint | NO | nextval('failed_jobs_id_seq'::regclass) | PK |  |
| uuid | character varying | NO |  |  |  |
| connection | text | NO |  |  |  |
| queue | text | NO |  |  |  |
| payload | text | NO |  |  |  |
| exception | text | NO |  |  |  |
| failed_at | timestamp without time zone | NO | CURRENT_TIMESTAMP |  |  |

## floor_plans

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| sort_order | integer | NO | 0 |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## gift_cards

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| code | character varying | NO |  |  |  |
| balance | numeric | NO |  |  |  |
| initial_amount | numeric | NO |  |  |  |
| status | character varying | NO | 'active'::character varying |  |  |
| expires_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## ingredients

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| sku | character varying | YES |  |  |  |
| category | character varying | YES |  |  |  |
| unit | character varying | NO |  |  |  |
| current_stock | numeric | NO | '0'::numeric |  |  |
| minimum_stock | numeric | NO | '0'::numeric |  |  |
| maximum_stock | numeric | YES |  |  |  |
| cost_per_unit | numeric | NO | '0'::numeric |  |  |
| supplier_id | uuid | YES |  |  | suppliers.id |
| storage_location | character varying | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## invoices

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| invoice_number | character varying | NO |  |  |  |
| order_id | uuid | NO |  |  | orders.id |
| subtotal | numeric | NO | '0'::numeric |  |  |
| tax_amount | numeric | NO | '0'::numeric |  |  |
| discount_amount | numeric | NO | '0'::numeric |  |  |
| service_charge | numeric | NO | '0'::numeric |  |  |
| total | numeric | NO | '0'::numeric |  |  |
| amount_paid | numeric | NO | '0'::numeric |  |  |
| balance | numeric | NO | '0'::numeric |  |  |
| status | character varying | NO | 'unpaid'::character varying |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| statutory_discount_type | character varying | YES |  |  |  |
| statutory_discount_reference | character varying | YES |  |  |  |
| statutory_discount_name | character varying | YES |  |  |  |
| qualified_amount | numeric | NO | '0'::numeric |  |  |
| statutory_discount_amount | numeric | NO | '0'::numeric |  |  |
| vat_exempt_sales | numeric | NO | '0'::numeric |  |  |
| vatable_sales | numeric | NO | '0'::numeric |  |  |
| vat_enabled_snapshot | boolean | NO | true |  |  |
| vat_inclusive_snapshot | boolean | NO | true |  |  |
| tax_rate_snapshot | numeric | NO | '12'::numeric |  |  |
| seller_tin_snapshot | character varying | YES |  |  |  |
| seller_branch_code_snapshot | character varying | YES |  |  |  |
| seller_registered_name_snapshot | character varying | YES |  |  |  |
| seller_address_snapshot | character varying | YES |  |  |  |

## job_batches

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | character varying | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| total_jobs | integer | NO |  |  |  |
| pending_jobs | integer | NO |  |  |  |
| failed_jobs | integer | NO |  |  |  |
| failed_job_ids | text | NO |  |  |  |
| options | text | YES |  |  |  |
| cancelled_at | integer | YES |  |  |  |
| created_at | integer | NO |  |  |  |
| finished_at | integer | YES |  |  |  |

## jobs

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | bigint | NO | nextval('jobs_id_seq'::regclass) | PK |  |
| queue | character varying | NO |  |  |  |
| payload | text | NO |  |  |  |
| attempts | smallint | NO |  |  |  |
| reserved_at | integer | YES |  |  |  |
| available_at | integer | NO |  |  |  |
| created_at | integer | NO |  |  |  |

## kot_ticket_items

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| kot_ticket_id | uuid | NO |  |  | kot_tickets.id |
| order_item_id | uuid | NO |  |  | order_items.id |
| name | character varying | NO |  |  |  |
| quantity | integer | NO |  |  |  |
| notes | text | YES |  |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## kot_tickets

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| kot_number | character varying | NO |  |  |  |
| order_id | uuid | NO |  |  | orders.id |
| status | character varying | NO | 'received'::character varying |  |  |
| priority | character varying | NO | 'normal'::character varying |  |  |
| station | character varying | YES |  |  |  |
| estimated_minutes | integer | YES |  |  |  |
| started_at | timestamp without time zone | YES |  |  |  |
| completed_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| archived_at | timestamp without time zone | YES |  |  |  |

## leave_requests

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| staff_id | uuid | NO |  |  | staff_profiles.id |
| leave_type | character varying | NO |  |  |  |
| reason | text | NO |  |  |  |
| start_date | date | NO |  |  |  |
| end_date | date | NO |  |  |  |
| status | character varying | NO | 'requested'::character varying |  |  |
| requested_at | timestamp without time zone | YES |  |  |  |
| decided_by | uuid | YES |  |  | users.id |
| decided_at | timestamp without time zone | YES |  |  |  |
| decision_notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## menu_categories

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| slug | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| image_url | character varying | YES |  |  |  |
| sort_order | integer | NO | 0 |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## menu_combo_items

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| combo_id | uuid | NO |  | PK | menu_combos.id |
| menu_item_id | uuid | NO |  | PK | menu_items.id |
| quantity | integer | NO | 1 |  |  |

## menu_combos

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| price | numeric | NO |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## menu_item_modifiers

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| menu_item_id | uuid | NO |  | PK | menu_items.id |
| modifier_id | uuid | NO |  | PK | menu_modifiers.id |

## menu_items

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| category_id | uuid | NO |  |  | menu_categories.id |
| name | character varying | NO |  |  |  |
| slug | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| price | numeric | NO |  |  |  |
| image_url | character varying | YES |  |  |  |
| sku | character varying | YES |  |  |  |
| is_available | boolean | NO | true |  |  |
| is_featured | boolean | NO | false |  |  |
| cost_price | numeric | YES |  |  |  |
| prep_time_minutes | integer | YES |  |  |  |
| tags | json | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| image_data | text | YES |  |  |  |
| image_mime_type | character varying | YES |  |  |  |

## menu_modifiers

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| price | numeric | NO | '0'::numeric |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## migrations

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | integer | NO | nextval('migrations_id_seq'::regclass) | PK |  |
| migration | character varying | NO |  |  |  |
| batch | integer | NO |  |  |  |

## model_has_roles

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| role_id | uuid | NO |  | PK | roles.id |
| model_type | character varying | NO |  | PK |  |
| model_id | uuid | NO |  | PK |  |

## order_item_modifiers

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| order_item_id | uuid | NO |  | PK | order_items.id |
| modifier_id | uuid | NO |  | PK | menu_modifiers.id |
| name | character varying | NO |  |  |  |
| price | numeric | NO |  |  |  |

## order_items

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| order_id | uuid | NO |  |  | orders.id |
| menu_item_id | uuid | NO |  |  | menu_items.id |
| name | character varying | NO |  |  |  |
| quantity | integer | NO |  |  |  |
| unit_price | numeric | NO |  |  |  |
| total_price | numeric | NO |  |  |  |
| discount_amount | numeric | NO | '0'::numeric |  |  |
| notes | text | YES |  |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## order_status_history

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| order_id | uuid | NO |  |  | orders.id |
| status | character varying | NO |  |  |  |
| notes | text | YES |  |  |  |
| changed_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## orders

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| order_number | character varying | NO |  |  |  |
| customer_id | uuid | YES |  |  | customers.id |
| table_id | uuid | YES |  |  | tables.id |
| order_type | character varying | NO | 'dine_in'::character varying |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| subtotal | numeric | NO | '0'::numeric |  |  |
| tax_amount | numeric | NO | '0'::numeric |  |  |
| discount_amount | numeric | NO | '0'::numeric |  |  |
| service_charge | numeric | NO | '0'::numeric |  |  |
| total | numeric | NO | '0'::numeric |  |  |
| payment_status | character varying | NO | 'unpaid'::character varying |  |  |
| payment_method | character varying | YES |  |  |  |
| notes | text | YES |  |  |  |
| cancellation_reason | text | YES |  |  |  |
| created_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| archived_at | timestamp without time zone | YES |  |  |  |
| discount_id | uuid | YES |  |  | discounts.id |
| applied_discount_name | character varying | YES |  |  |  |
| applied_discount_code | character varying | YES |  |  |  |
| applied_discount_type | character varying | YES |  |  |  |
| applied_discount_value | numeric | YES |  |  |  |
| statutory_discount_type | character varying | YES |  |  |  |
| statutory_discount_reference | character varying | YES |  |  |  |
| statutory_discount_name | character varying | YES |  |  |  |
| qualified_amount | numeric | NO | '0'::numeric |  |  |
| statutory_discount_amount | numeric | NO | '0'::numeric |  |  |
| vat_exempt_sales | numeric | NO | '0'::numeric |  |  |

## outlets

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| address | text | YES |  |  |  |
| phone | character varying | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## password_reset_tokens

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| email | character varying | NO |  | PK |  |
| token | character varying | NO |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |

## payments

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| invoice_id | uuid | NO |  |  | invoices.id |
| amount | numeric | NO |  |  |  |
| payment_method | character varying | NO |  |  |  |
| reference_number | character varying | YES |  |  |  |
| notes | text | YES |  |  |  |
| processed_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## permissions

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| display_name | character varying | NO |  |  |  |
| module | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## personal_access_tokens

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | bigint | NO | nextval('personal_access_tokens_id_seq'::regclass) | PK |  |
| tokenable_type | character varying | NO |  |  |  |
| tokenable_id | uuid | NO |  |  |  |
| name | text | NO |  |  |  |
| token | character varying | NO |  |  |  |
| abilities | text | YES |  |  |  |
| last_used_at | timestamp without time zone | YES |  |  |  |
| expires_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |

## purchase_order_items

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| purchase_order_id | uuid | NO |  |  | purchase_orders.id |
| ingredient_id | uuid | NO |  |  | ingredients.id |
| quantity | numeric | NO |  |  |  |
| unit | character varying | NO |  |  |  |
| unit_cost | numeric | NO |  |  |  |
| total_cost | numeric | NO |  |  |  |
| received_quantity | numeric | NO | '0'::numeric |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## purchase_orders

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| po_number | character varying | NO |  |  |  |
| supplier_id | uuid | NO |  |  | suppliers.id |
| total_amount | numeric | NO | '0'::numeric |  |  |
| status | character varying | NO | 'draft'::character varying |  |  |
| notes | text | YES |  |  |  |
| expected_date | timestamp without time zone | YES |  |  |  |
| received_at | timestamp without time zone | YES |  |  |  |
| created_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## recipe_ingredients

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| recipe_id | uuid | NO |  | PK | recipes.id |
| ingredient_id | uuid | NO |  | PK | ingredients.id |
| quantity | numeric | NO |  |  |  |
| unit | character varying | NO |  |  |  |
| cost | numeric | YES |  |  |  |
| notes | text | YES |  |  |  |

## recipes

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| menu_item_id | uuid | NO |  |  | menu_items.id |
| instructions | text | YES |  |  |  |
| yield_quantity | numeric | NO | '1'::numeric |  |  |
| yield_unit | character varying | NO | 'serving'::character varying |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## refunds

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| payment_id | uuid | NO |  |  | payments.id |
| amount | numeric | NO |  |  |  |
| reason | character varying | NO |  |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| processed_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## replenishment_requests

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| request_number | character varying | NO |  |  |  |
| ingredient_id | uuid | NO |  |  | ingredients.id |
| quantity | numeric | NO |  |  |  |
| unit | character varying | YES |  |  |  |
| priority | character varying | NO | 'normal'::character varying |  |  |
| status | character varying | NO | 'draft'::character varying |  |  |
| requested_by | uuid | NO |  |  | users.id |
| notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## reservation_requests

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| reservation_id | uuid | NO |  |  | reservations.id |
| category | character varying | NO | 'other'::character varying |  |  |
| label | character varying | NO |  |  |  |
| value | character varying | YES |  |  |  |
| details | text | YES |  |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| priority | character varying | NO | 'normal'::character varying |  |  |
| is_matched | boolean | YES |  |  |  |
| acknowledged_by | uuid | YES |  |  | users.id |
| acknowledged_at | timestamp without time zone | YES |  |  |  |
| completed_by | uuid | YES |  |  | users.id |
| completed_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## reservations

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| customer_id | uuid | YES |  |  | customers.id |
| table_id | uuid | YES |  |  | tables.id |
| reservation_number | character varying | NO |  |  |  |
| guest_name | character varying | NO |  |  |  |
| guest_phone | character varying | YES |  |  |  |
| guest_email | character varying | YES |  |  |  |
| party_size | integer | NO |  |  |  |
| reservation_date | timestamp without time zone | NO |  |  |  |
| reservation_time | time without time zone | NO |  |  |  |
| status | character varying | NO | 'pending'::character varying |  |  |
| source | character varying | NO | 'phone'::character varying |  |  |
| special_requests | text | YES |  |  |  |
| cancellation_reason | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| archived_at | timestamp without time zone | YES |  |  |  |
| event_type | character varying | YES |  |  |  |
| card_required | boolean | NO | false |  |  |
| deposit_required | boolean | NO | false |  |  |
| deposit_amount | numeric | YES |  |  |  |
| deposit_paid | boolean | NO | false |  |  |
| card_on_file | boolean | NO | false |  |  |
| reserved_party_size | integer | YES |  |  |  |
| actual_party_size | integer | YES |  |  |  |
| duration_minutes | integer | NO | 180 |  |  |
| end_time | time without time zone | YES |  |  |  |
| reminder_24h_sent | boolean | NO | false |  |  |
| reminder_2h_sent | boolean | NO | false |  |  |
| no_show_counter | integer | NO | 0 |  |  |
| partial_show_counter | integer | NO | 0 |  |  |
| guest_flag_level | integer | NO | 0 |  |  |
| booking_scope | character varying | NO | 'standard'::character varying |  |  |

## restaurant_settings

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| address | text | YES |  |  |  |
| city | character varying | YES |  |  |  |
| state | character varying | YES |  |  |  |
| postal_code | character varying | YES |  |  |  |
| country | character varying | YES |  |  |  |
| phone | character varying | YES |  |  |  |
| email | character varying | YES |  |  |  |
| website | character varying | YES |  |  |  |
| logo_url | character varying | YES |  |  |  |
| timezone | character varying | NO | 'Asia/Manila'::character varying |  |  |
| currency | character varying | NO | 'PHP'::character varying |  |  |
| currency_symbol | character varying | NO | '₱'::character varying |  |  |
| tax_id | character varying | YES |  |  |  |
| business_registration | character varying | YES |  |  |  |
| opening_hours | json | YES |  |  |  |
| default_tax_rate | numeric | NO | '12'::numeric |  |  |
| default_service_charge | numeric | NO | '0'::numeric |  |  |
| service_charge_enabled | boolean | NO | false |  |  |
| receipt_header | character varying | YES |  |  |  |
| receipt_footer | character varying | YES |  |  |  |
| order_prefix | character varying | NO | 'ORD-'::character varying |  |  |
| invoice_prefix | character varying | NO | 'INV-'::character varying |  |  |
| table_reservation_timeout | integer | NO | 15 |  |  |
| kitchen_display_timeout | integer | NO | 30 |  |  |
| auto_cancel_timeout | integer | NO | 30 |  |  |
| allow_negative_inventory | boolean | NO | false |  |  |
| low_stock_threshold | integer | NO | 10 |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| vat_enabled | boolean | NO | true |  |  |
| vat_inclusive | boolean | NO | true |  |  |
| branch_code | character varying | YES |  |  |  |
| vat_registered | boolean | NO | false |  |  |
| reservation_card_threshold | integer | NO | 6 |  |  |
| reservation_no_show_fee | numeric | NO | '15'::numeric |  |  |
| reservation_no_show_flag_threshold | integer | NO | 2 |  |  |
| reservation_deposit_percentage | numeric | NO | '50'::numeric |  |  |
| reservation_cancellation_window_minutes | integer | NO | 15 |  |  |
| reservation_regular_duration_minutes | integer | NO | 180 |  |  |
| reservation_large_duration_minutes | integer | NO | 240 |  |  |
| reservation_weekend_days | json | YES |  |  |  |
| reservation_turnover_buffer_minutes | integer | NO | 15 |  |  |

## role_has_permissions

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| role_id | uuid | NO |  | PK |  |
| permission_id | uuid | NO |  | PK | permissions.id |

## roles

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| display_name | character varying | NO |  |  |  |
| description | text | YES |  |  |  |
| is_system | boolean | NO | false |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## sessions

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | character varying | NO |  | PK |  |
| user_id | uuid | YES |  |  |  |
| ip_address | character varying | YES |  |  |  |
| user_agent | text | YES |  |  |  |
| payload | text | NO |  |  |  |
| last_activity | integer | NO |  |  |  |

## shift_schedules

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| staff_id | uuid | NO |  |  | staff_profiles.id |
| shift_id | uuid | NO |  |  | staff_shifts.id |
| date | date | NO |  |  |  |
| status | character varying | NO | 'scheduled'::character varying |  |  |
| notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## staff_commissions

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| staff_id | uuid | NO |  |  | staff_profiles.id |
| order_id | uuid | NO |  |  | orders.id |
| amount | numeric | NO |  |  |  |
| type | character varying | NO | 'sales'::character varying |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## staff_notifications

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| user_id | uuid | NO |  |  | users.id |
| type | character varying | NO | 'info'::character varying |  |  |
| icon | character varying | NO | 'info'::character varying |  |  |
| title | character varying | NO |  |  |  |
| description | text | NO |  |  |  |
| action_label | character varying | YES |  |  |  |
| action_url | character varying | YES |  |  |  |
| related_type | character varying | YES |  |  |  |
| related_id | uuid | YES |  |  |  |
| read_at | timestamp without time zone | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## staff_performance

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| staff_id | uuid | NO |  |  | staff_profiles.id |
| period_date | date | NO |  |  |  |
| orders_served | integer | NO | 0 |  |  |
| total_sales | numeric | NO | '0'::numeric |  |  |
| tips_earned | numeric | NO | '0'::numeric |  |  |
| rating | numeric | YES |  |  |  |
| notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## staff_profiles

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| user_id | uuid | YES |  |  | users.id |
| employee_id | character varying | NO |  |  |  |
| position | character varying | YES |  |  |  |
| department | character varying | YES |  |  |  |
| hourly_rate | numeric | YES |  |  |  |
| base_salary | numeric | YES |  |  |  |
| hire_date | date | NO |  |  |  |
| end_date | date | YES |  |  |  |
| employment_type | character varying | NO | 'full_time'::character varying |  |  |
| phone | character varying | YES |  |  |  |
| address | text | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## staff_shifts

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| start_time | time without time zone | NO |  |  |  |
| end_time | time without time zone | NO |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## stock_movements

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| ingredient_id | uuid | NO |  |  | ingredients.id |
| type | character varying | NO |  |  |  |
| quantity | numeric | NO |  |  |  |
| unit_cost | numeric | YES |  |  |  |
| reference_type | character varying | YES |  |  |  |
| reference_id | uuid | YES |  |  |  |
| notes | text | YES |  |  |  |
| created_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## suppliers

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| contact_person | character varying | YES |  |  |  |
| email | character varying | YES |  |  |  |
| phone | character varying | YES |  |  |  |
| address | text | YES |  |  |  |
| payment_terms | character varying | YES |  |  |  |
| rating | numeric | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## tables

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| number | character varying | NO |  |  |  |
| name | character varying | YES |  |  |  |
| zone | character varying | YES |  |  |  |
| section | character varying | YES |  |  |  |
| is_wheelchair_accessible | boolean | NO | false |  |  |
| capacity | integer | NO |  |  |  |
| status | character varying | NO | 'available'::character varying |  |  |
| shape | character varying | NO | 'rectangle'::character varying |  |  |
| pos_x | numeric | YES |  |  |  |
| pos_y | numeric | YES |  |  |  |
| width | numeric | YES |  |  |  |
| height | numeric | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |
| parent_table_id | uuid | YES |  |  | tables.id |
| floor_plan_id | uuid | YES |  |  | floor_plans.id |
| location | character varying | YES |  |  |  |
| location_description | character varying | YES |  |  |  |

## tax_settings

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| rate | numeric | NO |  |  |  |
| type | character varying | NO | 'percentage'::character varying |  |  |
| is_compound | boolean | NO | false |  |  |
| is_active | boolean | NO | true |  |  |
| applies_to | character varying | NO | 'all'::character varying |  |  |
| description | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## users

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| name | character varying | NO |  |  |  |
| email | character varying | NO |  |  |  |
| email_verified_at | timestamp without time zone | YES |  |  |  |
| password | character varying | NO |  |  |  |
| avatar | character varying | YES |  |  |  |
| is_active | boolean | NO | true |  |  |
| last_login_at | timestamp without time zone | YES |  |  |  |
| remember_token | character varying | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## waitlist

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| guest_name | character varying | NO |  |  |  |
| guest_phone | character varying | NO |  |  |  |
| party_size | integer | NO |  |  |  |
| status | character varying | NO | 'waiting'::character varying |  |  |
| notes | text | YES |  |  |  |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

## wastage

| Column | Type | Nullable | Default | PK | FK |
|---|---|---:|---|---|---|
| id | uuid | NO |  | PK |  |
| ingredient_id | uuid | NO |  |  | ingredients.id |
| quantity | numeric | NO |  |  |  |
| reason | character varying | NO |  |  |  |
| notes | text | YES |  |  |  |
| reported_by | uuid | YES |  |  | users.id |
| created_at | timestamp without time zone | YES |  |  |  |
| updated_at | timestamp without time zone | YES |  |  |  |
| deleted_at | timestamp without time zone | YES |  |  |  |

