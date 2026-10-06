"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useEffectEvent, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CreditCard, AlertCircle, Info, Calendar as CalendarIcon, Users, AlertTriangle, Bell, X, CheckCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/shared";
import { useReservations, useCheckAvailability, useReservationPolicy, useTimeSlots } from "@/lib/hooks";
import { useCustomers } from "@/lib/hooks";
import { useTables } from "@/lib/hooks";
import type {
  Reservation,
  ReservationFormData,
  Table,
  EventType,
  ReservationPolicy,
  AvailabilityCheckResult,
  TimeSlot,
  TimeSlotsResult,
} from "@/lib/types";

interface ReservationFormProps {
  initialData?: Reservation;
  onSubmit: (data: ReservationFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

interface FormErrors {
  customer_id?: string;
  guest_name?: string;
  guest_phone?: string;
  reservation_date?: string;
  reservation_time?: string;
  end_time?: string;
  party_size?: string;
  table_id?: string;
}

export function ReservationForm({
  initialData,
  onSubmit,
  isLoading,
  submitLabel = "Save Reservation",
}: ReservationFormProps) {
  const [formData, setFormData] = useState<ReservationFormData>({
    customer_id: initialData?.customer_id ?? initialData?.customer?.id ?? "",
    guest_name: initialData?.guest_name ?? "",
    guest_phone: initialData?.guest_phone ?? "",
    table_id: initialData?.table_id ?? "",
    reservation_date:
      initialData?.reservation_date ??
      new Date().toISOString().split("T")[0],
    reservation_time: initialData?.reservation_time ?? "18:00",
    end_time: initialData?.end_time ?? "",
    party_size: initialData?.party_size ?? 2,
    source: initialData?.source ?? "walk_in",
    special_requests: initialData?.special_requests ?? "",
    event_type: initialData?.event_type ?? undefined,
    status: initialData?.status,
  });
  const [reservationFor, setReservationFor] = useState<"registered" | "guest">(
    initialData?.customer_id || initialData?.customer ? "registered" : "guest"
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [partySizeInput, setPartySizeInput] = useState<string>(
    String(initialData?.party_size ?? 2)
  );
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  // Operationally unusable tables are never selectable, even if a cached
  // availability response still lists them. The backend enforces the same rule.
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  // Conflict UX: when a previously selected table drops out of the
  // assignable list (date/time/party change or availability refresh), the
  // selection is cleared and the user must explicitly reconfirm — another
  // table or No table — before submit. Never silently keep a stale UUID and
  // never imply auto-assignment (the backend has none).
  const [tableConflict, setTableConflict] = useState<string | null>(null);
  // Human label ("T1") of the last explicitly chosen table, for messages.
  const selectedTableLabelRef = useRef<string | null>(null);
  // Whether the user has explicitly touched the table Select. Untouched
  // initial selections (edit forms) are never flagged on first load.
  const tableTouchedRef = useRef(false);
  // Original slot, so edits that move date/time re-evaluate the initial
  // selection instead of silently keeping a now-blocked table.
  const initialSlotRef = useRef(
    `${initialData?.reservation_date ?? new Date().toISOString().split("T")[0]}|${initialData?.reservation_time ?? "18:00"}|${initialData?.party_size ?? 2}`
  );
  // Policy and availability checking
  const { data: policy } = useReservationPolicy();
  const checkAvailability = useCheckAvailability();
  
  // Fetch time slots for the selected date
  const { data: timeSlotsData } = useTimeSlots({
    reservation_date: formData.reservation_date,
    party_size: formData.party_size,
    exclude_reservation_id: initialData?.id,
  });

  // Minimum date is today
  const minDate = new Date().toISOString().split("T")[0];

  // Duration limit state
  const [showDurationLimitAlert, setShowDurationLimitAlert] = useState(false);
  const [showTimeLimitHitAlert, setShowTimeLimitHitAlert] = useState(false);
  const [timeLimitDetails, setTimeLimitDetails] = useState<{
    tableNumber: string;
    reservationNumber: string;
    guestName: string;
    elapsedMinutes: number;
    maxMinutes: number;
  } | null>(null);

  const { list: customersList } = useCustomers({ per_page: 300, is_active: true });
  const customers = customersList.data?.data?.data ?? [];
  const customersLoading = customersList.isLoading;
  const selectedCustomer = customers.find((c) => c.id === formData.customer_id) ?? (initialData?.customer as unknown as { id: string; name: string } | undefined);
  const customerDisplayLabel = formData.customer_id
    ? selectedCustomer
      ? (selectedCustomer as { name: string; phone?: string }).name + ((selectedCustomer as { phone?: string }).phone ? ` — ${(selectedCustomer as { phone?: string }).phone}` : "")
      : customersLoading ? "Loading..." : "Unavailable customer"
    : null;

  // Fetch all tables to show occupancy status
  const { list: allTablesList } = useTables();
  const allTables = allTablesList.data ?? [];

  const { availableTables: fetchAvailableTables } = useReservations({
    reservation_date: formData.reservation_date,
    reservation_time: formData.reservation_time,
    party_size: formData.party_size,
    exclude_reservation_id: initialData?.id,
  });
  const tablesReady = fetchAvailableTables.isSuccess;

  // Combine all tables with availability data to show occupancy
  const availableTableIds = useMemo(() => 
    new Set((fetchAvailableTables.data ?? []).map((t) => t.id)), 
    [fetchAvailableTables.data]
  );
  
  // Tables that fit the party size and are available
  const assignableTables = useMemo(() => 
    allTables
      .filter((t) => t.is_active !== false && t.status !== "needs_cleaning" && t.status !== "maintenance")
      .filter((t) => t.capacity >= formData.party_size)
      .map((t) => ({ ...t, isAvailable: availableTableIds.has(t.id) }))
      .sort((a, b) => a.capacity - b.capacity || Number(a.number) - Number(b.number)),
    [allTables, availableTableIds, formData.party_size]
  );

  // All tables with occupancy status for display
  const tablesWithOccupancy = useMemo(() => 
    allTables
      .filter((t) => t.is_active !== false)
      .map((t) => ({ 
        ...t, 
        isAvailable: availableTableIds.has(t.id),
        canFit: t.capacity >= formData.party_size,
        isExactMatch: formData.party_size > 0 && t.capacity === formData.party_size,
        occupancyStatus: availableTableIds.has(t.id) ? "available" : "occupied" 
      }))
      .sort((a, b) => Number(a.number) - Number(b.number)),
    [allTables, availableTableIds, formData.party_size]
  );

  // Helper function to calculate end time from start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return "";
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = new Date(2000, 0, 1, hours, minutes);
    startDate.setMinutes(startDate.getMinutes() + durationMinutes);
    return startDate.toTimeString().slice(0, 5);
  };

  // Helper to check if duration exceeds per-guest limit
  const checkDurationLimit = (startTime: string, endTime: string, partySize: number): { valid: boolean; maxMinutes: number; actualMinutes: number } => {
    if (!startTime || !endTime) return { valid: true, maxMinutes: 0, actualMinutes: 0 };
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMs = new Date(2000, 0, 1, sh, sm).getTime();
    const endMs = new Date(2000, 0, 1, eh, em).getTime();
    const actualMinutes = Math.round((endMs - startMs) / 60000);
    const maxMinutes = partySize * 90; // 1hr 30min per guest
    return { valid: actualMinutes <= maxMinutes, maxMinutes, actualMinutes };
  };

  useEffect(() => {
    if (formData.reservation_date && formData.reservation_time) {
      const timer = setTimeout(() => {
        setIsCheckingAvailability(true);
        if (fetchAvailableTables.isSuccess && fetchAvailableTables.data) {
          setAvailableTables(fetchAvailableTables.data);
        }
        setIsCheckingAvailability(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    formData.reservation_date,
    formData.reservation_time,
    formData.party_size,
    initialData?.id,
    fetchAvailableTables.data,
    fetchAvailableTables.isSuccess,
  ]);

  function tableDisplayLabel(id: string): string | null {
    const found = tablesWithOccupancy.find((t) => t.id === id) ?? (initialData?.table as unknown as Table | undefined);
    if (!found) return null;
    return `${(found as Table).number} — ${(found as Table).name ?? "Table"} (cap: ${(found as Table).capacity})`;
  }
  const selectedTableLabel = formData.table_id ? tableDisplayLabel(formData.table_id) ?? (customersLoading ? "Loading..." : "Unavailable table") : null;

  function handleTableChange(val: string | null) {
    const id = val ?? "";
    tableTouchedRef.current = true;
    setFormData((prev) => ({ ...prev, table_id: id }));
    if (id) {
      selectedTableLabelRef.current = tableDisplayLabel(id);
    } else {
      selectedTableLabelRef.current = null;
    }
    setTableConflict(null);
    setErrors((prev) => ({ ...prev, table_id: undefined }));
  }

  // Invalidate a previously selected table that is no longer assignable.
  const assignableIdsKey = assignableTables.map((t) => t.id).join(",");
  const invalidateTableSelection = useEffectEvent((label: string | null) => {
    selectedTableLabelRef.current = null;
    setFormData((prev) => (prev.table_id ? { ...prev, table_id: "" } : prev));
    setTableConflict(
      label
        ? `Table ${label} is no longer available for this time. Please choose another table or select No table.`
        : "Your previously selected table is no longer available for this time. Please choose another table or select No table."
    );
  });
  useEffect(() => {
    if (!tablesReady) return;
    // Pristine edit state (untouched initial selection on its original
    // slot) is never flagged — this also preserves the previous behavior
    // where the backend ignores the self-block quirk. Anything the user
    // selected, or any slot move, is evaluated.
    const slotKey = `${formData.reservation_date}|${formData.reservation_time}|${formData.party_size}`;
    if (!tableTouchedRef.current && slotKey === initialSlotRef.current) {
      return;
    }
    if (formData.table_id && !assignableTables.some((t) => t.id === formData.table_id)) {
      const staleId = formData.table_id;
      invalidateTableSelection(
        selectedTableLabelRef.current ?? tableDisplayLabel(staleId)
      );
    }
    // Auto-select first available table that fits party size if user hasn't explicitly chosen one
    if (!tableTouchedRef.current && !formData.table_id && assignableTables.length > 0) {
      const bestFit = assignableTables.find((t) => t.capacity >= formData.party_size);
      if (bestFit) {
        setFormData((prev) => ({ ...prev, table_id: bestFit.id }));
        selectedTableLabelRef.current = tableDisplayLabel(bestFit.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignableIdsKey, tablesReady]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (reservationFor === "registered" && !formData.customer_id) {
      errs.customer_id = "Select a registered customer";
    }
    if (reservationFor === "guest" && !formData.guest_name?.trim()) {
      errs.guest_name = "Guest name is required";
    }
    if (reservationFor === "guest" && !formData.guest_phone?.trim()) {
      errs.guest_phone = "Guest phone is required";
    }
    if (!formData.reservation_date) {
      errs.reservation_date = "Date is required";
    }
    if (!formData.reservation_time) {
      errs.reservation_time = "Time is required";
    }
    if (!formData.end_time) {
      errs.end_time = "End time is required";
    }
    const partySizeVal = parseInt(partySizeInput);
    if (isNaN(partySizeVal) || partySizeVal < 1) {
      errs.party_size = "Party size must be at least 1";
    } else if (partySizeVal > 50) {
      errs.party_size = "Party size cannot exceed 50";
    }
    
    // Validate duration limit (1hr 30min per guest)
    if (formData.reservation_time && formData.end_time && formData.party_size) {
      const durationCheck = checkDurationLimit(formData.reservation_time, formData.end_time, formData.party_size);
      if (!durationCheck.valid) {
        const hours = Math.floor(durationCheck.maxMinutes / 60);
        const mins = durationCheck.maxMinutes % 60;
        const maxDisplay = hours > 0 ? `${hours}hr ${mins}min` : `${mins}min`;
        errs.end_time = `Duration exceeds maximum allowed (${maxDisplay} for ${formData.party_size} guest(s)). Please adjust end time.`;
        setShowDurationLimitAlert(true);
      }
    }
    
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({
      guest_name: true,
      guest_phone: true,
      customer_id: true,
      reservation_date: true,
      reservation_time: true,
      party_size: true,
      table_id: true,
    });
    if (tableConflict) {
      setErrors((prev) => ({ ...prev, table_id: tableConflict }));
      return;
    }
    if (Object.keys(errs).length === 0) {
      onSubmit({
        ...formData,
        customer_id: reservationFor === "registered" ? formData.customer_id : undefined,
        guest_name: reservationFor === "guest" ? formData.guest_name?.trim() : undefined,
        guest_phone: reservationFor === "guest" ? formData.guest_phone?.trim() : undefined,
        guest_email: reservationFor === "guest" ? formData.guest_email?.trim() || undefined : undefined,
        table_id: formData.table_id || undefined,
        special_requests: formData.special_requests?.trim() || undefined,
        party_size: parseInt(partySizeInput),
      });
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Reservation For *</Label>
        <Select
          value={reservationFor}
          onValueChange={(value) => {
            const next = (value ?? "guest") as "registered" | "guest";
            setReservationFor(next);
            setFormData((previous) => ({
              ...previous,
              customer_id: next === "registered" ? previous.customer_id : undefined,
            }));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="registered">Registered Customer</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reservationFor === "registered" ? (
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Select
            value={formData.customer_id || ""}
            onValueChange={(value) =>
              setFormData((previous) => ({ ...previous, customer_id: value ?? "" }))
            }
          >
            <SelectTrigger className="w-full" aria-invalid={touched.customer_id && !!errors.customer_id}>
              {customerDisplayLabel ? <span className="truncate">{customerDisplayLabel}</span> : <SelectValue placeholder="Select a registered customer" />}
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id} className="truncate">
                  {customer.name}{customer.phone ? ` — ${customer.phone}` : ""}
                </SelectItem>
              ))}
              {formData.customer_id && !customers.some((c) => c.id === formData.customer_id) && (
                <SelectItem value={formData.customer_id} disabled className="truncate">
                  {customerDisplayLabel}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {touched.customer_id && errors.customer_id && (
            <p className="text-xs text-destructive">{errors.customer_id}</p>
          )}
        </div>
      ) : (
        <>
      <div className="space-y-2">
        <Label htmlFor="guest-name">Guest Name *</Label>
        <Input
          id="guest-name"
          value={formData.guest_name ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              guest_name: e.target.value,
            }))
          }
          onBlur={() => handleBlur("guest_name")}
          placeholder="e.g. Juan Dela Cruz"
          aria-invalid={touched.guest_name && !!errors.guest_name}
        />
        {touched.guest_name && errors.guest_name && (
          <p className="text-xs text-destructive">{errors.guest_name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest-phone">Phone *</Label>
        <Input
          id="guest-phone"
          value={formData.guest_phone ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              guest_phone: e.target.value,
            }))
          }
          placeholder="+63 917 123 4567"
          onBlur={() => handleBlur("guest_phone")}
          aria-invalid={touched.guest_phone && !!errors.guest_phone}
        />
        {touched.guest_phone && errors.guest_phone && (
          <p className="text-xs text-destructive">{errors.guest_phone}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest-email">Email</Label>
        <Input
          id="guest-email"
          type="email"
          value={formData.guest_email ?? ""}
          onChange={(e) => setFormData((previous) => ({ ...previous, guest_email: e.target.value }))}
          placeholder="guest@example.com"
        />
      </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="res-date">Date *</Label>
          <Input
            id="res-date"
            type="date"
            value={formData.reservation_date}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                reservation_date: e.target.value,
              }))
            }
            onBlur={() => handleBlur("reservation_date")}
            aria-invalid={touched.reservation_date && !!errors.reservation_date}
            min={minDate}
          />
          {touched.reservation_date && errors.reservation_date && (
            <p className="text-xs text-destructive">{errors.reservation_date}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="res-time">Start Time *</Label>
          {timeSlotsData?.time_slots && timeSlotsData.time_slots.length > 0 ? (
            <Select
              value={formData.reservation_time || ""}
              onValueChange={(value) => {
                const newStartTime = value;
                if (!newStartTime) return;
                setFormData((prev) => {
                  const partySize = prev.party_size || 2;
                  const maxDurationPerGuest = 90;
                  const maxTotalDuration = partySize * maxDurationPerGuest;
                  
                  let duration = maxTotalDuration;
                  if (policy) {
                    const suggestedDuration = partySize <= 4 
                      ? policy.regular_duration_minutes 
                      : policy.large_duration_minutes;
                    duration = Math.min(suggestedDuration, maxTotalDuration);
                  }
                  
                  const endTime = calculateEndTime(newStartTime, duration);
                  return {
                    ...prev,
                    reservation_time: newStartTime,
                    end_time: endTime,
                    duration_minutes: duration,
                  };
                });
              }}
            >
              <SelectTrigger className="w-full" aria-invalid={touched.reservation_time && !!errors.reservation_time}>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {timeSlotsData.time_slots.map((slot: TimeSlot) => (
                  <SelectItem
                    key={slot.time}
                    value={slot.time}
                    disabled={!slot.is_available}
                    className={cn(
                      "flex items-center justify-between w-full",
                      !slot.is_available && "text-muted-foreground opacity-50"
                    )}
                  >
                    <span>{slot.display_time} – {slot.end_time}</span>
                    <span className={cn("text-xs font-medium", slot.is_available ? "text-green-600" : "text-red-600")}>
                      {slot.is_available ? "Available" : "Booked"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="res-time"
              type="time"
              value={formData.reservation_time || ""}
              onChange={(e) => {
                const newStartTime = e.target.value;
                setFormData((prev) => {
                  const partySize = prev.party_size || 2;
                  const maxDurationPerGuest = 90;
                  const maxTotalDuration = partySize * maxDurationPerGuest;
                  
                  let duration = maxTotalDuration;
                  if (policy) {
                    const suggestedDuration = partySize <= 4 
                      ? policy.regular_duration_minutes 
                      : policy.large_duration_minutes;
                    duration = Math.min(suggestedDuration, maxTotalDuration);
                  }
                  
                  const endTime = calculateEndTime(newStartTime, duration);
                  return {
                    ...prev,
                    reservation_time: newStartTime,
                    end_time: endTime,
                    duration_minutes: duration,
                  };
                });
              }}
              onBlur={() => handleBlur("reservation_time")}
              aria-invalid={touched.reservation_time && !!errors.reservation_time}
              placeholder="Select date first"
              disabled={!timeSlotsData}
            />
          )}
          {touched.reservation_time && errors.reservation_time && (
            <p className="text-xs text-destructive">{errors.reservation_time}</p>
          )}
          {timeSlotsData?.time_slots && (
            <p className="text-xs text-muted-foreground">
              Green = Available &nbsp;|&nbsp; Red = Fully Booked
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="res-end-time">End Time (Auto-calculated) *</Label>
          <div className="relative">
            <Input
              id="res-end-time"
              type="time"
              value={formData.end_time || ""}
              readOnly
              className="bg-muted/50 cursor-not-allowed"
            />
            <Info className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">End time is automatically calculated based on party size (1hr 30min per guest maximum)</p>
        </div>

        <div className="space-y-2">
          <Label>Maximum Duration</Label>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {formData.party_size * 90} minutes 
                <span className="text-sm font-normal text-muted-foreground">
                  ({Math.floor(formData.party_size * 90 / 60)}hr {formData.party_size * 90 % 60}min)
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                1hr 30min per guest × {formData.party_size} guest(s) = {formData.party_size * 90} min maximum
              </p>
            </div>
{formData.reservation_time && formData.end_time && (
              <span className="text-sm text-muted-foreground ml-auto">
                Your booking: {formData.reservation_time} – {formData.end_time}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="party-size">Party Size *</Label>
          <Input
            id="party-size"
            type="text"
            inputMode="numeric"
            value={partySizeInput}
            onChange={(e) => {
              setPartySizeInput(e.target.value);
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                setFormData((prev) => ({
                  ...prev,
                  party_size: val,
                }));
              }
            }}
            onBlur={() => {
              handleBlur("party_size");
              const val = parseInt(partySizeInput);
              if (!isNaN(val)) {
                setFormData((prev) => ({
                  ...prev,
                  party_size: val,
                }));
              }
            }}
            aria-invalid={touched.party_size && !!errors.party_size}
          />
          {touched.party_size && errors.party_size && (
            <p className="text-xs text-destructive">{errors.party_size}</p>
          )}
          {formData.party_size && (!formData.reservation_date || !formData.reservation_time) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Select Date & Time above to auto-fill the best available table
            </p>
          )}
          {formData.party_size > 12 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Party size exceeds maximum table capacity (12). This requires a full venue rental or multiple tables.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Table (optional)</Label>
          {formData.party_size > 12 ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" key="full-venue">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Full Venue Rental
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                For parties larger than 12, the entire venue will be reserved. Table selection is not required.
              </p>
            </div>
          ) : (
            <>
              <Select
                value={formData.table_id || ""}
                onValueChange={handleTableChange}
              >
                <SelectTrigger className="w-full" aria-invalid={!!errors.table_id}>
                  {selectedTableLabel ? <span className="truncate">{selectedTableLabel}</span> : <SelectValue placeholder="Select a table (optional)" />}
                </SelectTrigger>
<SelectContent>
                  <SelectItem value="">No table</SelectItem>
                  {isCheckingAvailability && (
                    <SelectItem disabled value="__loading">
                      Checking availability...
                    </SelectItem>
                  )}
                  {!isCheckingAvailability && tablesWithOccupancy.length === 0 && !formData.table_id && (
                    <SelectItem disabled value="__none">
                      No tables configured
                    </SelectItem>
                  )}
                  {!isCheckingAvailability && tablesWithOccupancy.length > 0 && (
                    <>
                      {/* Exact Match - tables with capacity exactly equal to party size */}
                      <SelectItem disabled value="__section-exact" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        — Exact Match (cap: {formData.party_size}) —
                      </SelectItem>
                      {tablesWithOccupancy
                        .filter((t) => t.isAvailable && t.isExactMatch)
                        .map((t: Table & { isAvailable: boolean; canFit: boolean; isExactMatch: boolean; occupancyStatus: string }) => (
                          <SelectItem key={t.id} value={t.id} className="truncate">
                            Table {t.number} (cap: {t.capacity}) ✓
                          </SelectItem>
                        ))}
                      {tablesWithOccupancy.filter((t) => t.isAvailable && t.isExactMatch).length === 0 && (
                        <SelectItem disabled value="__none-exact" className="text-xs text-muted-foreground">
                          No exact match tables available
                        </SelectItem>
                      )}

                      {/* Other Available Sizes - tables that can fit but larger than needed */}
                      <SelectItem disabled value="__section-other" className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        — Other Available Sizes —
                      </SelectItem>
                      {tablesWithOccupancy
                        .filter((t) => t.isAvailable && t.canFit && !t.isExactMatch)
                        .map((t: Table & { isAvailable: boolean; canFit: boolean; isExactMatch: boolean; occupancyStatus: string }) => (
                          <SelectItem key={t.id} value={t.id} disabled className="truncate text-muted-foreground">
                            Table {t.number} (cap: {t.capacity}) — Larger than needed
                          </SelectItem>
                        ))}
                      {tablesWithOccupancy.filter((t) => t.isAvailable && t.canFit && !t.isExactMatch).length === 0 && (
                        <SelectItem disabled value="__none-other" className="text-xs text-muted-foreground">
                          No other size tables available
                        </SelectItem>
                      )}

                      <SelectItem disabled value="__section-occupied" className="text-xs text-muted-foreground font-medium">
                        — Occupied / Unavailable —
                      </SelectItem>
                      {tablesWithOccupancy
                        .filter((t) => !t.isAvailable)
                        .map((t: Table & { isAvailable: boolean; canFit: boolean; isExactMatch: boolean; occupancyStatus: string }) => (
                          <SelectItem key={t.id} value={t.id} disabled className="truncate text-muted-foreground">
                            Table {t.number} (cap: {t.capacity}) — Occupied
                          </SelectItem>
                        ))}
                      {tablesWithOccupancy
                        .filter((t) => t.isAvailable && !t.canFit)
                        .map((t: Table & { isAvailable: boolean; canFit: boolean; isExactMatch: boolean; occupancyStatus: string }) => (
                          <SelectItem key={t.id} value={t.id} disabled className="truncate text-muted-foreground">
                            Table {t.number} (cap: {t.capacity}) — Too small
                          </SelectItem>
                        ))}
                    </>
                  )}
                  {formData.table_id && !tablesWithOccupancy.some((t) => t.id === formData.table_id) && (
                    <SelectItem value={formData.table_id} disabled className="truncate">
                      {selectedTableLabel}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {(tableConflict || errors.table_id) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {tableConflict ?? errors.table_id}
                </p>
              )}
            </>
          )}
        </div>

      <div className="space-y-2">
        <Label htmlFor="event-type">Event Type (Optional)</Label>
        <Select
          value={formData.event_type || ""}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, event_type: value === "" ? undefined : (value as EventType | undefined) }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select event type (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="Birthday">Birthday</SelectItem>
            <SelectItem value="Anniversary">Anniversary</SelectItem>
            <SelectItem value="Corporate">Corporate</SelectItem>
            <SelectItem value="Wedding">Wedding</SelectItem>
            <SelectItem value="Holiday Party">Holiday Party</SelectItem>
            <SelectItem value="Graduation">Graduation</SelectItem>
            <SelectItem value="Baby Shower">Baby Shower</SelectItem>
            <SelectItem value="Bridal Shower">Bridal Shower</SelectItem>
            <SelectItem value="Rehearsal Dinner">Rehearsal Dinner</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Policy notice banner */}
      {policy && formData.party_size && (formData.party_size >= policy.card_threshold || (() => {
        const dayOfWeek = new Date(formData.reservation_date).getDay();
        return policy.weekend_days.includes(dayOfWeek);
      })()) && (
        <div className="relative p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Info className="h-4 w-4" />
                Reservation Requirements
              </h4>
              <div className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                {formData.party_size >= policy.card_threshold && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Card on file required for parties of {policy.card_threshold}+ people</span>
                  </div>
                )}
                {(() => {
                  const dayOfWeek = new Date(formData.reservation_date).getDay();
                  if (policy.weekend_days.includes(dayOfWeek)) {
                    return (
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Card on file required for Friday/Saturday reservations</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {policy.deposit_percentage > 0 && formData.party_size >= policy.card_threshold && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Deposit of {policy.deposit_percentage}% may be required for large parties</span>
                  </div>
                )}
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  All thresholds are configurable per restaurant location.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTE: no status selector — the backend update() endpoint does not
          accept status changes; use the row/status actions instead. */}

      <div className="space-y-2">
        <Label htmlFor="special-requests">Special Requests</Label>
        <Textarea
          id="special-requests"
          value={formData.special_requests}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              special_requests: e.target.value,
            }))
          }
          placeholder="Dietary restrictions, occasion, seating preference, etc."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>

    {/* Duration Limit Alert Modal */}
    {showDurationLimitAlert && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-background rounded-xl shadow-xl border p-6 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Duration Limit Exceeded</h3>
              <p className="text-sm text-muted-foreground">Please adjust your reservation time</p>
            </div>
          </div>
          
          <div className="space-y-4 mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Our policy allows a maximum of <strong>1 hour 30 minutes per guest</strong> to ensure a comfortable dining experience for all patrons and fair table turnover.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              For <strong>{formData.party_size} guest(s)</strong>, the maximum duration is <strong>{formData.party_size * 90} minutes</strong> 
              ({Math.floor(formData.party_size * 90 / 60)}hr {formData.party_size * 90 % 60}min).
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShowDurationLimitAlert(false)}
            >
              <X className="h-4 w-4 mr-2" />
              I'll Adjust Times
            </Button>
            <Button 
              className="flex-1"
              onClick={() => setShowDurationLimitAlert(false)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Understood
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Time Limit Hit Alert - For Staff (when customer hits limit during dining) */}
    {showTimeLimitHitAlert && timeLimitDetails && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-background rounded-xl shadow-xl border p-6 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Bell className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Table Time Limit Reached</h3>
              <p className="text-sm text-muted-foreground">Guest has reached their maximum dining duration</p>
            </div>
          </div>

          <div className="space-y-3 mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Table:</span>
              <span className="font-medium">{timeLimitDetails.tableNumber}</span>
              <span className="text-muted-foreground">Reservation:</span>
              <span className="font-medium">{timeLimitDetails.reservationNumber}</span>
              <span className="text-muted-foreground">Guest:</span>
              <span className="font-medium">{timeLimitDetails.guestName}</span>
              <span className="text-muted-foreground">Elapsed:</span>
              <span className="font-medium text-red-600">{Math.floor(timeLimitDetails.elapsedMinutes / 60)}hr {timeLimitDetails.elapsedMinutes % 60}min</span>
              <span className="text-muted-foreground">Max Allowed:</span>
              <span className="font-medium">{Math.floor(timeLimitDetails.maxMinutes / 60)}hr {timeLimitDetails.maxMinutes % 60}min</span>
            </div>
          </div>

          <div className="space-y-3 mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Suggested Guest Notification Script
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 italic">
              "Excuse me, {timeLimitDetails.guestName}. We hope you've had a wonderful dining experience with us today. 
              As a courtesy, we wanted to let you know that your reserved dining time of 
              {Math.floor(timeLimitDetails.maxMinutes / 60)} hour(s) {timeLimitDetails.maxMinutes % 60} minute(s) 
              is approaching its conclusion. We have another reservation scheduled for this table shortly. 
              Would you like to enjoy a dessert or coffee to conclude your meal, or shall we prepare your bill? 
              Thank you for choosing us, and we look forward to welcoming you again soon!"
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => { setShowTimeLimitHitAlert(false); setTimeLimitDetails(null); }}
            >
              <X className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            <Button 
              className="flex-1"
              onClick={() => { 
                // Copy notification script to clipboard
                navigator.clipboard.writeText(
                  `Excuse me, ${timeLimitDetails.guestName}. We hope you've had a wonderful dining experience with us today. As a courtesy, we wanted to let you know that your reserved dining time of ${Math.floor(timeLimitDetails.maxMinutes / 60)} hour(s) ${timeLimitDetails.maxMinutes % 60} minute(s) is approaching its conclusion. We have another reservation scheduled for this table shortly. Would you like to enjoy a dessert or coffee to conclude your meal, or shall we prepare your bill? Thank you for choosing us, and we look forward to welcoming you again soon!`
                );
                setShowTimeLimitHitAlert(false);
                setTimeLimitDetails(null);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Copy Script & Notify
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
