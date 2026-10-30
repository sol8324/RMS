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

export type BookingScope = "standard" | "half_day" | "whole_day";

export type ReservationRequestCategory =
  | "seating"
  | "accessibility"
  | "dietary"
  | "occasion"
  | "other";

export type ReservationRequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ReservationRequest {
  id?: string;
  category: ReservationRequestCategory;
  label: string;
  value?: string | null;
  details?: string | null;
  status?: ReservationRequestStatus;
  priority?: "normal" | "high";
  is_matched?: boolean | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReservationAssignment {
  matched_requests: ReservationRequest[];
  unmet_requests: ReservationRequest[];
  score: number | null;
  buffer_minutes: number | null;
}

export interface TableOccupancy {
  id: string;
  number: string;
  capacity: number;
  status: string;
  has_reservation: boolean;
  reservations: Array<{
    id?: string;
    guest_name?: string | null;
    party_size?: number;
    reservation_time: string;
    end_time?: string;
    duration_minutes?: number;
    status: string;
    event_type?: EventType | null;
    booking_scope?: BookingScope;
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
  reservation_turnover_buffer_minutes?: number;
  weekend_days: number[];
}

export interface AvailabilityCheckResult {
  available: boolean;
  table: {
    id: string;
    number: string;
    capacity: number;
    shape?: string;
    location?: string | null;
    location_description?: string | null;
    is_wheelchair_accessible?: boolean;
  } | null;
  assignment?: ReservationAssignment | null;
  duration_minutes: number;
  end_time: string;
  requires_card: boolean;
  requires_deposit: boolean;
  deposit_amount: number;
  policy: {
    card_threshold: number;
    weekend_days: number[];
    turnover_buffer_minutes?: number;
  };
}

export interface TimeSlotTableOccupancy {
  table_id: string;
  table_number: string;
  capacity: number;
  is_occupied: boolean;
  occupying_reservation: {
    id: string;
    guest_name: string;
    party_size: number;
    reservation_time: string;
    duration_minutes: number;
    status: string;
  } | null;
}

export interface TimeSlot {
  time: string;
  display_time: string;
  end_time: string;
  is_available: boolean;
  table_occupancy: TimeSlotTableOccupancy[];
}

export interface TimeSlotsResult {
  date: string;
  party_size: number;
  duration_minutes: number;
  time_slots: TimeSlot[];
}

export interface Reservation {
  id: string;
  customer_id?: string;
  customer?: (Customer & { customer_type?: string }) | null;
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
  requests?: ReservationRequest[];
  requests_count?: number;
  unmet_requests_count?: number;
  assignment?: ReservationAssignment | null;
  event_type?: EventType | null;
  booking_scope?: BookingScope;
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
  reservation_time?: string;
  end_time?: string;
  party_size: number;
  source?: string;
  special_requests?: string;
  requests?: ReservationRequest[];
  event_type?: EventType;
  booking_scope?: BookingScope;
  status?: ReservationStatus;
  card_on_file?: boolean;
  deposit_paid?: boolean;
}

