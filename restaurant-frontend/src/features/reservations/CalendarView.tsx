"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Circle, AlertCircle, Clock } from "lucide-react";
import type { BookingScope, Reservation, TableOccupancy, TableOccupancyByDate } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sortTablesByNumber } from "@/lib/utils/tableSort";

interface CalendarViewProps {
  reservations: Reservation[];
  tableOccupancy?: TableOccupancyByDate;
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  /** Reports the visible month upward so the page can fetch its data. */
  onMonthChange?: (month: Date) => void;
  isLoading?: boolean;
  /** Calendar size: "compact" | "default" | "large" */
  size?: "compact" | "default" | "large";
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

function getTimeUntil(timeStr: string | undefined | null): string {
  if (!timeStr) return "";
  const now = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "Now";
  
  const hoursUntil = Math.floor(diffMs / (1000 * 60 * 60));
  const minutesUntil = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hoursUntil > 0) return `${hoursUntil}h ${minutesUntil}m`;
  return `${minutesUntil}m`;
}

const BOOKING_SCOPE_LABEL: Record<BookingScope, string> = {
  standard: "Standard",
  half_day: "Half-day",
  whole_day: "Whole-day",
};

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-500";
    case "confirmed":
      return "bg-blue-500";
    case "seated":
      return "bg-purple-500";
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function getTableStatusColor(status: string, hasReservation: boolean): string {
  if (hasReservation) return "bg-blue-500";
  switch (status) {
    case "available":
      return "bg-green-500";
    case "occupied":
      return "bg-red-500";
    case "reserved":
      return "bg-blue-500";
    case "needs_cleaning":
      return "bg-amber-500";
    case "maintenance":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
}

export function CalendarView({
  reservations,
  tableOccupancy,
  selectedDate,
  onDateSelect,
  onMonthChange,
  isLoading = false,
  size = "default",
}: CalendarViewProps) {
  // Size-based dimensions
  const sizeConfig = {
    compact: {
      dayHeight: "h-[34px] sm:h-[36px] lg:min-h-[56px] lg:h-[56px]",
      dayNumberSize: "h-4 w-4 text-[10px]",
      fontSize: "text-[10px]",
      iconSize: "h-2 w-2",
      badgeSize: "text-[8px]",
      headerGap: "gap-1",
      cellPadding: "p-0.5",
    },
    default: {
      dayHeight: "h-[42px] sm:h-[44px] lg:min-h-[76px] lg:h-[76px]",
      dayNumberSize: "h-5 w-5 text-xs",
      fontSize: "text-xs",
      iconSize: "h-2.5 w-2.5",
      badgeSize: "text-[9px]",
      headerGap: "gap-1",
      cellPadding: "p-1",
    },
    large: {
      dayHeight: "h-[52px] sm:h-[54px] lg:min-h-[92px] lg:h-[92px]",
      dayNumberSize: "h-6 w-6 text-sm",
      fontSize: "text-sm",
      iconSize: "h-3 w-3",
      badgeSize: "text-[10px]",
      headerGap: "gap-1.5",
      cellPadding: "p-1.5",
    },
  };

  const s = sizeConfig[size];
  const [currentMonth, setCurrentMonth] = useState(new Date());

  function handleMonthChange(month: Date) {
    setCurrentMonth(month);
    onMonthChange?.(month);
  }

  function handleToday() {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onMonthChange?.(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateSelect?.(today);
  }

  function goPrev() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    handleMonthChange(d);
  }

  function goNext() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    handleMonthChange(d);
  }

  const todayKey = useMemo(() => {
    return getDateKey(new Date());
  }, []);

  const reservationsByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of reservations) {
      const key = r.reservation_date;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [reservations]);

  const selectedDateKey = selectedDate ? getDateKey(selectedDate) : "";
  const selectedReservations = selectedDateKey
    ? reservationsByDate[selectedDateKey] ?? []
    : [];
  
  const selectedDateTableOccupancy = selectedDateKey && tableOccupancy
    ? sortTablesByNumber(tableOccupancy[selectedDateKey] ?? [])
    : [];

  const selectedEventReservations = selectedDateKey
    ? (reservationsByDate[selectedDateKey]?.filter(
        (r) => (r.event_type || (r.booking_scope && r.booking_scope !== "standard"))
          && r.status !== "cancelled"
      ) ?? [])
    : [];

  const hasEvent = selectedEventReservations.length > 0;

  const wholeDayEvents = selectedEventReservations.filter(
    (r) => r.booking_scope === "whole_day"
  );
  const hasWholeDayEvent = wholeDayEvents.length > 0;

  // Check if selected date is fully booked
  const isSelectedDateFull = selectedDateKey && tableOccupancy
    ? tableOccupancy[selectedDateKey]?.every((t) => t.has_reservation) ?? false
    : false;

  // Only call the whole venue reserved when a whole-day event exists and
  // every active table is actually occupied. A normal event does not block
  // the other tables in the restaurant.
  const isWholeVenueReserved = hasWholeDayEvent
    && selectedDateTableOccupancy.length > 0
    && selectedDateTableOccupancy.every((t) => t.has_reservation);

  const modifiers = {
    hasReservations: (date: Date) => {
      const key = getDateKey(date);
      return (reservationsByDate[key]?.length ?? 0) > 0;
    },
    hasEvent: (date: Date) => {
      const key = getDateKey(date);
      return (reservationsByDate[key]?.some(
        (r) => (r.event_type || (r.booking_scope && r.booking_scope !== "standard"))
          && r.status !== "cancelled"
      ) ?? false);
    },
    isFullDay: (date: Date) => {
      const key = getDateKey(date);
      const dayOccupancy = tableOccupancy?.[key];
      if (!dayOccupancy || dayOccupancy.length === 0) return false;
      return dayOccupancy.every((t) => t.has_reservation);
    },
    hasLimitedAvailability: (date: Date) => {
      const key = getDateKey(date);
      const dayOccupancy = tableOccupancy?.[key];
      if (!dayOccupancy || dayOccupancy.length === 0) return false;
      const availableCount = dayOccupancy.filter((t) => !t.has_reservation).length;
      const totalCount = dayOccupancy.length;
      return availableCount > 0 && availableCount < totalCount;
    },
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.65fr_0.95fr] items-start">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Reservation Calendar</CardTitle>
          <p className="text-xs text-muted-foreground">Select a date to view its reservations</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b pb-3">
            <h3 className="text-lg font-semibold tracking-tight">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 rounded-lg border px-3 text-xs font-medium" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border" onClick={goPrev} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border" onClick={goNext} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          modifiers={modifiers}
          className="w-full"
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full",
            month_caption: "hidden",
            nav: "hidden",
            month_grid: "w-full",
            weekdays: "grid grid-cols-7 gap-1 w-full border-b pb-2 mb-1",
            weekday: "text-center text-xs font-medium text-muted-foreground uppercase tracking-wide py-1",
            week: "grid grid-cols-7 gap-1 w-full",
            day: "relative p-0.5 min-h-0",
          }}
          components={{
            DayButton: ({ day, modifiers, ...props }) => {
              const key = getDateKey(day.date);
              const count = reservationsByDate[key]?.length ?? 0;
              const isToday = getDateKey(day.date) === todayKey;
              const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
              const isOutside = modifiers.outside;
              const isSelected = modifiers.selected;
              const isFullDay = modifiers.isFullDay;
              const hasLimitedAvailability = modifiers.hasLimitedAvailability;
              const hasEvent = modifiers.hasEvent;

              // Determine day color based on availability and events
              // Priority: Event > Full > Limited > Available
              const isEventDay = !isOutside && hasEvent;
              const isFull = !isOutside && isFullDay && !hasEvent;
              const isLimited = !isOutside && hasLimitedAvailability && !hasEvent && !isFullDay;
              const isAvailable = !isOutside && !isFullDay && !hasLimitedAvailability && !hasEvent;

              const dayEvents = reservationsByDate[key]?.filter(
                (r) => (r.event_type || (r.booking_scope && r.booking_scope !== "standard"))
                  && r.status !== "cancelled"
              ) ?? [];
              const firstEventGuest = dayEvents[0]?.customer?.name
                ?? dayEvents[0]?.guest_name
                ?? dayEvents[0]?.event_type;

return (
                <button
                  {...props}
                  className={cn(
                    "relative flex flex-col items-start justify-start w-full h-full rounded-lg border transition-colors overflow-hidden",
                    s.dayHeight,
                    s.cellPadding,
                    s.fontSize,
                    isOutside
                      ? "text-muted-foreground/40 bg-muted/10 border-transparent"
                      : "border-transparent",
                    !isOutside && !isSelected && isWeekend && "bg-muted/10",
                    !isSelected && !isOutside && "hover:bg-muted/40 hover:border-border",
                    isSelected && "bg-primary/10 border-primary/30 ring-1 ring-primary/20",
                    isOutside && isSelected && "bg-primary/10 border-primary/30",
                    // Color coding: Event (purple) > Full (red) > Limited (amber) > Available (green)
                    isEventDay && "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
                    isFull && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                    isLimited && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                    isAvailable && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full font-medium leading-none flex-shrink-0",
                      s.dayNumberSize,
                      isToday && !isSelected && "bg-primary text-primary-foreground",
                      isToday && isSelected && "bg-primary text-primary-foreground",
                      isSelected && !isToday && "font-semibold",
                      isEventDay && "bg-violet-500 text-white",
                      isFull && "bg-red-500 text-white",
                      isLimited && "bg-amber-500 text-white",
                      isAvailable && "bg-green-500 text-white"
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  <div className="flex flex-col items-start gap-0.5 min-h-0 flex-1 overflow-hidden w-full pt-0.5">
                    {count > 0 && (
                      <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1 py-0.5 font-medium leading-none flex-shrink-0 w-auto truncate", s.badgeSize, isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20")}>
                        <CalendarClock className={cn("hidden sm:inline", s.iconSize)} />
                        <span className="hidden sm:inline">{count}</span>
                        <span className="sm:hidden">{count}</span>
                      </span>
                    )}
                    {isEventDay && firstEventGuest && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-violet-600 dark:text-violet-400 flex-shrink-0 truncate max-w-full" style={{ fontSize: s.badgeSize }}>
                        <CalendarDays className={cn("shrink-0", s.iconSize)} />
                        <span className="truncate">{firstEventGuest}</span>
                        {dayEvents.length > 1 && (
                          <span className="shrink-0">+{dayEvents.length - 1}</span>
                        )}
                      </span>
                    )}
                    {isFull && !isEventDay && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-red-600 dark:text-red-400 flex-shrink-0" style={{ fontSize: s.badgeSize }}>
                        <AlertCircle className={cn(s.iconSize)} />
                        <span className="hidden sm:inline">Full</span>
                        <span className="sm:hidden">F</span>
                      </span>
                    )}
                    {isLimited && !isFull && !isEventDay && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400 flex-shrink-0" style={{ fontSize: s.badgeSize }}>
                        <AlertCircle className={cn(s.iconSize)} />
                        <span className="hidden sm:inline">Limited</span>
                        <span className="sm:hidden">L</span>
                      </span>
                    )}
                  </div>
                  </button>
                )
              },
          }}
        />
          <div className="flex flex-wrap items-center gap-4 pt-2 text-muted-foreground border-t" style={{ fontSize: s.badgeSize }}>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Has reservations</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full bg-violet-500 text-white flex items-center justify-center font-bold", s.dayNumberSize)}>📅</span> Event</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full bg-red-500 text-white flex items-center justify-center font-bold", s.dayNumberSize)}>3</span> Full</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full bg-amber-500 text-white flex items-center justify-center font-bold", s.dayNumberSize)}>3</span> Limited</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full bg-green-500 text-white flex items-center justify-center font-bold", s.dayNumberSize)}>3</span> Available</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold", s.dayNumberSize)}>3</span> Today</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center", s.dayNumberSize)}>3</span> Selected</span>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:h-full lg:flex lg:flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
          <CardTitle className="text-base font-semibold">
            {selectedDate
              ? selectedDate.toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Select a date"}
          </CardTitle>
          {isLoading ? (
            <Skeleton className="h-5 w-24 rounded-full" />
          ) : (
            selectedReservations.length > 0 && (
              <Badge variant="secondary" className="text-xs rounded-full">
                {selectedReservations.length} {selectedReservations.length === 1 ? "Reservation" : "Reservations"}
              </Badge>
            )
          )}
        </CardHeader>
        <CardContent className="flex-1 pt-4">
          {selectedDate ? (
            <>
              {selectedReservations.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Reservations</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedReservations
                      .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
                      .map((res) => (
                        <div
                          key={res.id}
                          className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex flex-col items-center shrink-0 text-center min-w-[56px]">
                            <span className="text-sm font-bold">{formatTime(res.reservation_time)}</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Users className="h-3 w-3" />
                              {res.party_size} guests
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{res.customer?.name ?? res.guest_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {res.table ? `Table ${res.table.number}` : "No table assigned"}
                            </p>
                          </div>
                          <Badge variant={res.status === "cancelled" ? "destructive" : res.status === "confirmed" ? "default" : "secondary"} className="shrink-0 rounded-full text-[11px] capitalize">
                            {res.status}
</Badge>
                        </div>
))}
                  </div>
                </div>
              )}
              {isWholeVenueReserved ? (
                <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <div>
                      <p className="font-medium text-violet-800 dark:text-violet-200">Whole-Day Event — Venue Reserved</p>
                      <p className="text-sm text-violet-600 dark:text-violet-400">
                        Every table is blocked by a whole-day event. Normal table bookings are unavailable for this date.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isSelectedDateFull ? (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">Day Fully Booked</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        All tables are occupied for this date. No reservations or walk-ins available.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {hasEvent && !isWholeVenueReserved && (
                <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg">
                  <p className="font-medium text-violet-800 dark:text-violet-200 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Events on this date
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedEventReservations.map((event) => (
                      <div key={event.id} className="text-sm text-violet-700 dark:text-violet-300">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">
                            {event.customer?.name ?? event.guest_name ?? "Guest"}
                          </span>
                          <span>{event.event_type ?? "Event"}</span>
                          <span>
                            {formatTime(event.reservation_time)}
                            {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
                          </span>
                          <span>{event.party_size} guests</span>
                          <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            {BOOKING_SCOPE_LABEL[event.booking_scope ?? "standard"]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
                    Other tables remain available unless listed as occupied below.
                  </p>
                </div>
              )}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedDateTableOccupancy.map((table: TableOccupancy) => {
                      const nextReservation = table.has_reservation && table.reservations.length > 0
                        ? table.reservations
                            .map((r) => ({
                              ...r,
                              timeObj: new Date(`2000-01-01T${r.reservation_time}`)
                            }))
                            .sort((a, b) => a.timeObj.getTime() - b.timeObj.getTime())
                            .find((r) => {
                              const now = new Date();
                              const resTime = new Date();
                              const [h, m] = r.reservation_time.split(":").map(Number);
                              resTime.setHours(h, m, 0, 0);
                              return resTime >= now;
                            })
                        : null;

                      return (
                        <div
                          key={table.id}
                          className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "h-3 w-3 rounded-full flex-shrink-0",
                                getTableStatusColor(table.status, table.has_reservation)
                              )}
                            />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium">Table {table.number}</span>
                              <span className="text-xs text-muted-foreground">Capacity: {table.capacity}</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {table.has_reservation && table.reservations.length > 0 ? (
                              <>
                                {table.reservations.map((r, idx) => {
                                  const timeUntil = getTimeUntil(r.reservation_time);
                                  const isNext = nextReservation && nextReservation.reservation_time === r.reservation_time;
                                  const scope = r.booking_scope ?? "standard";
                                  return (
                                    <div
                                      key={r.id ?? `${r.reservation_time}-${idx}`}
                                      className={cn(
                                        "flex items-start gap-2 px-2 py-1.5 rounded border transition-colors",
                                        isNext ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-muted"
                                      )}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0", getStatusColor(r.status))}>
                                            {formatTime(r.reservation_time)}
                                            {r.end_time ? ` – ${formatTime(r.end_time)}` : ""}
                                          </span>
                                          {scope !== "standard" && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                              <CalendarDays className="h-2.5 w-2.5" />
                                              {BOOKING_SCOPE_LABEL[scope]}
                                            </span>
                                          )}
                                          {timeUntil && (
                                            <span className={cn(
                                              "text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded",
                                              isNext ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            )}>
                                              {timeUntil}
                                            </span>
                                          )}
                                          {isNext && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                              <Clock className="h-2.5 w-2.5" />
                                              Next
                                            </span>
                                          )}
                                        </div>
                                        {(r.guest_name || r.party_size || r.event_type) && (
                                          <p className="mt-1 text-[11px] text-muted-foreground truncate">
                                            {r.guest_name ?? "Guest"}
                                            {r.party_size ? ` · ${r.party_size} guests` : ""}
                                            {r.event_type ? ` · ${r.event_type}` : ""}
                                          </p>
                                        )}
                                      </div>
                                      <span className={cn("text-[10px] font-medium capitalize shrink-0", getStatusColor(r.status))}>
                                        {r.status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                <Circle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                  Available
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
              {selectedReservations.length === 0 && selectedDateTableOccupancy.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border mb-4">
                    <CalendarDays className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No reservations or table data</p>
                   <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                    No reservations on this date and no table occupancy data available.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border mb-4">
                  <CalendarDays className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Select a date</p>
                <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                  Choose a date from the calendar to view reservations and table occupancy.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
