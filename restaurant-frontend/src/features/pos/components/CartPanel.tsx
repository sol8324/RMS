"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Wallet,
  Send,
  FileText,
  ChevronRight,
  Receipt,
  Package,
} from "lucide-react";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  formatTableDisplay,
  tableSelectOptions,
  type TableSelectOption,
} from "@/lib/utils/orderDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CartItem as CartItemType } from "../types";
import type { Order, OrderType, Table as TableType } from "@/lib/types";
import { formatCurrency, formatLabel } from "@/lib/utils";
import { sortTablesByNumber } from "@/lib/utils/tableSort";
import { useTaxRate } from "@/features/settings/hooks/useSettings";
import { useTables, useUnpaidOrders } from "@/lib/hooks";

interface CartPanelProps {
  items: CartItemType[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  serviceChargeAmount: number;
  serviceChargePercent: number;
  totalAmount: number;
  itemCount: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onReport?: () => void;
  existingOrder?: Order | null;
  onSelectExistingOrder?: () => void;
  onClearExistingOrder?: () => void;
  onPayExisting?: () => void;
  onSelectTableOrder?: (orderId: string) => void;
  onAutoSelectTableOrder?: (orderId: string) => void;
  onServeOrder?: (orderType: OrderType, customerId?: string, tableId?: string) => void;
  onBillOut?: (orderType: OrderType, customerId?: string, tableId?: string) => void;
  /** Called when a table is selected - for auto-loading orders */
  onTableSelected?: (tableId: string, table: TableType) => void;
}

export function CartPanel({
  items,
  subtotal,
  discountAmount,
  vatAmount,
  serviceChargeAmount,
  serviceChargePercent,
  totalAmount,
  itemCount,
  onUpdateQuantity,
  onRemove,
  onUpdateNotes,
  onReport,
  existingOrder,
  onSelectExistingOrder,
  onClearExistingOrder,
  onPayExisting,
  onSelectTableOrder,
  onAutoSelectTableOrder,
  onServeOrder,
  onBillOut,
  onTableSelected,
}: CartPanelProps) {
  const taxRate = useTaxRate();
  const isPayingExisting = !!existingOrder;
  const { list: tablesList } = useTables();
  const tables = useMemo(() => tablesList.data ?? [], [tablesList.data]);
  const availableTables = useMemo(
    () =>
      sortTablesByNumber(
        tables.filter(
          (t) =>
            t.is_active !== false &&
            (t.status === "available" || t.status === "occupied")
        )
      ),
    [tables]
  );

  const { data: unpaidData } = useUnpaidOrders();
  const unpaidOrders = useMemo(() => {
    const all = (unpaidData?.data?.data ?? []) as Order[];
    return all.filter(
      (o) =>
        o.status === "served" &&
        (o.payment_status === "unpaid" || o.payment_status === "partial")
    );
  }, [unpaidData]);

  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const autoSelectedTableRef = useRef<string | null>(null);

  const isDineIn = orderType === "dine_in";
  const requiresTable = isDineIn && (onServeOrder || onBillOut);

  // Orders for currently selected table
  const tableOrders = useMemo(() => {
    if (!selectedTableId) return [];
    return unpaidOrders.filter((o) => o.table_id === selectedTableId);
  }, [unpaidOrders, selectedTableId]);

  const handleTableChange = (value: string | null) => {
    autoSelectedTableRef.current = null;
    setSelectedTableId(value || "");
    const table = tables.find((t) => t.id === (value || "")) ?? null;
    setSelectedTable(table);
    if (value && table) {
      onTableSelected?.(value, table);
    }
  };

  // Ensure selected table is always in dropdown options, even if its status changes
  const dropdownTables = useMemo(() => {
    const ids = new Set(availableTables.map((t) => t.id));
    if (selectedTableId && !ids.has(selectedTableId)) {
      const selected = tables.find((t) => t.id === selectedTableId);
      if (selected) return [selected, ...availableTables];
    }
    return availableTables;
  }, [availableTables, selectedTableId, tables]);

  const tableSelectItems = useMemo<TableSelectOption[]>(
    () => [
      { value: "", label: "No Table (Counter)" },
      ...tableSelectOptions(dropdownTables),
    ],
    [dropdownTables]
  );

  // Reveal the table's order automatically when there is exactly one payable
  // order. The ref prevents re-selecting it after the user clears the order.
  useEffect(() => {
    if (!selectedTableId || isPayingExisting || !onAutoSelectTableOrder) return;
    if (autoSelectedTableRef.current === selectedTableId) return;
    if (tableOrders.length !== 1) return;

    autoSelectedTableRef.current = selectedTableId;
    onAutoSelectTableOrder(tableOrders[0].id);
  }, [
    selectedTableId,
    tableOrders,
    isPayingExisting,
    onAutoSelectTableOrder,
  ]);

  const tableTotal = (orders: Order[]) =>
    orders.reduce((sum, o) => sum + o.total_amount, 0);

  const selectedTableDisplay = selectedTable ? formatTableDisplay(selectedTable) : "";

  return (
    <div className="flex h-full flex-col border-l bg-card">
      {/* Header */}
            <div className="shrink-0 border-b px-3 py-2.5 bg-card/95 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {isPayingExisting ? "Pay Existing Order" : "New Order"}
                </h2>
                <div className="flex items-center gap-1.5">
                  {!isPayingExisting && itemCount > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {!isPayingExisting && onSelectExistingOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSelectExistingOrder}
                      className="h-7 text-xs"
                    >
                      <Wallet className="h-3 w-3 mr-1" />
                      Pay Existing
                    </Button>
                  )}
                </div>
              </div>
            </div>

      {/* Existing Order View */}
      {isPayingExisting && existingOrder ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Order Header */}
          <div className="shrink-0 border-b bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{existingOrder.order_number}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1.5 py-0 ${
                        existingOrder.order_type === "dine_in"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                    >
                      {existingOrder.order_type === "dine_in" ? "Dine In" : "Takeaway"}
                    </Badge>
                    {(existingOrder.table || existingOrder.table_number) && (
                      <span>· {existingOrder.table ? formatTableDisplay(existingOrder.table) : `Table ${existingOrder.table_number}`}</span>
                    )}
                    {existingOrder.customer && (
                      <span>· {existingOrder.customer.name}</span>
                    )}
                  </div>
                  {existingOrder.notes && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span className="text-[10px]">📝</span>
                      {existingOrder.notes}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {formatLabel(existingOrder.payment_status ?? "unpaid")}
              </Badge>
            </div>
          </div>

          {/* Order Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {existingOrder.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border bg-background/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.name ?? item.menu_item_name ?? "Unnamed item"}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                </div>
                <p className="text-xs text-right text-muted-foreground mt-1">
                  {formatCurrency(item.total_amount)}
                </p>
                {item.notes && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Order Summary & Actions */}
          <div className="shrink-0 border-t p-4 space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(existingOrder.subtotal)}</span>
              </div>
              {existingOrder.discount_amount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>{existingOrder.applied_discount?.name ?? "Discount"}</span>
                  <span>-{formatCurrency(existingOrder.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">VATable Sales</span>
                <span>
                  {formatCurrency(
                    Math.max(0, existingOrder.total_amount - existingOrder.tax_amount)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({taxRate}%)</span>
                <span>{formatCurrency(existingOrder.tax_amount)}</span>
              </div>
              {existingOrder.service_charge > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span>{formatCurrency(existingOrder.service_charge)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(existingOrder.total_amount)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {onClearExistingOrder && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 flex-1"
                  onClick={onClearExistingOrder}
                >
                  Change Order
                </Button>
              )}
              <Button
                size="lg"
                className="h-11 flex-[2] text-base font-bold"
                onClick={onPayExisting}
              >
                Pay {formatCurrency(existingOrder.total_amount)}
              </Button>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Order Type & Table Selection */}
          {(onServeOrder || onBillOut) && (
            <div className="shrink-0 border-b p-3 bg-muted/20">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Type:</span>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine_in">Dine In</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requiresTable && dropdownTables.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Table:</span>
                    <Select
                      items={tableSelectItems}
                      value={selectedTableId}
                      onValueChange={handleTableChange}
                    >
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tableSelectItems.map((item) => (
                          <SelectItem
                            key={item.value || "counter"}
                            value={item.value}
                            className="truncate"
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isDineIn && !selectedTableId && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Required
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Show existing orders for selected table */}
              {selectedTable && tableOrders.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Active Orders for {selectedTableDisplay}
                  </p>
                  {tableOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => onSelectTableOrder?.(order.id)}
                      className="w-full flex items-center justify-between p-2.5 text-left rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">{order.order_number}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] px-1.5 py-0 ${
                            order.payment_status === "partial"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {formatLabel(order.payment_status ?? "unpaid")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-right shrink-0">
                        <span className="text-sm font-bold">{formatCurrency(order.total_amount)}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                  <p className="text-xs text-muted-foreground mt-1">
                    Table total: {formatCurrency(tableTotal(tableOrders))}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs">Tap a product to add</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Order Type & Table Selection - compact horizontal row */}
          {(onServeOrder || onBillOut) && (
            <div className="shrink-0 border-b p-3 bg-muted/20">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Type:</span>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine_in">Dine In</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requiresTable && dropdownTables.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Table:</span>
                    <Select
                      items={tableSelectItems}
                      value={selectedTableId}
                      onValueChange={handleTableChange}
                    >
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tableSelectItems.map((item) => (
                          <SelectItem
                            key={item.value || "counter"}
                            value={item.value}
                            className="truncate"
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isDineIn && !selectedTableId && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Required
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Show existing orders for selected table */}
              {selectedTable && tableOrders.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Active Orders for {selectedTableDisplay}
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      Total: {formatCurrency(tableTotal(tableOrders))}
                    </p>
                  </div>
                  {tableOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => onSelectTableOrder?.(order.id)}
                      className="w-full flex items-center justify-between p-2.5 text-left rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{order.order_number}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 ${
                              order.payment_status === "partial"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            {formatLabel(order.payment_status ?? "unpaid")}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 ${
                              order.order_type === "dine_in"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}
                          >
                            {order.order_type === "dine_in" ? "Dine In" : "Takeaway"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                          <Package className="h-2.5 w-2.5" />
                          {(order.items || []).slice(0, 2).map((i, idx) => (
                            <span key={idx}>
                              {i.name ?? i.menu_item_name ?? "Item"} × {i.quantity}
                            </span>
                          ))}
                          {(order.items || []).length > 2 && (
                            <span>+{(order.items || []).length - 2} more</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <span className="text-sm font-bold">{formatCurrency(order.total_amount)}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 ml-auto" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemove}
                onUpdateNotes={onUpdateNotes}
              />
            ))}
          </div>

          {/* Cart Summary & Actions */}
          <div className="shrink-0 border-t p-4 space-y-4">
            <CartSummary
              subtotal={subtotal}
              discountAmount={discountAmount}
              vatAmount={vatAmount}
              serviceChargeAmount={serviceChargeAmount}
              serviceChargePercent={serviceChargePercent}
              totalAmount={totalAmount}
            />

            {/* Waiter: Serve Order */}
            {onServeOrder && (
              <Button
                size="lg"
                className="w-full h-11 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
                disabled={requiresTable && !selectedTableId}
                onClick={() => onServeOrder(orderType, undefined, selectedTableId || undefined)}
              >
                <Send className="h-4 w-4 mr-2" />
                Serve Order
              </Button>
            )}

            {/* Cashier: Bill Out */}
            {onBillOut && (
              <Button
                size="lg"
                className="w-full h-11 text-base font-bold bg-blue-600 hover:bg-blue-700"
                disabled={requiresTable && !selectedTableId}
                onClick={() => onBillOut(orderType, undefined, selectedTableId || undefined)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Bill Out
              </Button>
            )}

            {/* Fallback */}
            {!onServeOrder && !onBillOut && (
              <div className="text-center py-3">
                <p className="text-xs text-muted-foreground">
                  Place and serve this cart through Orders, then use Pay Existing.
                </p>
              </div>
            )}

            {onReport && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-11 text-base font-medium"
                onClick={onReport}
              >
                Revenue Report
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}