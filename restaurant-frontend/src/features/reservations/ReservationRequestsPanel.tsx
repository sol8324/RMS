"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ApiResponse,
  Reservation,
  ReservationRequest,
  ReservationRequestCategory,
  ReservationRequestStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<ReservationRequestCategory, string> = {
  seating: "Seating",
  accessibility: "Accessibility",
  dietary: "Dietary",
  occasion: "Occasion",
  other: "Other",
};

const STATUS_LABEL: Record<ReservationRequestStatus, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ReservationRequestsPanel({
  reservation,
  canManage = false,
}: {
  reservation: Reservation;
  canManage?: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<ReservationRequestCategory>("seating");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const requests = reservation.requests ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  };

  const addRequest = useMutation({
    mutationFn: (data: ReservationRequest) =>
      api.post<ApiResponse<ReservationRequest>>(
        `/reservations/${reservation.id}/requests`,
        data
      ),
    onSuccess: () => {
      toast.success("Request added");
      setLabel("");
      setValue("");
      setAdding(false);
      invalidate();
    },
    onError: () => toast.error("Failed to add request"),
  });

  const updateRequest = useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: ReservationRequestStatus;
    }) =>
      api.patch<ApiResponse<ReservationRequest>>(
        `/reservations/${reservation.id}/requests/${requestId}`,
        { status }
      ),
    onSuccess: () => {
      toast.success("Request updated");
      invalidate();
    },
    onError: () => toast.error("Failed to update request"),
  });

  const removeRequest = useMutation({
    mutationFn: (requestId: string) =>
      api.delete<ApiResponse<null>>(
        `/reservations/${reservation.id}/requests/${requestId}`
      ),
    onSuccess: () => {
      toast.success("Request removed");
      invalidate();
    },
    onError: () => toast.error("Failed to remove request"),
  });

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Structured requests</h3>
          <p className="text-xs text-muted-foreground">
            Seating and accessibility requests are matched to the assigned table.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding((current) => !current)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </div>

      {adding && canManage && (
        <div className="mt-3 grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[130px_1fr_1fr_auto]">
          <Select
            value={category}
            onValueChange={(next) =>
              setCategory((next ?? "seating") as ReservationRequestCategory)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([key, text]) => (
                <SelectItem key={key} value={key}>
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label, e.g. Window seat"
            className="h-9"
          />
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Preference value (optional)"
            className="h-9"
          />
          <Button
            type="button"
            size="sm"
            disabled={!label.trim() || addRequest.isPending}
            onClick={() =>
              addRequest.mutate({
                category,
                label: label.trim(),
                value: value.trim() || null,
              })
            }
          >
            {addRequest.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
          No structured requests for this reservation.
        </p>
      ) : (
        <ul className="mt-3 divide-y rounded-lg border">
          {requests.map((request) => {
            const status = (request.status ?? "pending") as ReservationRequestStatus;
            const completed = status === "completed";

            return (
              <li
                key={request.id ?? `${request.category}-${request.label}`}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABEL[request.category]}
                    </span>
                    <span className="text-sm font-medium">{request.label}</span>
                    {request.is_matched === true && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Matched
                      </span>
                    )}
                    {request.is_matched === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        <CircleHelp className="h-3 w-3" />
                        Unmet
                      </span>
                    )}
                  </div>
                  {request.value && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Preference: {request.value}
                    </p>
                  )}
                  {request.details && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {request.details}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
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
                    {STATUS_LABEL[status]}
                  </span>
                  {canManage && request.id && !completed && status !== "cancelled" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={updateRequest.isPending}
                      onClick={() =>
                        updateRequest.mutate({
                          requestId: request.id as string,
                          status: status === "pending" ? "acknowledged" : "completed",
                        })
                      }
                    >
                      {status === "pending" ? "Acknowledge" : "Complete"}
                    </Button>
                  )}
                  {canManage && request.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${request.label}`}
                      disabled={removeRequest.isPending}
                      onClick={() => removeRequest.mutate(request.id as string)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
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
