'use client';

import { memo, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import { formatLabel } from '@/lib/utils';

/**
 * The badge palette. Every status resolves to one of these tones, so a state
 * that means the same thing looks the same everywhere — previously `completed`
 * rendered emerald while `approved` rendered `success/10`, and `cancelled`
 * rendered red while `rejected` rendered `destructive/10`, for identical
 * meanings.
 *
 * Hues are unchanged from the previous hand-written palette; only the
 * mechanism moved from raw Tailwind ramp steps to theme tokens, so the badges
 * now follow the theme (including the reduced-contrast dark ramp) instead of
 * being pinned to fixed 100/700 steps.
 */
const TONES = {
  /** Done, in good standing, available. */
  success: 'bg-success/10 text-success',
  /** Failed, cancelled, at capacity, or otherwise blocking. */
  danger: 'bg-destructive/10 text-destructive',
  /** Awaiting action, or degrading but not yet broken. */
  warning: 'bg-warning/10 text-warning',
  /** Acknowledged and proceeding; also informational outcomes. */
  info: 'bg-info/10 text-info',
  /** Currently with the guest — seated or served, awaiting close-out. */
  service: 'bg-service/10 text-service',
  /** Inert: drafts, archives, no-shows, nothing in flight. */
  neutral: 'bg-muted text-muted-foreground',
} as const;

type Tone = keyof typeof TONES;

/** Status slug to tone. Unlisted statuses fall back to `neutral`. */
const STATUS_TONE: Record<string, Tone> = {
  // Tables
  available: 'success',
  occupied: 'danger',
  reserved: 'warning',
  needs_cleaning: 'warning',
  maintenance: 'neutral',

  // Orders
  draft: 'neutral',
  pending: 'warning',
  confirmed: 'info',
  preparing: 'warning',
  ready: 'success',
  served: 'service',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'danger',
  voided: 'danger',
  refunded: 'info',

  // Reservations
  seated: 'service',
  no_show: 'neutral',
  expired: 'neutral',

  // Purchase orders
  ordered: 'info',
  received: 'info',
  delivered: 'info',
  approved: 'success',
  rejected: 'danger',

  // Payments
  paid: 'success',
  unpaid: 'warning',
  partial: 'warning',

  // Inventory
  low_stock: 'warning',
  out_of_stock: 'danger',
  overstock: 'info',
  low: 'warning',
  normal: 'info',
  critical: 'danger',

  // Kitchen
  rush: 'danger',
  waiting: 'warning',
  in_progress: 'warning',

  // Priority
  urgent: 'danger',
  high: 'warning',

  // Staff and attendance
  active: 'success',
  present: 'success',
  inactive: 'neutral',
  absent: 'danger',
  late: 'warning',
  half_day: 'warning',
  on_leave: 'info',
  scheduled: 'neutral',

  // Leave requests
  requested: 'warning',

  // Shift swaps
  swap: 'info',
};

export const StatusBadge = memo(function StatusBadge({
  status,
  className,
  label,
  ...props
}: {
  status: string;
  className?: string;
  label?: string;
} & ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      data-tone={STATUS_TONE[status] ?? 'neutral'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-current/15 px-2.5 py-0.5 font-mono text-[11px] font-medium leading-4',
        TONES[STATUS_TONE[status] ?? 'neutral'],
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? formatLabel(status)}
    </span>
  );
});
