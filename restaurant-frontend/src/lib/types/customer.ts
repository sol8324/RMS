export type CustomerType = "registered" | "guest" | "walk_in";

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  dietary_restrictions?: string;
  customer_type: CustomerType;
  loyalty_points: number;
  total_orders: number;
  total_reservations?: number;
  total_spent: number;
  visit_count: number;
  notes?: string;
  is_active: boolean;
  loyalty_tier?: string;
  reservations?: CustomerReservation[];
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  dietary_restrictions?: string;
  customer_type: CustomerType;
  loyalty_points: number;
  total_orders: number;
  total_reservations?: number;
  total_spent: number;
  visit_count: number;
  notes?: string;
  is_active: boolean;
  loyalty_tier?: string;
  reservations?: CustomerReservation[];
  created_at: string;
  updated_at: string;
}

// Operational customer view (without CRM fields)
export interface CustomerOperationalView {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  total_orders: number;
  total_reservations?: number;
  created_at: string;
}

export interface CustomerReservation {
  id: string;
  reservation_number: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: string;
  table?: {
    id: string;
    number: string;
  } | null;
}

export interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}
