import { Customer } from "./customer";
import type { ReservationTable } from "./table";

export type EventType =
  | "Birthday"
  | "Anniversary"
  | "Corporate"
  | "Wedding"
  | "Holiday Party"
  | "Graduation"
  | "Baby Shower"
  | "Bridal Shower"
  | "Rehearsal Dinner"
  | "Other";

export interface TableOccupancy {
  id: string;
  number: string;
  capacity: number;
  status: string;
  has_reservation: boolean;
  reservations: Array<{
    reservation_time: string;
    status: string;
  }>;
}

export interface TableOccupancyByDate {
  [date: string]: TableOccupancy[];
}

export interface ReservationPolicy {
  card_threshold: number;
  no_show_fee: number;
  flag_threshold: number;
  deposit_percentage: number;
  cancellation_window_minutes: number;
  regular_duration_minutes: number;
  large_duration_minutes: number;
  weekend_days: number[];
}

export interface AvailabilityCheckResult {
  available: boolean;
  table: {
    id: string;
    number: string;
    capacity: number;
  } | null;
  duration_minutes: number;
  end_time: string;
  requires_card: boolean;
  requires_deposit: boolean;
  deposit_amount: number;
  policy: {
    card_threshold: number;
    weekend_days: number[];
  };
}

export interface Reservation {
  id: string;
  customer_id?: string;
  customer?: Customer | null;
  table_id?: string;
  table?: ReservationTable | null;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  source?: string;
  reservation_number: string;
  reservation_date: string;
  reservation_time: string;
  end_time?: string;
  duration_minutes?: number;
  party_size: number;
  reserved_party_size?: number;
  actual_party_size?: number;
  status: ReservationStatus;
  special_requests?: string;
  event_type?: EventType | null;
  card_required?: boolean;
  deposit_required?: boolean;
  deposit_amount?: number;
  deposit_paid?: boolean;
  card_on_file?: boolean;
  cancellation_reason?: string;
  no_show_counter?: number;
  partial_show_counter?: number;
  guest_flag_level?: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export interface ReservationFormData {
  customer_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  table_id?: string;
  reservation_date: string;
  reservation_time: string;
  end_time?: string;
  party_size: number;
  source?: string;
  special_requests?: string;
  event_type?: EventType;
  status?: ReservationStatus;
  card_on_file?: boolean;
  deposit_paid?: boolean;
}

