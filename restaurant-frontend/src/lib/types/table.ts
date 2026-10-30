export interface Table {
  id: string;
  name?: string;
  number: string;
  capacity: number;
  status: TableStatus;
  shape?: string;
  zone?: string;
  section?: string;
  location?: string | null;
  location_description?: string | null;
  is_wheelchair_accessible: boolean;
  is_active?: boolean;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  current_order_id?: string;
  floor_plan?: {
    id: string;
    name: string;
  } | null;
  // Present on /tables/order-eligible: the active seated reservation that
  // makes an occupied table bookable for its first dine-in order.
  seating?: {
    reservation_number: string;
    guest_name: string;
  } | null;
  next_reservation?: TableNextReservation | null;
  reservations_today?: number;
  created_at: string;
  updated_at: string;
}

export interface TableNextReservation {
  id: string;
  reservation_number?: string;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  end_time?: string;
  duration_minutes?: number | null;
  status: string;
  source?: string | null;
  special_requests?: string | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    customer_type?: string | null;
    notes?: string | null;
    dietary_restrictions?: string | null;
  } | null;
  requests?: import("./reservation").ReservationRequest[];
  requests_count: number;
  unmet_requests_count: number;
}

export interface TableScheduleSlot {
  date: string;
  time: string;
  display_time: string;
  is_available: boolean;
}

export interface TableSchedule {
  table: Table;
  date: string;
  days: number;
  buffer_minutes: number;
  current_session?: import("./reservation").Reservation | null;
  next_reservation: TableNextReservation | null;
  upcoming_reservations?: import("./reservation").Reservation[];
  reservations: import("./reservation").Reservation[];
  slots: TableScheduleSlot[];
}

export interface ReservationTable {
  id: string;
  number: string;
  capacity?: number;
  name?: string;
}

export type TableStatus =
  | "available"
  | "reserved"
  | "occupied"
  | "needs_cleaning"
  | "maintenance";

export interface TableFormData {
  number: string;
  capacity: number;
  shape?: string;
  location?: string | null;
  location_description?: string | null;
}
