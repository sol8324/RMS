"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DialogBodySkeleton } from "@/components/shared";
import { Search, Receipt, ChevronDown, ChevronRight } from "lucide-react";
import { useUnpaidOrders } from "@/lib/hooks";
import { formatCurrency, formatLabel } from "@/lib/utils";
import { customerDisplayName, tableDisplayName } from "@/lib/utils/orderDisplay";
import type { Order } from "@/lib/types";

const PAYMENT_BADGE: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  partial:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

interface ExistingOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (order: Order) => void;
}

export function ExistingOrderDialog({
  open,
  onOpenChange,
  onSelect,
}: ExistingOrderDialogProps) {
  const { data, isLoading } = useUnpaidOrders();
  const [query, setQuery] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    const all = (data?.data?.data ?? []) as Order[];
    return all
      .filter(
        (o) =>
          o.status === "served" &&
          (o.payment_status === "unpaid" || o.payment_status === "partial")
      )
      .filter((o) =>
        query === ""
          ? true
          : o.order_number.toLowerCase().includes(query.toLowerCase()) ||
            (o.customer?.name ?? "")
              .toLowerCase()
              .includes(query.toLowerCase())
      );
  }, [data, query]);

  // Group orders by table
  const ordersByTable = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    const noTableOrders: Order[] = [];

    for (const order of filteredOrders) {
      const tableKey = order.table?.number
        ? `Table ${order.table.number}`
        : "No Table Assigned";

      if (order.table?.number) {
        if (!groups[tableKey]) groups[tableKey] = [];
        groups[tableKey].push(order);
      } else {
        noTableOrders.push(order);
      }
    }

    return { groups, noTableOrders };
  }, [filteredOrders]);

  const toggleTable = (tableKey: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) next.delete(tableKey);
      else next.add(tableKey);
      return next;
    });
  };

  const getTableTotal = (orders: Order[]) =>
    orders.reduce((sum, o) => sum + o.total_amount, 0);

  const getTableOrderCount = (orders: Order[]) => orders.length;

  const renderOrderButton = (order: Order) => (
    <button
      key={order.id}
      type="button"
      onClick={() => onSelect(order)}
      className="w-full flex items-center justify-between p-3 text-left border-t hover:bg-muted/40 transition-colors first:border-t-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {order.order_number}
          </span>
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 ${
              PAYMENT_BADGE[order.payment_status ?? "unpaid"] ?? ""
            }`}
          >
            {formatLabel(order.payment_status ?? "unpaid")}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground capitalize">
          {order.order_type.replace(/_/g, " ")}
          {` · ${customerDisplayName(order)}`}
        </p>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <p className="text-sm font-bold">
          {formatCurrency(order.total_amount)}
        </p>
        <p className="text-[10px] text-muted-foreground capitalize">
          {formatLabel(order.status)}
        </p>
      </div>
    </button>
  );

  const renderTableOrders = (tableKey: string, tableOrders: Order[]) => {
    const isExpanded = expandedTables.has(tableKey);
    const orderCount = tableOrders.length;
    const tableTotal = tableOrders.reduce((sum, o) => sum + o.total_amount, 0);

    return (
      <div key={tableKey} className="border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleTable(tableKey)}
          className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{tableKey}</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
              {tableOrders.length} order{tableOrders.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
              {formatCurrency(tableTotal)}
            </Badge>
          </div>
          <span className="text-muted-foreground">
            {expandedTables.has(tableKey) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t bg-card animate-in slide-in-from-top-2 duration-200">
            {tableOrders.map(renderOrderButton)}
          </div>
        )}
      </div>
    );
  };

  const renderNoTableOrders = () => {
    const noTableOrders = ordersByTable.noTableOrders;
    if (noTableOrders.length === 0) return null;

    const isExpanded = expandedTables.has("No Table Assigned");
    const orderCount = noTableOrders.length;
    const tableTotal = noTableOrders.reduce((sum, o) => sum + o.total_amount, 0);

    return (
      <div className="border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleTable("No Table Assigned")}
          className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">No Table Assigned</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
              {noTableOrders.length} order{noTableOrders.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
              {formatCurrency(noTableOrders.reduce((sum, o) => sum + o.total_amount, 0))}
            </Badge>
          </div>
          <span className="text-muted-foreground">
            {expandedTables.has("No Table Assigned") ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t bg-card animate-in slide-in-from-top-2 duration-200">
            {noTableOrders.map(renderOrderButton)}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <DialogBodySkeleton lines={4} />;
    }

    if (Object.keys(ordersByTable.groups).length === 0 && ordersByTable.noTableOrders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Receipt className="h-8 w-8 opacity-40" />
          <p className="text-sm">No served orders ready for payment</p>
        </div>
      );
    }

    return (
      <div>
        {Object.entries(ordersByTable.groups).map(([tableKey, tableOrders]) =>
          renderTableOrders(tableKey, tableOrders)
        )}
        {renderNoTableOrders()}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select an Order to Pay</DialogTitle>
          <DialogDescription>
            Only served orders with an unpaid balance appear here. Orders are grouped by table.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order # or customer..."
            className="pl-8"
          />
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}