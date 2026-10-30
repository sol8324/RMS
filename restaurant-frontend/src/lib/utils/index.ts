import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { safeNumber, safeString } from "./safe";

export * from "./safe";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(safeNumber(amount));
}

export function formatNumber(value: number | null | undefined) {
  return safeNumber(value).toLocaleString();
}

export function formatPercentage(value: number | null | undefined) {
  return `${safeNumber(value).toFixed(1)}%`;
}

export function formatHours(value: number | null | undefined) {
  return `${safeNumber(value).toFixed(1)}h`;
}

export function formatLabel(value: string): string {
  return safeString(value).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export type CustomerClassification = "VIP" | "Regular" | "Guest" | "Unclassified";

export function customerClassification(
  customer?: { customer_type?: string | null } | null,
  hasProfile = Boolean(customer)
): CustomerClassification {
  if (!hasProfile) return "Guest";
  const type = customer?.customer_type?.toLowerCase();
  if (type === "vip") return "VIP";
  if (type === "regular" || type === "registered") return "Regular";
  if (type === "guest" || type === "walk_in") return "Guest";
  return "Guest";
}

// Format an ISO datetime as its calendar date without timezone shift:
// the backend stores date-only schedules as UTC midnights, and
// new Date(iso).toLocaleDateString() renders the previous day in
// negative-offset timezones.
export function formatCalendarDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString();
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatTime(date: string | Date | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
