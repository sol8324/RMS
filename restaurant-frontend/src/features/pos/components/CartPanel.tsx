"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart, Wallet } from "lucide-react";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { CartItem as CartItemType } from "../types";
import type { Order } from "@/lib/types";
import { formatCurrency, formatLabel } from "@/lib/utils";
import { useTaxRate } from "@/features/settings/hooks/useSettings";

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
}: CartPanelProps) {
  const taxRate = useTaxRate();
  const isPayingExisting = !!existingOrder;

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="shrink-0 border-b px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {isPayingExisting ? "Pay Existing Order" : "Cart"}
          </h2>
          {!isPayingExisting && itemCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {itemCount}
            </span>
          )}
          {!isPayingExisting && onSelectExistingOrder && (
            <Button
              variant="outline"
              size="xs"
              onClick={onSelectExistingOrder}
            >
              <Wallet className="h-3.5 w-3.5 mr-1" />
              Pay Existing
            </Button>
          )}
        </div>
      </div>

      {isPayingExisting && existingOrder ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {existingOrder.order_number}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {existingOrder.order_type.replace(/_/g, " ")}
                  {existingOrder.table
                    ? ` · Table ${existingOrder.table.number}`
                    : ""}
                  {existingOrder.customer
                    ? ` · ${existingOrder.customer.name}`
                    : ""}
                </p>
                {existingOrder.notes && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <span className="text-[10px]">📝</span>
                    {existingOrder.notes}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {formatLabel(existingOrder.payment_status ?? "unpaid")}
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {existingOrder.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border bg-background p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.name ?? item.menu_item_name ?? "Unnamed item"}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                </div>
                <p className="text-xs text-right text-muted-foreground">
                  {formatCurrency(item.total_amount)}
                </p>
                {item.notes && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <span className="text-[10px]">📝</span>
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t p-3 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(existingOrder.subtotal)}</span>
              </div>
              {existingOrder.discount_amount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>{existingOrder.applied_discount?.name ?? "Discount / Promotion"}</span>
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
                  className="h-11 flex-1"
                  onClick={onClearExistingOrder}
                >
                  Change
                </Button>
              )}
              <Button
                className="h-11 flex-[2] text-base font-bold"
                onClick={onPayExisting}
              >
                Pay {formatCurrency(existingOrder.total_amount)}
              </Button>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <ShoppingCart className="h-8 w-8" />
          <p className="text-sm">Cart is empty</p>
          <p className="text-xs">Tap a product to add</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
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

          <div className="shrink-0 border-t p-3 space-y-3">
            <CartSummary
              subtotal={subtotal}
              discountAmount={discountAmount}
              vatAmount={vatAmount}
              serviceChargeAmount={serviceChargeAmount}
              serviceChargePercent={serviceChargePercent}
              totalAmount={totalAmount}
            />

            <Button
              className="w-full h-11 text-base font-bold"
              disabled
            >
              Serve Order Before Payment
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Place and serve this cart through Orders, then use Pay Existing.
            </p>

            {onReport && (
              <Button
                variant="outline"
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
