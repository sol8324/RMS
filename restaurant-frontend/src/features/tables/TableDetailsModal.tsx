"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  Clock,
  Hash,
  LayoutGrid,
  RefreshCw,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared";
import { useTableActiveOrders } from "@/lib/hooks";
import { cn, formatCurrency, formatLabel, formatTime, timeAgo } from "@/lib/utils";
import type { Order, Table as TableType } from "@/lib/types";

interface TableDetailsModalProps {
  table: TableType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewOrders?: boolean;
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

function OrderCard({ order, canViewOrders }: { order: Order; canViewOrders: boolean }) {
  const placedAt = order.placed_at ?? order.created_at;

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
}: TableDetailsModalProps) {
  const queryClient = useQueryClient();
  const ordersQuery = useTableActiveOrders(table?.id, open);
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
      <DialogContent className="flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="mx-0 mt-0 mb-0 shrink-0 border-b bg-popover px-5 py-4 sm:px-6">
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

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5">
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
                  value={table.shape ? formatLabel(table.shape) : "—"}
                  icon={LayoutGrid}
                />
                <InfoTile
                  label="Accessibility"
                  value={table.is_wheelchair_accessible ? "Accessible" : "Standard"}
                  icon={Accessibility}
                />
                <InfoTile
                  label="Floor plan"
                  value={table.floor_plan?.name ?? "Unassigned"}
                  icon={LayoutGrid}
                />
              </div>

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
                        ? "Refreshing…"
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
                    value={oldestOrder ? timeAgo(oldestOrder.placed_at ?? oldestOrder.created_at) : "—"}
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
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t bg-muted/20 px-4 py-3 sm:px-6">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
