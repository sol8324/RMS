"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReservation } from "@/lib/hooks";
import type { Reservation } from "@/lib/types";
import { ReservationDetail } from "./ReservationDetail";
import { ReservationRequestsPanel } from "./ReservationRequestsPanel";

export function ReservationDetailsModal({
  reservation,
  open,
  onOpenChange,
  onEdit,
  onCancel,
  onCheckIn,
  onComplete,
  canManage = false,
}: {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onCheckIn?: () => void;
  onComplete?: () => void;
  canManage?: boolean;
}) {
  const detail = useReservation(open && reservation?.id ? reservation.id : "");
  const current = detail.data ?? reservation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-24px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservation Details</DialogTitle>
        </DialogHeader>
        {current && (
          <div className="space-y-4">
            <ReservationDetail
              reservation={current}
              onEdit={onEdit}
              onCancel={onCancel}
              onCheckIn={onCheckIn}
              onComplete={onComplete}
            />
            <ReservationRequestsPanel reservation={current} canManage={canManage} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
