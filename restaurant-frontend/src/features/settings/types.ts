/**
 * Canonical opening-hours shape used across the UI.
 */
export interface OpeningHourRow {
  day: string; // "monday" .. "sunday"
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  is_closed: boolean;
}

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Backend storage shape: { monday: { open, close }, ... } */
export type RawOpeningHours = Record<string, { open?: string; close?: string }> | null;

function normalizeHours(raw: RawOpeningHours): OpeningHourRow[] {
  return WEEK_DAYS.map((day) => {
    const entry = raw?.[day];
    const closed =
      !entry || (!entry.open && !entry.close) || entry.open === "" ? true : false;
    return {
      day,
      open: entry?.open ?? "09:00",
      close: entry?.close ?? "22:00",
      is_closed: closed,
    };
  });
}

/**
 * Flat settings contract — matches the backend's flat JSON payload.
 */
export interface RestaurantSettings {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  currency?: string;
  currency_symbol?: string;
  default_tax_rate: number;
  vat_enabled: boolean;
  vat_registered: boolean;
  vat_inclusive: boolean;
  default_service_charge: number;
  service_charge_enabled: boolean;
  allow_negative_inventory: boolean;
  reservation_turnover_buffer_minutes: number;
  order_prefix?: string;
  receipt_header?: string;
  receipt_footer?: string;
  opening_hours: OpeningHourRow[];
  updated_at?: string;
  /** Payment method availability flags */
  payment_cash_enabled: boolean;
  payment_card_enabled: boolean;
  payment_e_wallet_enabled: boolean;
  payment_e_bank_enabled: boolean;
}

export function normalizeSettings(raw: unknown): RestaurantSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    name: typeof r.name === "string" ? r.name : "",
    description: typeof r.description === "string" ? r.description : undefined,
    address: typeof r.address === "string" ? r.address : "",
    phone: typeof r.phone === "string" ? r.phone : "",
    email: typeof r.email === "string" ? r.email : "",
    timezone: typeof r.timezone === "string" ? r.timezone : "Asia/Manila",
    currency: typeof r.currency === "string" ? r.currency : "PHP",
    currency_symbol: typeof r.currency_symbol === "string" ? r.currency_symbol : "₱",
    default_tax_rate:
      typeof r.default_tax_rate === "number"
        ? r.default_tax_rate
        : Number(r.default_tax_rate ?? 0),
    default_service_charge:
      typeof r.default_service_charge === "number"
        ? r.default_service_charge
        : Number(r.default_service_charge ?? 0),
    service_charge_enabled: Boolean(r.service_charge_enabled),
    vat_enabled: Boolean(r.vat_enabled),
    vat_registered: Boolean(r.vat_registered),
    vat_inclusive: Boolean(r.vat_inclusive),
    allow_negative_inventory: Boolean(r.allow_negative_inventory),
    reservation_turnover_buffer_minutes:
      typeof r.reservation_turnover_buffer_minutes === "number"
        ? r.reservation_turnover_buffer_minutes
        : Number(r.reservation_turnover_buffer_minutes ?? 15),
    order_prefix: typeof r.order_prefix === "string" ? r.order_prefix : undefined,
    receipt_header: typeof r.receipt_header === "string" ? r.receipt_header : undefined,
    receipt_footer: typeof r.receipt_footer === "string" ? r.receipt_footer : undefined,
    opening_hours: normalizeHours((r.opening_hours as RawOpeningHours) ?? null),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : undefined,
    /** Payment method availability flags (default to true for backward compatibility) */
    payment_cash_enabled: r.payment_cash_enabled !== false,
    payment_card_enabled: r.payment_card_enabled !== false,
    payment_e_wallet_enabled: r.payment_e_wallet_enabled !== false,
    payment_e_bank_enabled: r.payment_e_bank_enabled !== false,
  };
}

export interface RestaurantInfoFormData {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  opening_hours: RawOpeningHours;
}

export interface SystemPreferencesFormData {
  currency: string;
  currency_symbol: string;
  vat_enabled: boolean;
  vat_registered: boolean;
  vat_inclusive: boolean;
  default_tax_rate: number;
  default_service_charge: number;
  service_charge_enabled: boolean;
  reservation_turnover_buffer_minutes: number;
  order_prefix: string;
  receipt_header: string;
  receipt_footer: string;
  /** Payment method availability flags */
  payment_cash_enabled: boolean;
  payment_card_enabled: boolean;
  payment_e_wallet_enabled: boolean;
  payment_e_bank_enabled: boolean;
}
