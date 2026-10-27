import { Customer } from "./customer";
import { Table } from "./table";
import { User } from "./api";

export type StatutoryDiscountType =
  | "senior_citizen"
  | "pwd"
  | null;

export interface Order {
  id: string;
  invoice_id?: string | null;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_status?: string;
  customer_id?: string;
  customer?: Customer;
  /** Flattened customer label (never the UUID). */
  customer_name?: string | null;
  table_id?: string;
  table?: Table;
  /** Flattened table label (never the UUID). */
  table_number?: string | number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  applied_discount?: {
    id?: string | null;
    name: string;
    code?: string | null;
    type: "percentage" | "fixed";
    value: number;
  } | null;
  service_charge: number;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  items_count?: number;
  payments: Payment[];
  placed_at?: string;
  confirmed_at?: string;
  preparing_at?: string;
  ready_at?: string;
  served_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  statutory_discount_type?: StatutoryDiscountType;
  statutory_discount_reference?: string;
  statutory_discount_name?: string;
  qualified_amount?: number;
  statutory_discount_amount?: number;
  vat_exempt_sales?: number;
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  /** Backend serializes the snapshot name as `name` (OrderController). */
  name?: string;
  /** Legacy alias kept for defensive fallbacks in older payloads. */
  menu_item_name?: string;
  variant?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  notes?: string;
  status: OrderItemStatus;
  modifiers?: OrderItemModifier[];
  created_at?: string;
  updated_at?: string;
}

export interface OrderItemModifier {
  id: string;
  modifier_option_id: string;
  name: string;
  price: number;
}

export type OrderType = "dine_in" | "takeaway";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "voided";

export type OrderItemStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "cancelled";

export interface Payment {
  id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  reference_number?: string;
  processed_by?: User;
  processed_by_id?: string;
  processed_at: string;
  created_at: string;
}

export type PaymentMethod =
  | "cash"
  | "card"
  | "e_wallet";

export interface OrderFormData {
  order_type: OrderType;
  customer_id?: string;
  table_id?: string;
  items: OrderItemFormData[];
  notes?: string;
  auto_apply_promotions?: boolean;
}

export interface OrderItemFormData {
  menu_item_id: string;
  variant?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  modifiers?: { modifier_option_id: string; price: number }[];
}

export interface PaymentFormData {
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  statutory_discount_type?: StatutoryDiscountType;
  statutory_discount_reference?: string;
  statutory_discount_name?: string;
  qualified_amount?: number;
}

export interface RefundFormData {
  payment_id: string;
  amount: number;
  reason: string;
}
