"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Hash,
  LayoutGrid,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  RefreshCw,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared";
import api from "@/lib/api/client";
import { useTableActiveOrders, useTableSchedule } from "@/lib/hooks";
import {
  cn,
  customerClassification,
  formatCurrency,
  formatLabel,
  formatTime,
  timeAgo,
} from "@/lib/utils";
import type {
  ApiResponse,
  Order,
  Reservation,
  ReservationRequest,
  ReservationRequestStatus,
  TableNextReservation,
  Table as TableType,
} from "@/lib/types";

interface TableDetailsModalProps {
  table: TableType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewOrders?: boolean;
  canViewCustomerInfo?: boolean;
  canManageReservations?: boolean;
  canEditTable?: boolean;
  onViewReservation?: (reservation: Reservation) => void;
  onEditTable?: (table: TableType) => void;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
}

function formatReservationTime(value?: string | null): string {
  if (!value) return "—";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return formatTime(value);
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function formatReservationDay(dateKey?: string | null): string {
  if (!dateKey) return "Date not set";
  const today = toDateKey(new Date());
  if (dateKey === today) return "Today";
  if (dateKey === shiftDate(today, 1)) return "Tomorrow";
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface ReservationSummaryLike {
  guest_name?: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  customer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    customer_type?: string | null;
  } | null;
}

function reservationDisplayName(reservation: ReservationSummaryLike): string {
  return reservation.customer?.name ?? reservation.guest_name ?? "Guest";
}

function reservationPhone(reservation: ReservationSummaryLike): string | null {
  return reservation.guest_phone ?? reservation.customer?.phone ?? null;
}

function reservationEmail(reservation: ReservationSummaryLike): string | null {
  return reservation.guest_email ?? reservation.customer?.email ?? null;
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${
    remainingMinutes === 1 ? "" : "s"
  }`;
}

function timeUntilReservation(dateKey?: string | null, time?: string | null): string {
  if (!dateKey || !time) return "Time not available";
  const target = new Date(`${dateKey}T${time.length === 5 ? `${time}:00` : time}`);
  if (Number.isNaN(target.getTime())) return "Time not available";
  const difference = target.getTime() - Date.now();
  if (difference <= 0) {
    return `Overdue by ${formatDuration(Math.abs(difference))}`;
  }
  return `Arrives in ${formatDuration(difference)}`;
}

function reservationAcknowledgmentStatus(
  reservation: ReservationSummaryLike & { requests?: ReservationRequest[] | null }
): string {
  const statuses = (reservation.requests ?? []).map((request) => requestStatus(request));
  if (statuses.includes("in_progress")) return "In progress";
  if (statuses.includes("pending")) return "Awaiting acknowledgment";
  if (statuses.length === 0) return "No requests";
  return "Acknowledged";
}

function CustomerBadge({
  customer,
  hasProfile,
}: {
  customer?: { customer_type?: string | null } | null;
  hasProfile: boolean;
}) {
  const label = customerClassification(customer, hasProfile);

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        label === "VIP"
          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
          : label === "Regular"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
            : label === "Guest"
              ? "bg-muted text-muted-foreground"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
      )}
    >
      {label}
    </span>
  );
}

const REQUEST_STATUS_LABEL: Record<ReservationRequestStatus, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function requestStatus(request: ReservationRequest): ReservationRequestStatus {
  return (request.status ?? "pending") as ReservationRequestStatus;
}

function requestIsOpen(request: ReservationRequest): boolean {
  const status = requestStatus(request);
  return status !== "completed" && status !== "cancelled";
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function ContactDetails({
  reservation,
  canView,
}: {
  reservation: ReservationSummaryLike;
  canView: boolean;
}) {
  if (!canView) return null;
  const phone = reservationPhone(reservation);
  const email = reservationEmail(reservation);

  if (!phone && !email) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {phone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3" aria-hidden="true" />
          {phone}
        </span>
      )}
      {email && (
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3 w-3" aria-hidden="true" />
          {email}
        </span>
      )}
    </div>
  );
}

function CurrentCustomerCard({
  session,
  orderCustomer,
  canViewContact,
  onView,
}: {
  session: Reservation | null;
  orderCustomer?: Order["customer"];
  canViewContact: boolean;
  onView?: (reservation: Reservation) => void;
}) {
  if (!session && !orderCustomer) {
    return (
      <section className="rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Current customer</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          No active customer for this table.
        </p>
      </section>
    );
  }

  const name = session
    ? reservationDisplayName(session)
    : orderCustomer?.name ?? "Customer information unavailable";
  const customer = session?.customer ?? orderCustomer;
  const hasProfile = session
    ? Boolean(session.customer_id || session.customer)
    : Boolean(orderCustomer);
  const label = session ? "Current customer" : "Active order customer";

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{name}</p>
              {hasProfile && (
                <CustomerBadge customer={customer} hasProfile={hasProfile} />
              )}
              {session && (
                <StatusBadge status={session.status} className="text-[10px]" />
              )}
            </div>
            {session && (
              <p className="mt-1 text-xs text-muted-foreground">
                {session.party_size} guests ·{" "}
                {formatReservationDay(session.reservation_date)} at{" "}
                {formatReservationTime(session.reservation_time)}
              </p>
            )}
            {session && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reservation {session.reservation_number ?? session.id} · Time
                remaining:{" "}
                {timeUntilReservation(
                  session.reservation_date,
                  session.reservation_time
                )}
              </p>
            )}
            {session && <ContactDetails reservation={session} canView={canViewContact} />}
            {!session && orderCustomer && canViewContact && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {orderCustomer.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden="true" />
                    {orderCustomer.phone}
                  </span>
                )}
                {orderCustomer.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {orderCustomer.email}
                  </span>
                )}
              </div>
            )}
            {session?.special_requests && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Special requests:{" "}
                </span>
                {session.special_requests}
              </p>
            )}
            {session && canViewContact && (session.customer?.notes || session.customer?.dietary_restrictions) && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {session.customer?.notes && (
                  <p>
                    <span className="font-medium text-foreground">Notes: </span>
                    {session.customer.notes}
                  </p>
                )}
                {session.customer?.dietary_restrictions && (
                  <p>
                    <span className="font-medium text-foreground">
                      Dietary:{" "}
                    </span>
                    {session.customer.dietary_restrictions}
                  </p>
                )}
              </div>
            )}
            {!hasProfile && !session && (
              <p className="mt-1 text-xs text-muted-foreground">
                Customer information unavailable.
              </p>
            )}
          </div>
        </div>
        {session && onView && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onView(session)}
          >
            View reservation
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </section>
  );
}

function NextReservationCard({
  reservation,
  tableNumber,
  canViewContact,
  onView,
}: {
  reservation: TableNextReservation | null;
  tableNumber?: string | null;
  canViewContact: boolean;
  onView?: (reservation: Reservation) => void;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <CalendarCheck2
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">Next reservation</h3>
      </div>

      {!reservation ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No upcoming reservation for this table.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {reservationDisplayName(reservation)}
              </p>
              <CustomerBadge
                customer={reservation.customer}
                hasProfile={Boolean(reservation.customer)}
              />
              <StatusBadge status={reservation.status} className="text-[10px]" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reservation {reservation.reservation_number ?? reservation.id} ·{" "}
              {formatReservationDay(reservation.reservation_date)} at{" "}
              {formatReservationTime(reservation.reservation_time)}
              {reservation.end_time
                ? ` - ${formatReservationTime(reservation.end_time)}`
                : ""}{" "}
              · {reservation.party_size} guests
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assigned table: {tableNumber ? `Table ${tableNumber}` : "This table"}{" "}
              · {reservationAcknowledgmentStatus(reservation)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Time remaining:{" "}
              {timeUntilReservation(
                reservation.reservation_date,
                reservation.reservation_time
              )}
            </p>
            <ContactDetails
              reservation={reservation}
              canView={canViewContact}
            />
            {reservation.special_requests && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Special requests:{" "}
                </span>
                {reservation.special_requests}
              </p>
            )}
            {canViewContact && (reservation.customer?.notes || reservation.customer?.dietary_restrictions) && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {reservation.customer?.notes && (
                  <p>
                    <span className="font-medium text-foreground">Notes: </span>
                    {reservation.customer.notes}
                  </p>
                )}
                {reservation.customer?.dietary_restrictions && (
                  <p>
                    <span className="font-medium text-foreground">Dietary: </span>
                    {reservation.customer.dietary_restrictions}
                  </p>
                )}
              </div>
            )}
            {(reservation.requests_count > 0 ||
              reservation.unmet_requests_count > 0) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {reservation.requests_count} request
                {reservation.requests_count === 1 ? "" : "s"}
                {reservation.unmet_requests_count > 0
                  ? ` · ${reservation.unmet_requests_count} unmatched`
                  : ""}
              </p>
            )}
          </div>
          {onView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onView(reservation as Reservation)}
            >
              View reservation
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function UpcomingReservations({
  reservations,
  canViewContact,
  onView,
}: {
  reservations: Reservation[];
  canViewContact: boolean;
  onView?: (reservation: Reservation) => void;
}) {
  return (
    <section aria-labelledby="table-upcoming-heading">
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 id="table-upcoming-heading" className="text-sm font-semibold">
          Upcoming reservations
        </h3>
      </div>
      {reservations.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
          No other upcoming reservations for this table.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {reservations.map((reservation) => {
            const openRequests =
              reservation.requests?.filter(requestIsOpen).length ??
              reservation.requests_count ??
              0;

            return (
              <li key={reservation.id}>
                <button
                  type="button"
                  onClick={() => onView?.(reservation)}
                  className="flex w-full flex-col gap-1 p-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {reservationDisplayName(reservation)}
                      </span>
                      <CustomerBadge
                        customer={reservation.customer}
                        hasProfile={Boolean(reservation.customer_id || reservation.customer)}
                      />
                      <StatusBadge status={reservation.status} className="text-[10px]" />
                      {openRequests > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {openRequests} open request{openRequests === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Reservation {reservation.reservation_number ?? reservation.id} ·{" "}
                      {formatReservationDay(reservation.reservation_date)} at{" "}
                      {formatReservationTime(reservation.reservation_time)}
                      {reservation.end_time
                        ? ` - ${formatReservationTime(reservation.end_time)}`
                        : ""}{" "}
                      · {reservation.party_size} guests
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Time remaining:{" "}
                      {timeUntilReservation(
                        reservation.reservation_date,
                        reservation.reservation_time
                      )}
                    </p>
                    <ContactDetails
                      reservation={reservation}
                      canView={canViewContact}
                    />
                    {reservation.special_requests && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Special requests:{" "}
                        </span>
                        {reservation.special_requests}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-primary">
                    View reservation
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface RequestAlert {
  reservation: ReservationSummaryLike & {
    id: string;
    reservation_number?: string | null;
    reservation_date?: string | null;
    reservation_time?: string | null;
  };
  request: ReservationRequest;
  hasProfile: boolean;
}

function StaffAlerts({
  alerts,
  operationalAlerts = [],
  canManage,
  isPending,
  onUpdate,
}: {
  alerts: RequestAlert[];
  operationalAlerts?: string[];
  canManage: boolean;
  isPending: boolean;
  onUpdate: (
    reservationId: string,
    requestId: string,
    status: ReservationRequestStatus
  ) => void;
}) {
  return (
    <section aria-labelledby="table-alerts-heading" className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3
            id="table-alerts-heading"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <BellRing className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Staff alerts
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Operational notices and unresolved requests for this table.
          </p>
        </div>
        {(alerts.length > 0 || operationalAlerts.length > 0) && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {alerts.length + operationalAlerts.length} open
          </span>
        )}
      </div>

      {operationalAlerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {operationalAlerts.map((alert, index) => (
            <li
              key={`${alert}-${index}`}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
            >
              {alert}
            </li>
          ))}
        </ul>
      )}

      {alerts.length === 0 && operationalAlerts.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          No unresolved special requests.
        </p>
      ) : (
        <ul className="mt-3 divide-y rounded-lg border">
          {alerts.map(({ reservation, request, hasProfile }) => {
            const status = requestStatus(request);
            const completed = status === "completed";

            return (
              <li
                key={`${reservation.id}-${request.id ?? request.label}`}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">
                      {reservationDisplayName(reservation)}
                    </span>
                    <CustomerBadge customer={reservation.customer} hasProfile={hasProfile} />
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {formatLabel(request.category)}
                    </span>
                    {request.priority === "high" && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        High priority
                      </span>
                    )}
                    {request.is_matched === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        <CircleHelp className="h-3 w-3" aria-hidden="true" />
                        Unmatched
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{request.label}</p>
                  {(request.value || request.details) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[request.value, request.details].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {reservation.reservation_date && reservation.reservation_time && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatReservationDay(reservation.reservation_date)} at{" "}
                      {formatReservationTime(reservation.reservation_time)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      completed
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : status === "cancelled"
                          ? "bg-muted text-muted-foreground"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    )}
                  >
                    {REQUEST_STATUS_LABEL[status]}
                  </span>
                  {canManage && request.id && !completed && status !== "cancelled" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={isPending}
                      onClick={() =>
                        onUpdate(
                          reservation.id,
                          request.id as string,
                          status === "pending" ? "acknowledged" : "completed"
                        )
                      }
                    >
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {status === "pending" ? "Acknowledge" : "Complete"}
                    </Button>
                  )}
                  {!canManage && request.is_matched === true && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function OrderItems({ order }: { order: Order }) {
  return (
    <div className="divide-y">
      {order.items.map((item) => {
        const name = item.name ?? item.menu_item_name ?? "Item";
        const modifiers = item.modifiers?.map((modifier) => modifier.name).join(", ");

        return (
          <div
            key={item.id}
            className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                  {item.quantity}x
                </span>
                <span className="text-sm font-medium">{name}</span>
                <StatusBadge status={item.status} className="text-[10px]" />
              </div>
              {modifiers && (
                <p className="mt-1 text-xs text-muted-foreground">{modifiers}</p>
              )}
              {item.notes && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {item.notes}
                </p>
              )}
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-sm font-medium tabular-nums">
                {formatCurrency(item.total_amount)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(item.unit_price)} each
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  canViewOrders,
  canViewCustomerInfo,
}: {
  order: Order;
  canViewOrders: boolean;
  canViewCustomerInfo: boolean;
}) {
  const placedAt = order.placed_at ?? order.created_at;
  const hasCustomerProfile = Boolean(order.customer_id || order.customer);

  return (
    <article className="overflow-hidden rounded-xl border bg-background">
      <header className="flex flex-col gap-3 border-b bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Order {order.order_number}</p>
            <StatusBadge status={order.status} />
            {order.payment_status && (
              <StatusBadge status={order.payment_status} />
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatLabel(order.order_type)}</span>
            <span>Placed {formatTime(placedAt)}</span>
            <span>{timeAgo(placedAt)}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {hasCustomerProfile ? (
              <>
                <span className="font-medium">
                  {order.customer?.name ?? order.customer_name ?? "Guest"}
                </span>
                <CustomerBadge
                  customer={order.customer}
                  hasProfile={hasCustomerProfile}
                />
                {canViewCustomerInfo && order.customer?.phone && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" aria-hidden="true" />
                    {order.customer.phone}
                  </span>
                )}
                {canViewCustomerInfo && order.customer?.email && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {order.customer.email}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Customer information unavailable.
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reservation: Not linked · Guests: Not recorded for this order
          </p>
          {canViewCustomerInfo && hasCustomerProfile && order.customer?.notes && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Customer notes: </span>
              {order.customer.notes}
            </p>
          )}
          {canViewCustomerInfo && hasCustomerProfile && order.customer?.dietary_restrictions && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Dietary: </span>
              {order.customer.dietary_restrictions}
            </p>
          )}
        </div>
        {canViewOrders && (
          <Link
            href={`/orders/${order.id}`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "shrink-0",
            })}
          >
            View order
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>

      <div className="px-4">
        <OrderItems order={order} />
      </div>

      <div className="border-t bg-muted/10 px-4 py-3">
        <dl className="ml-auto max-w-xs space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-mono tabular-nums">{formatCurrency(order.subtotal)}</dd>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt>
                Discount
                {order.applied_discount?.name
                  ? ` (${order.applied_discount.name})`
                  : ""}
              </dt>
              <dd className="font-mono tabular-nums">
                -{formatCurrency(order.discount_amount)}
              </dd>
            </div>
          )}
          {order.service_charge > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Service charge</dt>
              <dd className="font-mono tabular-nums">
                {formatCurrency(order.service_charge)}
              </dd>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-mono tabular-nums">{formatCurrency(order.tax_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t pt-1.5 text-sm font-semibold">
            <dt>Total</dt>
            <dd className="font-mono tabular-nums">{formatCurrency(order.total_amount)}</dd>
          </div>
        </dl>
        {order.notes && (
          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Order notes: </span>
            {order.notes}
          </p>
        )}
      </div>
    </article>
  );
}

function OrdersSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading active orders"
      className="space-y-3"
    >
      {[0, 1].map((index) => (
        <div key={index} className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/30 p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-3 p-4">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableDetailsModal({
  table,
  open,
  onOpenChange,
  canViewOrders = true,
  canViewCustomerInfo = true,
  canManageReservations = false,
  canEditTable = false,
  onViewReservation,
  onEditTable,
}: TableDetailsModalProps) {
  const queryClient = useQueryClient();
  const [scheduleDate, setScheduleDate] = useState(() => toDateKey(new Date()));
  const scheduleQuery = useTableSchedule(table?.id, scheduleDate, open);
  const schedule = scheduleQuery.data;
  const currentSession = schedule?.current_session ?? null;
  const upcomingReservations = schedule?.upcoming_reservations ?? [];
  const nextReservation = schedule?.next_reservation ?? null;
  const laterUpcoming = upcomingReservations.filter(
    (reservation) => reservation.id !== nextReservation?.id
  );
  const dayReservations =
    schedule?.reservations.filter(
      (reservation) => reservation.reservation_date === scheduleDate
    ) ?? [];
  const daySlots =
    schedule?.slots.filter((slot) => slot.date === scheduleDate) ?? [];
  const ordersQuery = useTableActiveOrders(table?.id, open);
  const updateRequest = useMutation({
    mutationFn: ({
      reservationId,
      requestId,
      status,
    }: {
      reservationId: string;
      requestId: string;
      status: ReservationRequestStatus;
    }) =>
      api.patch<ApiResponse<ReservationRequest>>(
        `/reservations/${reservationId}/requests/${requestId}`,
        { status }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success("Request updated");
    },
    onError: () => toast.error("Failed to update request"),
  });
  const orders = [...(ordersQuery.data?.data?.data ?? [])].sort((a, b) => {
    const first = new Date(a.placed_at ?? a.created_at).getTime();
    const second = new Date(b.placed_at ?? b.created_at).getTime();
    return first - second;
  });
  const orderSignature = orders
    .map((order) => `${order.id}:${order.status}:${order.updated_at}`)
    .join("|");
  const previousOrderSignature = useRef<string | null>(null);

  useEffect(() => {
    if (
      previousOrderSignature.current !== null &&
      previousOrderSignature.current !== orderSignature
    ) {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    }
    previousOrderSignature.current = orderSignature;
  }, [orderSignature, queryClient]);
  const requestAlerts: RequestAlert[] = [
    ...(currentSession ? currentSession.requests ?? [] : []).map((request) => ({
      reservation: currentSession!,
      request,
      hasProfile: Boolean(currentSession!.customer_id || currentSession!.customer),
    })),
    ...upcomingReservations.flatMap((reservation) =>
      (reservation.requests ?? []).map((request) => ({
        reservation,
        request,
        hasProfile: Boolean(reservation.customer_id || reservation.customer),
      }))
    ),
  ].filter(({ request }) => requestIsOpen(request));

  const itemCount = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
    0
  );
  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );
  const oldestOrder = orders[0];
  const lastUpdated = ordersQuery.dataUpdatedAt
    ? formatTime(new Date(ordersQuery.dataUpdatedAt))
    : null;
  const hasStaleError = ordersQuery.isError && orders.length > 0;
  const isArchived = table?.is_active === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,720px)] w-[calc(100vw-16px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="mx-0 mt-0 mb-0 shrink-0 border-b bg-popover px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hash className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <DialogTitle className="text-xl">
                Table {table?.number ?? ""}
              </DialogTitle>
              <DialogDescription>
                {table?.floor_plan?.name ?? "Table details and active dining session"}
              </DialogDescription>
              {table && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isArchived ? (
                    <StatusBadge
                      status="inactive"
                      label="Archived"
                      title={`Underlying status: ${formatLabel(table.status)}`}
                    />
                  ) : (
                    <StatusBadge status={table.status} />
                  )}
                  {table.name && (
                    <span className="text-xs text-muted-foreground">{table.name}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
          {!table ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This table is no longer available.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoTile
                  label="Capacity"
                  value={`${table.capacity} seats`}
                  icon={Users}
                />
                <InfoTile
                  label="Shape"
                  value={table.shape ? formatLabel(table.shape) : "Not set"}
                  icon={LayoutGrid}
                />
                <InfoTile
                  label="Accessibility"
                  value={table.is_wheelchair_accessible ? "Accessible" : "Standard"}
                  icon={Accessibility}
                />
                <InfoTile
                  label="Location"
                  value={table.location || "Not set"}
                  icon={MapPin}
                />
                <InfoTile
                  label="Description"
                  value={table.location_description || "Not set"}
                  icon={MapPin}
                />
                <InfoTile
                  label="Floor plan"
                  value={table.floor_plan?.name ?? "Unassigned"}
                  icon={LayoutGrid}
                />
              </div>

              {canEditTable && onEditTable && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onEditTable(table);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit table
                  </Button>
                </div>
              )}

              <CurrentCustomerCard
                session={currentSession}
                orderCustomer={orders[0]?.customer}
                canViewContact={canViewCustomerInfo}
                onView={onViewReservation}
              />

              <NextReservationCard
                reservation={nextReservation}
                tableNumber={table?.number}
                canViewContact={canViewCustomerInfo}
                onView={onViewReservation}
              />

              <UpcomingReservations
                reservations={laterUpcoming}
                canViewContact={canViewCustomerInfo}
                onView={onViewReservation}
              />

              <section
                aria-labelledby="table-special-requests-heading"
                className="rounded-xl border p-4"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h3
                    id="table-special-requests-heading"
                    className="text-sm font-semibold"
                  >
                    Special requests
                  </h3>
                </div>
                {[
                  currentSession?.special_requests
                    ? {
                        name: reservationDisplayName(currentSession),
                        text: currentSession.special_requests,
                      }
                    : null,
                  nextReservation?.special_requests
                    ? {
                        name: reservationDisplayName(nextReservation),
                        text: nextReservation.special_requests,
                      }
                    : null,
                  ...upcomingReservations
                    .filter((reservation) => reservation.special_requests)
                    .map((reservation) => ({
                      name: reservationDisplayName(reservation),
                      text: reservation.special_requests as string,
                    })),
                ].filter(Boolean).length === 0 && requestAlerts.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No special requests.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {[
                      currentSession?.special_requests
                        ? {
                            name: reservationDisplayName(currentSession),
                            text: currentSession.special_requests,
                          }
                        : null,
                      nextReservation?.special_requests
                        ? {
                            name: reservationDisplayName(nextReservation),
                            text: nextReservation.special_requests,
                          }
                        : null,
                      ...upcomingReservations
                        .filter((reservation) => reservation.special_requests)
                        .map((reservation) => ({
                          name: reservationDisplayName(reservation),
                          text: reservation.special_requests as string,
                        })),
                    ]
                      .filter(Boolean)
                      .map((request, index) => (
                        <div
                          key={`${request?.name}-${index}`}
                          className="rounded-lg border bg-muted/20 p-3"
                        >
                          <p className="text-xs font-medium">
                            {request?.name}
                          </p>
                          <p className="mt-1 text-sm">{request?.text}</p>
                        </div>
                      ))}
                    {requestAlerts.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {requestAlerts.length} structured request
                        {requestAlerts.length === 1 ? "" : "s"} require staff
                        attention.
                      </p>
                    )}
                  </div>
                )}
              </section>

              <StaffAlerts
                alerts={requestAlerts}
                operationalAlerts={[
                  ...(table?.status === "needs_cleaning"
                    ? ["This table requires cleaning before the next booking."]
                    : []),
                  ...(currentSession &&
                  customerClassification(currentSession.customer, Boolean(currentSession.customer_id || currentSession.customer)) === "VIP"
                    ? [`VIP arrival: ${reservationDisplayName(currentSession)}`]
                    : []),
                  ...upcomingReservations
                    .filter(
                      (reservation) =>
                        customerClassification(
                          reservation.customer,
                          Boolean(reservation.customer_id || reservation.customer)
                        ) === "VIP"
                    )
                    .map(
                      (reservation) =>
                        `VIP arrival: ${reservationDisplayName(reservation)}`
                    ),
                  ...upcomingReservations
                    .filter((reservation) => {
                      if (!reservation.reservation_date || !reservation.reservation_time) {
                        return false;
                      }
                      const target = new Date(
                        `${reservation.reservation_date}T${
                          reservation.reservation_time.length === 5
                            ? `${reservation.reservation_time}:00`
                            : reservation.reservation_time
                        }`
                      );
                      return (
                        !Number.isNaN(target.getTime()) &&
                        // eslint-disable-next-line react-hooks/purity
                        target.getTime() < Date.now() &&
                        (reservation.status === "pending" ||
                          reservation.status === "confirmed")
                      );
                    })
                    .map(
                      (reservation) =>
                        `Overdue arrival: ${reservationDisplayName(reservation)}`
                    ),
                  ...(requestAlerts.length > 0
                    ? [`${requestAlerts.length} unacknowledged special request${requestAlerts.length === 1 ? "" : "s"}.`]
                    : []),
                  ...(upcomingReservations.length > 0
                    ? [`${upcomingReservations.length} upcoming reservation${upcomingReservations.length === 1 ? "" : "s"} for this table.`]
                    : []),
                ]}
                canManage={canManageReservations}
                isPending={updateRequest.isPending}
                onUpdate={(reservationId, requestId, status) =>
                  updateRequest.mutate({ reservationId, requestId, status })
                }
              />

              <section aria-labelledby="table-schedule-heading">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3
                      id="table-schedule-heading"
                      className="flex items-center gap-1.5 text-sm font-semibold"
                    >
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      Reservation schedule
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {schedule?.buffer_minutes
                        ? `${schedule.buffer_minutes}-minute turnover buffer included`
                        : "Availability for the selected day"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Previous day"
                      onClick={() => setScheduleDate((date) => shiftDate(date, -1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(`${scheduleDate}T12:00:00`).toLocaleDateString(
                        "en-PH",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Next day"
                      onClick={() => setScheduleDate((date) => shiftDate(date, 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {scheduleQuery.isLoading ? (
                  <div className="h-20 animate-pulse rounded-xl bg-muted" />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Availability
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {daySlots.map((slot) => (
                          <span
                            key={`${slot.date}-${slot.time}`}
                            title={`${slot.display_time} - ${
                              slot.is_available ? "available" : "reserved"
                            }`}
                            className={cn(
                              "rounded px-1.5 py-1 text-[10px] font-medium tabular-nums",
                              slot.is_available
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            )}
                          >
                            {slot.display_time.replace(":00", "")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {dayReservations.length === 0 ? (
                      <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                        No reservations for this table on the selected day.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayReservations.map((reservation) => (
                          <button
                            key={reservation.id}
                            type="button"
                            onClick={() => onViewReservation?.(reservation)}
                            className="flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {reservation.guest_name}
                                </span>
                                <StatusBadge status={reservation.status} />
                                {(reservation.unmet_requests_count ?? 0) > 0 && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                    {reservation.unmet_requests_count} unmet
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatTime(reservation.reservation_time)}
                                {reservation.end_time
                                  ? ` - ${formatTime(reservation.end_time)}`
                                  : ""}{" "}
                                | {reservation.party_size} guests
                              </p>
                            </div>
                            <span className="text-xs font-medium text-primary">
                              View reservation
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section aria-labelledby="table-orders-heading">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3
                      id="table-orders-heading"
                      className="text-sm font-semibold"
                    >
                      Active orders
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ordersQuery.isFetching && !ordersQuery.isLoading
                        ? "Refreshing..."
                        : lastUpdated
                          ? `Last updated ${lastUpdated}`
                          : "Auto-refreshes every 5 seconds"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                    </span>
                    Live updates
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Active orders" value={orders.length} icon={UtensilsCrossed} />
                  <Metric label="Items ordered" value={itemCount} icon={Hash} />
                  <Metric
                    label="Oldest order"
                    value={oldestOrder ? timeAgo(oldestOrder.placed_at ?? oldestOrder.created_at) : "N/A"}
                    icon={Clock}
                  />
                  <Metric
                    label="Current value"
                    value={formatCurrency(totalValue)}
                    icon={RefreshCw}
                  />
                </div>

                {hasStaleError && (
                  <div
                    role="status"
                    className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      Live updates are temporarily unavailable. Showing the last
                      successful data{lastUpdated ? ` from ${lastUpdated}` : ""}.
                    </p>
                  </div>
                )}

                {ordersQuery.isLoading ? (
                  <OrdersSkeleton />
                ) : ordersQuery.isError && orders.length === 0 ? (
                  <div
                    role="alert"
                    className="flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center"
                  >
                    <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium">
                      Could not load active orders
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Check the connection and try again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => ordersQuery.refetch()}
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          ordersQuery.isFetching && "animate-spin motion-reduce:animate-none"
                        )}
                        aria-hidden="true"
                      />
                      Try again
                    </Button>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center">
                    <UtensilsCrossed
                      className="mx-auto h-7 w-7 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-medium">
                      No active orders for this table.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      New orders will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        canViewOrders={canViewOrders}
                        canViewCustomerInfo={canViewCustomerInfo}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t bg-muted/20 px-4 py-2.5 sm:px-5">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
