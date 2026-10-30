import type { Order, Table } from "@/lib/types";

/**
 * Resolve a human-readable customer label for an order. Never returns the raw
 * UUID — falls back to "Walk-in / Guest" when no named customer is attached.
 */
export function customerDisplayName(order?: Order | null): string {
  if (!order) return "Walk-in / Guest";
  const name = order.customer?.name ?? order.customer_name;
  return name && String(name).trim() ? String(name).trim() : "Walk-in / Guest";
}

/**
 * Resolve a human-readable table label for an order. Returns "" when the order
 * has no table (e.g. takeaway). Never returns the raw table UUID.
 */
export function tableDisplayName(order?: Order | null): string {
  if (!order) return "";
  const num = order.table?.number ?? order.table_number;
  return num != null && String(num).trim() !== "" ? `Table ${num}` : "";
}

/**
 * Format a table object for display. Never returns the raw UUID.
 * Falls back to "No Table" if table is missing or has no number.
 */
function isInvalidTableNumber(num: unknown): boolean {
  if (num == null) return true;
  const str = String(num).trim();
  if (str === "") return true;
  // Reject UUID-like patterns or all-zero sequences (e.g., 00000000-00)
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(str)) return true;
  if (/^0+(-0+)*$/.test(str)) return true;
  const hexOnly = str.replace(/-/g, "");
  if (/^[0-9a-f]+$/i.test(str) && hexOnly.length >= 8 && /^0+$/i.test(hexOnly)) return true;
  return false;
}

export function formatTableDisplay(table?: Table | null | { number?: string | number; name?: string } | undefined, fallbackNumber?: string | number | null): string {
  if (!table) {
    if (fallbackNumber != null && !isInvalidTableNumber(fallbackNumber)) {
      return `Table ${fallbackNumber}`;
    }
    return "No Table";
  }
  const num = table.number;
  if (isInvalidTableNumber(num)) {
    if (fallbackNumber != null && !isInvalidTableNumber(fallbackNumber)) {
      return `Table ${fallbackNumber}`;
    }
    return "No Table";
  }
  const numStr = String(num).trim();
  const name = table.name;
  return name && String(name).trim() !== "" ? `${numStr} · ${name}` : `Table ${numStr}`;
}

/**
 * Get table display from table ID by looking up in a tables array.
 * Returns formatted display or "No Table" if not found.
 */
export function getTableDisplay(tables: Table[] | undefined, tableId?: string | null): string {
  if (!tableId || !tables?.length) return "No Table";
  const table = tables.find(t => t.id === tableId);
  return table ? formatTableDisplay(table) : "No Table";
}

export type TableSelectOption = {
  value: string;
  label: string;
};

/**
 * Build options for Base UI Select. The raw table UUID stays as the option
 * value (the API identifier) while the label is always human-readable.
 */
export function tableSelectOptions(tables: Table[]): TableSelectOption[] {
  return tables.map((table) => ({
    value: table.id,
    label: `${formatTableDisplay(table)} (${table.capacity} seats)`,
  }));
}
