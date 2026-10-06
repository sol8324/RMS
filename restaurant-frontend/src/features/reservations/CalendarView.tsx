"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Table as TableIcon, Circle, AlertCircle } from "lucide-react";
import type { Reservation, TableOccupancy, TableOccupancyByDate } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  seated: "bg-purple-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
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
      dayHeight: "h-[36px] sm:h-[38px] lg:min-h-[60px] lg:h-[60px]",
      dayNumberSize: "h-5 w-5 text-xs",
      fontSize: "text-xs",
      iconSize: "h-2.5 w-2.5",
      badgeSize: "text-[9px]",
      headerGap: "gap-1",
      cellPadding: "p-1",
    },
    default: {
      dayHeight: "h-[46px] sm:h-[48px] lg:min-h-[84px] lg:h-[84px]",
      dayNumberSize: "h-6 w-6 text-sm",
      fontSize: "text-sm",
      iconSize: "h-3 w-3",
      badgeSize: "text-[11px]",
      headerGap: "gap-1.5",
      cellPadding: "p-2",
    },
    large: {
      dayHeight: "h-[56px] sm:h-[58px] lg:min-h-[100px] lg:h-[100px]",
      dayNumberSize: "h-7 w-7 text-base",
      fontSize: "text-base",
      iconSize: "h-3.5 w-3.5",
      badgeSize: "text-[12px]",
      headerGap: "gap-2",
      cellPadding: "p-2.5",
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
    ? tableOccupancy[selectedDateKey] ?? []
    : [];

  // Check if selected date has events
  const hasEvent = selectedDateKey
    ? (reservationsByDate[selectedDateKey]?.some((r) => r.event_type) ?? false)
    : false;
  
  // Get event names for selected date
  const eventNames = selectedDateKey
    ? (reservationsByDate[selectedDateKey]?.filter((r) => r.event_type).map((r) => r.event_type) ?? [])
    : [];

  // Check if selected date is fully booked
  const isSelectedDateFull = selectedDateKey && tableOccupancy
    ? tableOccupancy[selectedDateKey]?.every((t) => t.has_reservation) ?? false
    : false;

  const modifiers = {
    hasReservations: (date: Date) => {
      const key = getDateKey(date);
      return (reservationsByDate[key]?.length ?? 0) > 0;
    },
    hasEvent: (date: Date) => {
      const key = getDateKey(date);
      return (reservationsByDate[key]?.some((r) => r.event_type) ?? false);
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

              // Get event names for this day
              const eventNames = reservationsByDate[key]?.filter((r) => r.event_type).map((r) => r.event_type) ?? [];

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
                  <div className="flex flex-col items-start gap-0.5 min-h-0 flex-1 overflow-hidden w-full">
                    {count > 0 && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium leading-none flex-shrink-0 w-auto truncate", s.badgeSize, isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20")}>
                        <CalendarClock className={cn("hidden sm:inline", s.iconSize)} />
                        <span className="hidden sm:inline">{count} {count === 1 ? "reservation" : "reservations"}</span>
                        <span className="sm:hidden">{count}</span>
                      </span>
                    )}
                    {isEventDay && eventNames.length > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-violet-600 dark:text-violet-400 flex-shrink-0 truncate" style={{ fontSize: s.badgeSize }}>
                        <CalendarDays className={cn(s.iconSize)} />
                        <span className="hidden sm:inline">Event: {eventNames.join(", ")}</span>
                        <span className="sm:hidden">Event</span>
                      </span>
                    )}
                    {isFull && !isEventDay && (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400 flex-shrink-0" style={{ fontSize: s.badgeSize }}>
                        <AlertCircle className={cn(s.iconSize)} />
                        <span className="hidden sm:inline">Full</span>
                      </span>
                    )}
                    {isLimited && !isFull && !isEventDay && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 flex-shrink-0" style={{ fontSize: s.badgeSize }}>
                        <AlertCircle className={cn(s.iconSize)} />
                        <span className="hidden sm:inline">Limited</span>
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
              {/* Full day notice */}
              {isSelectedDateFull && selectedDateTableOccupancy.length > 0 && (
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
              )}
              {/* Event day notice - all tables reserved for event */}
              {hasEvent && selectedDateTableOccupancy.length > 0 && (
                <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <div>
                      <p className="font-medium text-violet-800 dark:text-violet-200">Event Day — Full Venue Reserved</p>
                      <p className="text-sm text-violet-600 dark:text-violet-400">
                        All tables are reserved for event: {eventNames.join(", ")}. No individual table reservations available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {selectedDateTableOccupancy.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <TableIcon className="h-4 w-4" />
                    Table Occupancy
                  </h4>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {selectedDateTableOccupancy.map((table: TableOccupancy) => {
                      const isEventDay = hasEvent;
                      return (
                        <div
                          key={table.id}
                          className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "h-3 w-3 rounded-full flex-shrink-0",
                                isEventDay ? "bg-violet-500" : getTableStatusColor(table.status, table.has_reservation)
                              )}
                            />
                            <span className="text-sm font-medium">Table {table.number}</span>
                            <span className="text-xs text-muted-foreground">(cap: {table.capacity})</span>
                          </div>
<div className="flex-1 min-w-0">
                            {isEventDay ? (
                              <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                                Reserved for Event
                              </span>
                            ) : (
                              table.has_reservation && table.reservations.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {table.reservations.map((r: { reservation_time: string; status: string }, idx: number) => (
                                    <span
                                      key={idx}
                                      className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                                        getStatusColor(r.status)
                                      )}
                                    >
                                      {formatTime(r.reservation_time)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Available</span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
