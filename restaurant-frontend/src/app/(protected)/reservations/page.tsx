"use client";

import { useState, useRef, useMemo } from "react";
import { PageHeader, ConfirmDialog, SearchInput, ErrorBoundary, TablePagination, ErrorState } from "@/components/shared";
import {
  ReservationTable,
  ReservationStats,
  CalendarView,
  ReservationForm,
  ReservationDetail,
} from "@/features/reservations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CalendarDays, List } from "lucide-react";
import { useReservationCalendar, useReservations } from "@/lib/hooks";
import { DEBOUNCE_DELAY, ITEMS_PER_PAGE } from "@/lib/utils/constants";
import type { Reservation } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { canEdit } from "@/lib/utils/permissions";

export default function ReservationsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Backend defaults to non-archived; "archived" flips the scope param.
  const [viewScope, setViewScope] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<Reservation | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Reservation | null>(null);
  const [viewTarget, setViewTarget] = useState<Reservation | null>(null);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Reservation | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { user } = useAuth();
  const canCreate = canEdit(user?.role, "reservations");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useMemo(
    () => ({
      page,
      per_page: ITEMS_PER_PAGE,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter !== "all" && { status: statusFilter }),
      ...(viewScope === "archived" && { archived: true }),
    }),
    [page, debouncedSearch, statusFilter, viewScope]
  );

  const { list, create, update, cancel, checkIn, complete, archive } =
    useReservations(params);

  // Calendar tab: dedicated month-range endpoint so results are never
  // limited by the list's pagination.
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const calRange = useMemo(() => {
    const first = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );
    // Pad to full visible weeks (Mon-start grid).
    const start = new Date(first);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const last = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));
    return {
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
    };
  }, [calendarMonth]);

  const {
    data: calendarData = { items: [], table_occupancy: {} },
    isLoading: calendarLoading,
  } = useReservationCalendar(calRange);
  const calendarReservations = calendarData.items;
  const calendarTableOccupancy = calendarData.table_occupancy;

  // Filter out completed and cancelled from the "active" view,
  // but include them when status filter is explicitly set
  const reservations = list.data?.data?.data ?? [];
  const meta = list.data?.data?.meta;

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, DEBOUNCE_DELAY);
  }

  function handleCancelConfirm() {
    if (!cancelTarget) return;
    cancel.mutate(
      { id: cancelTarget.id, reason: "Cancelled by staff" },
      {
        onSuccess: () => {
          toast.success(
            `Reservation ${cancelTarget.reservation_number} cancelled`
          );
          setCancelTarget(null);
          setViewTarget(null);
        },
        onError: () => toast.error("Failed to cancel reservation"),
      }
    );
  }

  function handleCheckInConfirm() {
    if (!checkInTarget) return;
    checkIn.mutate({ id: checkInTarget.id, actual_party_size: checkInTarget.party_size }, {
      onSuccess: () => {
        toast.success(
          `Reservation ${checkInTarget.reservation_number} checked in`
        );
        setCheckInTarget(null);
        setViewTarget(null);
      },
      onError: () => toast.error("Failed to check in"),
    });
  }

  function handleCompleteConfirm() {
    if (!completeTarget) return;
    complete.mutate(completeTarget.id, {
      onSuccess: () => {
        toast.success(
          `Reservation ${completeTarget.reservation_number} completed`
        );
        setCompleteTarget(null);
        setViewTarget(null);
      },
      onError: () => toast.error("Failed to complete reservation"),
    });
  }

  function handleArchiveConfirm() {
    if (!archiveTarget) return;
    archive.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success(
          `Reservation ${archiveTarget.reservation_number} archived`
        );
        setArchiveTarget(null);
      },
      onError: () => toast.error("Failed to archive reservation"),
    });
  }


  return (
    <ErrorBoundary>
      <div>
        <PageHeader
          title="Reservations"
          description="Manage table reservations"
          action={
            canCreate && (
              <Button
                size="sm"
                onClick={() => setShowNewDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Reservation
              </Button>
            )
          }
        />

        <div className="space-y-6">
          <ReservationStats reservations={reservations} total={meta?.total} />

          <Tabs defaultValue="list">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="list">
                  <List className="h-4 w-4 mr-1.5" />
                  List
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Calendar
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <SearchInput
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search reservations..."
                  className="w-full sm:max-w-sm"
                />
                <Select
                  value={viewScope}
                  onValueChange={(v) => {
                    setViewScope((v ?? "active") as "active" | "archived");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[130px] min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val ?? "all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px] min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    {/* "confirmed" is a valid workflow status but intentionally
                        excluded from the user-facing filter. */}
                    <SelectItem value="seated">Seated</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="list" className="mt-4">
              {list.isError && (
                <ErrorState
                  message="Failed to load reservations. Please try again."
                  onRetry={() => list.refetch()}
                  className="mb-4"
                />
              )}

              <ReservationTable
                reservations={reservations}
                isLoading={list.isLoading}
                onView={(r) => setViewTarget(r)}
                onEdit={(r) => setEditTarget(r)}
                onCancel={(r) => setCancelTarget(r)}
                onCheckIn={(r) => setCheckInTarget(r)}
                onComplete={(r) => setCompleteTarget(r)}
                onArchive={(r) => setArchiveTarget(r)}
                canManage={canCreate}
              />

              {meta && meta.last_page > 1 && (
                <div className="mt-4">
                  <TablePagination
                    currentPage={meta.current_page}
                    totalPages={meta.last_page}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <CalendarView
                reservations={calendarReservations}
                tableOccupancy={calendarTableOccupancy}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onMonthChange={setCalendarMonth}
                isLoading={calendarLoading}
                size="default"
              />
            </TabsContent>
          </Tabs>
        </div>

        <ConfirmDialog
          open={!!cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
          title="Cancel Reservation"
          description={`Are you sure you want to cancel reservation ${cancelTarget?.reservation_number} for ${cancelTarget?.guest_name}?`}
          confirmText="Cancel Reservation"
          variant="destructive"
          onConfirm={handleCancelConfirm}
          isLoading={cancel.isPending}
        />

        <ConfirmDialog
          open={!!checkInTarget}
          onOpenChange={(open) => !open && setCheckInTarget(null)}
          title="Check In"
          description={`Mark reservation ${checkInTarget?.reservation_number} as seated and occupy the table?`}
          confirmText="Check In"
          onConfirm={handleCheckInConfirm}
          isLoading={checkIn.isPending}
        />

        <ConfirmDialog
          open={!!completeTarget}
          onOpenChange={(open) => !open && setCompleteTarget(null)}
          title="Complete Reservation"
          description={`Mark reservation ${completeTarget?.reservation_number} as completed and free the table?`}
          confirmText="Complete"
          onConfirm={handleCompleteConfirm}
          isLoading={complete.isPending}
        />

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-24px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Reservation</DialogTitle>
            </DialogHeader>
            <ReservationForm
              onSubmit={(data) => {
                create.mutate(
                  {
                    ...data,
                    reservation_date: data.reservation_date.split("T")[0],
                  },
                  {
                    onSuccess: () => {
                      toast.success("Reservation created successfully");
                      setShowNewDialog(false);
                    },
                    onError: () =>
                      toast.error("Failed to create reservation"),
                  }
                );
              }}
              isLoading={create.isPending}
              submitLabel="Create Reservation"
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!viewTarget}
          onOpenChange={(open) => !open && setViewTarget(null)}
        >
          <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-24px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reservation Details</DialogTitle>
            </DialogHeader>
            {viewTarget && (
              <ReservationDetail
                reservation={viewTarget}
                onEdit={() => setEditTarget(viewTarget)}
                onCancel={() => setCancelTarget(viewTarget)}
                onCheckIn={() => setCheckInTarget(viewTarget)}
                onComplete={() => setCompleteTarget(viewTarget)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-24px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Reservation</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <ReservationForm
                initialData={editTarget}
                onSubmit={(data) => {
                  update.mutate(
                    { id: editTarget.id, data },
                    {
                      onSuccess: () => {
                        toast.success("Reservation updated successfully");
                        setEditTarget(null);
                        setViewTarget(null);
                      },
                      onError: () =>
                        toast.error("Failed to update reservation"),
                    }
                  );
                }}
                isLoading={update.isPending}
                submitLabel="Update Reservation"
              />
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!archiveTarget}
          onOpenChange={(open) => !open && setArchiveTarget(null)}
          title="Archive Reservation"
          description={`Archive reservation ${archiveTarget?.reservation_number} for ${archiveTarget?.guest_name}? Archived reservations are hidden from the active list.`}
          confirmText="Archive"
          onConfirm={handleArchiveConfirm}
          isLoading={archive.isPending}
        />
      </div>
    </ErrorBoundary>
  );
}
