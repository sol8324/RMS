"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared";
import {
  Pencil,
  User,
  Calendar,
  Clock,
  Users,
  MapPin,
  MessageSquare,
  CircleCheck,
  XCircle,
  ChevronRight,
  Phone,
  CalendarDays,
} from "lucide-react";
import type { BookingScope, Reservation } from "@/lib/types";

const BOOKING_SCOPE_LABEL: Record<BookingScope, string> = {
  standard: "Standard reservation",
  half_day: "Half-day event",
  whole_day: "Whole-day event",
};

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
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

export function ReservationDetail({
  reservation,
  onEdit,
  onCancel,
  onCheckIn,
  onComplete,
}: {
  reservation: Reservation;
  onEdit?: () => void;
  onCancel?: () => void;
  onCheckIn?: () => void;
  onComplete?: () => void;
}) {
  const canEdit = reservation.status === "pending" || reservation.status === "confirmed";
  const canCancel =
    reservation.status !== "cancelled" &&
    reservation.status !== "completed" &&
    reservation.status !== "no_show";
  const canCheckIn =
    reservation.status === "pending" || reservation.status === "confirmed";
  const canComplete = reservation.status === "seated";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{reservation.reservation_number}</h2>
            <StatusBadge
              status={reservation.status}
              className={`text-[10px] px-1.5 py-0${reservation.archived_at ? " opacity-70" : ""}`}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Created {formatDate(reservation.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            onEdit ? (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            ) : (
              <Button variant="outline" size="sm" render={<Link href={`/reservations/${reservation.id}/edit`} />}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            )
          )}
          {canCheckIn && onCheckIn && (
            <Button variant="default" size="sm" onClick={onCheckIn}>
              <CircleCheck className="h-4 w-4 mr-1.5" />
              Check In
            </Button>
          )}
          {canComplete && onComplete && (
            <Button variant="default" size="sm" onClick={onComplete}>
              <ChevronRight className="h-4 w-4 mr-1.5" />
              Complete
            </Button>
          )}
          {canCancel && onCancel && (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-1.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Reservation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium">{reservation.customer?.name ?? reservation.guest_name}</p>
                  <p className="text-xs text-muted-foreground">{(reservation.customer_id || reservation.customer?.customer_type === 'registered') ? 'Regular Customer' : 'Guest'}</p>
                  {reservation.customer?.phone && (
                    <p className="text-xs text-muted-foreground">{reservation.customer.phone}</p>
                  )}
                  {reservation.guest_phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {reservation.guest_phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Party Size</p>
                  <p className="text-sm font-medium">{reservation.party_size} guests</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(reservation.reservation_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium">
                    {formatTime(reservation.reservation_time)}
                    {reservation.end_time ? ` – ${formatTime(reservation.end_time)}` : ""}
                  </p>
                </div>
              </div>

              {reservation.event_type && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Event Type</p>
                    <p className="text-sm font-medium">{reservation.event_type}</p>
                  </div>
                </div>
              )}

              {reservation.booking_scope && reservation.booking_scope !== "standard" && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
                    <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Booking Type</p>
                    <p className="text-sm font-medium">{BOOKING_SCOPE_LABEL[reservation.booking_scope]}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Table</p>
                  <p className="text-sm font-medium">
                    {reservation.table ? `${reservation.table.number}${reservation.table.name ? ` · ${reservation.table.name}` : ""}` : "Not assigned"}
                  </p>
                </div>
              </div>
            </div>

            {reservation.special_requests && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                    <p className="text-sm">{reservation.special_requests}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {reservation.cancellation_reason && (
            <Card>
              <CardContent className="pt-1">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cancellation Reason</p>
                    <p className="text-sm">{reservation.cancellation_reason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

