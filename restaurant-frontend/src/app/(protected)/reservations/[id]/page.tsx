"use client";

import { use, useState } from "react";
import Link from "next/link";
import { DetailPageSkeleton, PageHeader, ConfirmDialog } from "@/components/shared";
import { ReservationDetail } from "@/features/reservations";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useReservation, useReservations } from "@/lib/hooks";
import { toast } from "sonner";

export default function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: reservation, isLoading } = useReservation(id);
  const { cancel, checkIn, complete } = useReservations();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  function handleCancel() {
    if (!reservation) return;
    cancel.mutate(
      { id: reservation.id, reason: "Cancelled by staff" },
      {
        onSuccess: () => {
          toast.success(`Reservation ${reservation.reservation_number} cancelled`);
          setShowCancelDialog(false);
        },
        onError: () => toast.error("Failed to cancel reservation"),
      }
    );
  }

  function handleCheckIn() {
    if (!reservation) return;
    checkIn.mutate({ id: reservation.id, actual_party_size: reservation.party_size }, {
      onSuccess: () => {
        toast.success(`Reservation ${reservation.reservation_number} checked in`);
        setShowCheckInDialog(false);
      },
      onError: () => toast.error("Failed to check in"),
    });
  }

  function handleComplete() {
    if (!reservation) return;
    complete.mutate(reservation.id, {
      onSuccess: () => {
        toast.success(`Reservation ${reservation.reservation_number} completed`);
        setShowCompleteDialog(false);
      },
      onError: () => toast.error("Failed to complete reservation"),
    });
  }

  if (isLoading) {
    return (
      <DetailPageSkeleton />
    );
  }

  if (!reservation) {
    return (
      <div>
        <PageHeader
          title="Reservation Not Found"
          description="The reservation you're looking for doesn't exist."
          action={
            <Button variant="outline" size="sm" render={<Link href="/reservations" />}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Reservations
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reservation Details"
        action={
          <Button variant="outline" size="sm" render={<Link href="/reservations" />}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
        }
      />
      <ReservationDetail
        reservation={reservation}
        onCancel={() => setShowCancelDialog(true)}
        onCheckIn={() => setShowCheckInDialog(true)}
        onComplete={() => setShowCompleteDialog(true)}
      />

      <ConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Reservation"
        description={`Are you sure you want to cancel reservation ${reservation.reservation_number}?`}
        confirmText="Cancel Reservation"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={cancel.isPending}
      />

      <ConfirmDialog
        open={showCheckInDialog}
        onOpenChange={setShowCheckInDialog}
        title="Check In"
        description={`Mark reservation ${reservation.reservation_number} as seated and occupy the table?`}
        confirmText="Check In"
        onConfirm={handleCheckIn}
        isLoading={checkIn.isPending}
      />

      <ConfirmDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        title="Complete Reservation"
        description={`Mark reservation ${reservation.reservation_number} as completed and free the table?`}
        confirmText="Complete"
        onConfirm={handleComplete}
        isLoading={complete.isPending}
      />
    </div>
  );
}
