export interface Table {
  id: string;
  name?: string;
  number: string;
  capacity: number;
  status: TableStatus;
  shape?: string;
  zone?: string;
  section?: string;
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
  created_at: string;
  updated_at: string;
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
}
