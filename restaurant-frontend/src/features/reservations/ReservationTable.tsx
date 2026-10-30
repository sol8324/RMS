"use client";

import Link from "next/link";
import { CardGridSkeleton, EmptyState } from "@/components/shared";
import { StatusBadge } from "@/components/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  XCircle,
  CircleCheck,
  Users,
  Clock,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  MapPin,
  Phone,
  CalendarDays,
  MessageSquare,
} from "lucide-react";
import type { BookingScope, Reservation, ReservationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const BOOKING_SCOPE_LABEL: Record<BookingScope, string> = {
  standard: "Standard",
  half_day: "Half-day",
  whole_day: "Whole-day",
};

const STATUS_GLOW: Record<ReservationStatus, string> = {
  pending:
    "border-2 border-amber-400 shadow-lg shadow-amber-400/20 dark:border-amber-500 dark:shadow-amber-500/20",
  confirmed:
    "border-2 border-blue-400 shadow-lg shadow-blue-400/20 dark:border-blue-500 dark:shadow-blue-500/20",
  seated:
    "border-2 border-purple-400 shadow-lg shadow-purple-400/20 dark:border-purple-500 dark:shadow-purple-500/20",
  completed:
    "border-2 border-emerald-400 shadow-lg shadow-emerald-400/20 dark:border-emerald-500 dark:shadow-emerald-500/20",
  cancelled:
    "border-2 border-red-400 shadow-lg shadow-red-400/20 dark:border-red-500 dark:shadow-red-500/20",
  no_show:
    "border-2 border-gray-400 shadow-lg shadow-gray-400/20 dark:border-gray-500 dark:shadow-gray-500/20",
};

const STATUS_DOT: Record<ReservationStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  seated: "bg-purple-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
  no_show: "bg-gray-500",
};

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | undefined | null) {
  if (!timeStr) return "—";
  const parts = (timeStr || "").split(":");
  if (parts.length < 2) return "—";
  const hour = parseInt(parts[0] || "0", 10);
  if (isNaN(hour)) return "—";
  const minute = parts[1] || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${ampm}`;
}

interface ReservationTableProps {
  reservations: Reservation[];
  isLoading?: boolean;
  onView?: (reservation: Reservation) => void;
  onEdit?: (reservation: Reservation) => void;
  onCancel?: (reservation: Reservation) => void;
  onCheckIn?: (reservation: Reservation) => void;
  onComplete?: (reservation: Reservation) => void;
  onArchive?: (reservation: Reservation) => void;
  /** Backend reservation mutations are role:admin,manager only. */
  canManage?: boolean;
}

export function ReservationTable({
  reservations,
  isLoading,
  onView,
  onEdit,
  onCancel,
  onCheckIn,
  onComplete,
  onArchive,
  canManage = false,
}: ReservationTableProps) {
  if (isLoading) {
    return <CardGridSkeleton count={8} lines={3} />;
  }

  if (reservations.length === 0) {
    return (
      <EmptyState
        title="No reservations found"
        description="No reservations match your current search or filters."
        icon={<Clock className="h-8 w-8" />}
      />
    );
  }

  function showEdit(res: Reservation) {
    return canManage && onEdit && (res.status === "pending" || res.status === "confirmed");
  }

  function showCheckIn(res: Reservation) {
    return (
      canManage &&
      onCheckIn &&
      (res.status === "pending" || res.status === "confirmed")
    );
  }

  function showComplete(res: Reservation) {
    return canManage && onComplete && res.status === "seated";
  }

  function showCancel(res: Reservation) {
    return (
      canManage &&
      onCancel &&
      res.status !== "cancelled" &&
      res.status !== "completed" &&
      res.status !== "no_show"
    );
  }

  function showArchive(res: Reservation) {
    return (
      canManage &&
      onArchive &&
      (res.status === "completed" || res.status === "cancelled") &&
      !res.archived_at
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {reservations.map((res) => (
        <div
          key={res.id}
          role={onView ? "button" : undefined}
          tabIndex={onView ? 0 : undefined}
          onClick={onView ? () => onView(res) : undefined}
          onKeyDown={
            onView
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onView(res);
                  }
                }
              : undefined
          }
          className={cn(
            "relative flex flex-col rounded-xl border bg-card p-4 transition-all",
            onView && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
            STATUS_GLOW[res.status]
          )}
        >
          <div className="absolute -top-1.5 -right-1.5">
            <span className={cn("h-3 w-3 rounded-full", STATUS_DOT[res.status])} />
          </div>

          <div className="flex items-start justify-between gap-2">
            <div>
              {onView ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(res);
                  }}
                  className="font-semibold text-sm hover:underline text-left"
                >
                  {res.reservation_number}
                </button>
              ) : (
                <Link
                  href={`/reservations/${res.id}`}
                  className="font-semibold text-sm hover:underline"
                >
                  {res.reservation_number}
                </Link>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {res.customer?.name ?? res.guest_name ?? "—"}
              </p>
              {(res.customer?.phone || res.guest_phone) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {res.customer?.phone ?? res.guest_phone}
                </p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" onClick={(event) => event.stopPropagation()} />}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(res)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                {showEdit(res) && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(res)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {showCheckIn(res) && onCheckIn && (
                  <DropdownMenuItem
                    onClick={() => onCheckIn(res)}
                    className="text-blue-600"
                  >
                    <CircleCheck className="h-4 w-4 mr-2" />
                    Check In
                  </DropdownMenuItem>
                )}
                {showComplete(res) && onComplete && (
                  <DropdownMenuItem
                    onClick={() => onComplete(res)}
                    className="text-emerald-600"
                  >
                    <CircleCheck className="h-4 w-4 mr-2" />
                    Complete
                  </DropdownMenuItem>
                )}
                {showCancel(res) && onCancel && (
                  <DropdownMenuItem
                    onClick={() => onCancel(res)}
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                )}
                {showArchive(res) && onArchive && (
                  <DropdownMenuItem
                    onClick={() => onArchive(res)}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 space-y-2 text-sm flex-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {formatDate(res.reservation_date)} · {formatTime(res.reservation_time)}
                {res.end_time ? ` – ${formatTime(res.end_time)}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{res.party_size} guests</span>
            </div>
            {res.event_type && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{res.event_type}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{res.table ? res.table.number : "No table"}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-current/10 flex items-center gap-2">
            <StatusBadge status={res.status} className={res.archived_at ? "opacity-70" : undefined} />
            {res.booking_scope && res.booking_scope !== "standard" && (
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
                {BOOKING_SCOPE_LABEL[res.booking_scope]}
              </span>
            )}
            {(res.requests_count ?? res.requests?.length ?? 0) > 0 && (
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  (res.unmet_requests_count ?? 0) > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                )}
                title={
                  (res.unmet_requests_count ?? 0) > 0
                    ? `${res.unmet_requests_count} request(s) could not be matched`
                    : "All table requests matched"
                }
              >
                <MessageSquare className="h-3 w-3" />
                {res.requests_count ?? res.requests?.length}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}