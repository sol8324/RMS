"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared";
import { formatCurrency } from "@/lib/utils";
import { sortTablesByNumber } from "@/lib/utils/tableSort";
import type { PaymentLine } from "../types";
import type { PaymentMethod } from "@/lib/types";
import type { Customer } from "@/lib/types";
import type { Table } from "@/lib/types";
import type { OrderType } from "@/lib/types";
import type { Order } from "@/lib/types";
import { useCustomers } from "@/lib/hooks";
import { useTables } from "@/lib/hooks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaxRate } from "@/features/settings/hooks/useSettings";
import { customerDisplayName, tableDisplayName } from "@/lib/utils/orderDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StatutoryDiscountType =
  | "senior_citizen"
  | "pwd"
  | null;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  discountAmount: number;
  vatAmount: number;
  serviceChargeAmount: number;
  subtotal: number;
  onProcessPayment: (
    payments: PaymentLine[],
    orderType: OrderType,
    customerId?: string,
    tableId?: string,
    statutoryDiscount?: {
      type: StatutoryDiscountType;
      reference: string;
      name?: string;
      qualifiedAmount: number;
    }
  ) => void;
  isProcessing: boolean;
  existingOrder?: Order | null;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "cash", label: "Cash", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M12 2v20M17 5H7M17 19H7"/><path d="M5 13h14"/><path d="M15 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg> },
  { value: "card", label: "Card", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="15" y1="14" x2="22" y2="14"/></svg> },
  { value: "e_wallet", label: "E-Wallet", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/><path d="M9 10h.01M15 10h.01"/></svg> },
];

const EWALLET_PROVIDERS = ["GCash", "Maya", "GrabPay", "Other"];

/**
 * Single-tender payment dialog — one order, one payment, one method.
 * Split payment is intentionally deferred for UAT simplicity.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  discountAmount,
  vatAmount,
  serviceChargeAmount,
  subtotal,
  onProcessPayment,
  isProcessing,
  existingOrder,
}: PaymentDialogProps) {
  const taxRate = useTaxRate();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [provider, setProvider] = useState<string>("GCash");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [customerId, setCustomerId] = useState<string>("");
  const [tableId, setTableId] = useState<string>("");

  const { list: customersList } = useCustomers({ per_page: 100 });
  const { list: tablesList } = useTables();

  const customers = customersList.data?.data?.data ?? [];
  const tables = tablesList.data ?? [];
  const availableTables = sortTablesByNumber(
    tables.filter((t) => t.status === "available")
  );

  const isCash = method === "cash";

  // Statutory discount state
  const [statutoryDiscountType, setStatutoryDiscountType] = useState<StatutoryDiscountType>(null);
  const [statutoryDiscountReference, setStatutoryDiscountReference] = useState<string>("");
  const [statutoryDiscountName, setStatutoryDiscountName] = useState<string>("");
  const [qualifiedAmount, setQualifiedAmount] = useState<string>("");
  // Cash: guest hands over `amountReceived`; card/e-wallet charge exact total.
  const tendered = isCash ? Number(amountReceived || 0) : totalAmount;
  const change = isCash && tendered >= totalAmount ? Math.round((tendered - totalAmount) * 100) / 100 : 0;

  // Can process: not processing AND (if cash, has sufficient amount; otherwise always true)
  const canProcess = useMemo(
    () =>
      !isProcessing &&
      (isCash
        ? amountReceived !== "" && tendered >= totalAmount - 0.001
        : true),
    [isProcessing, isCash, amountReceived, tendered, totalAmount]
  );

  // Memoize change display (only show when positive)
  const changeDisplay = useMemo(() => {
    if (!isCash || change <= 0) return null;
    return change;
  }, [isCash, change]);

  // Memoize insufficient state
  const isInsufficient = useMemo(
    () => isCash && amountReceived !== "" && tendered < totalAmount - 0.001,
    [isCash, amountReceived, tendered, totalAmount]
  );

  // Memoize tendered amount
  const tenderedAmount = useMemo(() => (isCash ? tendered : totalAmount), [isCash, tendered, totalAmount]);

  useEffect(() => {
    if (open) {
      // Reset form state each time the dialog opens. This is a legitimate
      // reset-on-open pattern; the synchronous setState is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMethod("cash");
      setAmountReceived("");
      setReference("");
      setProvider("GCash");
      setOrderType(
        existingOrder
          ? (existingOrder.order_type as OrderType)
          : "dine_in"
      );
      setCustomerId(existingOrder?.customer_id ?? "");
      setTableId(existingOrder?.table_id ?? "");
      setStatutoryDiscountType(null);
      setStatutoryDiscountReference("");
      setStatutoryDiscountName("");
      setQualifiedAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleProcess() {
    if (!canProcess) return;
    const line: PaymentLine = {
      id: crypto.randomUUID(),
      method,
      amount: Math.round(tenderedAmount * 100) / 100,
      reference:
        method === "card"
          ? reference || undefined
          : method === "e_wallet"
            ? `${provider}${reference ? ` · ${reference}` : ""}`
            : undefined,
    };

    const statutoryDiscount = statutoryDiscountType !== null && qualifiedAmount !== ""
      ? {
          type: statutoryDiscountType,
          reference: statutoryDiscountReference,
          name: statutoryDiscountName || undefined,
          qualifiedAmount: parseFloat(qualifiedAmount) || 0,
        }
      : undefined;

    onProcessPayment(
      [line],
      orderType,
      customerId || undefined,
      orderType === "dine_in" ? tableId || undefined : undefined,
      statutoryDiscount
    );
  }

  // Payment breakdown rows
  const breakdownRows = useMemo(() => {
    const rows: { label: string; value: string; variant?: "default" | "destructive" | "muted" }[] = [
      { label: "Subtotal", value: formatCurrency(subtotal), variant: "muted" },
    ];

    if (discountAmount > 0) {
      rows.push({ label: "Discount", value: formatCurrency(discountAmount), variant: "destructive" });
    }

    // For Philippine VAT-inclusive pricing, show VAT separately but not VATable Sales
    if (vatAmount > 0) {
      rows.push({ label: `VAT (${taxRate}%, inclusive)`, value: formatCurrency(vatAmount), variant: "muted" });
    }

    if (serviceChargeAmount > 0) {
      rows.push({ label: "Service Charge", value: formatCurrency(serviceChargeAmount), variant: "muted" });
    }

    return rows;
  }, [subtotal, discountAmount, vatAmount, serviceChargeAmount, taxRate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">Process Payment</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">
          {/* Order Context Section */}
          {existingOrder ? (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="text-sm font-medium text-foreground">Order Details</h4>
              <p className="text-sm text-muted-foreground">
                {existingOrder.order_number} · {existingOrder.order_type.replace("_", " ")}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span>Customer:</span>
                <span>{customerDisplayName(existingOrder)}</span>
                {tableDisplayName(existingOrder) && (
                  <> · Table {tableDisplayName(existingOrder).replace("T", "T")}</>
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4 space-y-4">
              <h4 className="text-sm font-medium text-foreground">Order Details</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => v && setOrderType(v as OrderType)}>
                    <SelectTrigger className="h-9 flex-1 min-w-0">
                      <SelectValue placeholder="Select order type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine_in">Dine In</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                    <SelectTrigger className="h-9 flex-1 min-w-0">
                      <SelectValue placeholder="Walk-in Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Walk-in Customer</SelectItem>
                      {customers.map((c: Customer) => (
                        <SelectItem key={c.id} value={c.id} className="truncate">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {orderType === "dine_in" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Table (optional)</Label>
                    <Select value={tableId} onValueChange={(v) => setTableId(v ?? "")}>
                      <SelectTrigger className="h-9 flex-1 min-w-0">
                        <SelectValue placeholder="Select Table" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Table</SelectItem>
                        {availableTables.map((t: Table) => (
                          <SelectItem key={t.id} value={t.id} className="truncate">
                            Table {t.number} ({t.capacity} seats)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Breakdown */}
          <div className="rounded-lg bg-card border p-4 space-y-3">
            <h4 className="text-sm font-medium text-foreground">Payment Breakdown</h4>
            <div className="space-y-2">
              {breakdownRows.map((row, index) => (
                <div
                  key={index}
                  className={`flex justify-between text-sm ${
                    row.variant === "destructive"
                      ? "text-destructive"
                      : row.variant === "muted"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  <span>{row.label}</span>
                  <span className="font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-xl font-bold text-foreground">
                <span>Total Due</span>
                <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Statutory Discount (Senior Citizen / PWD) */}
          <div className="rounded-lg bg-card border p-4 space-y-3">
            <h4 className="text-sm font-medium text-foreground">Statutory Discount</h4>
            <p className="text-xs text-muted-foreground">
              Apply 20% Senior Citizen or PWD discount on qualified VAT-exempt portion.
              Reference (OSCA/PWD ID) required.
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Discount Type</Label>
                <Select value={statutoryDiscountType ?? ""} onValueChange={(v) => setStatutoryDiscountType(v as StatutoryDiscountType)}>
                  <SelectTrigger className="h-9 flex-1 min-w-0">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="senior_citizen">Senior Citizen (20%)</SelectItem>
                    <SelectItem value="pwd">PWD (20%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {statutoryDiscountType !== null && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="statutory-ref" className="text-sm font-medium">
                      Reference / ID No. <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="statutory-ref"
                      value={statutoryDiscountReference}
                      onChange={(e) => setStatutoryDiscountReference(e.target.value)}
                      placeholder="OSCA ID / PWD ID Number"
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="statutory-name" className="text-sm font-medium">
                      Name on ID (optional)
                    </Label>
                    <Input
                      id="statutory-name"
                      value={statutoryDiscountName}
                      onChange={(e) => setStatutoryDiscountName(e.target.value)}
                      placeholder="Name as it appears on ID"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="qualified-amount" className="text-sm font-medium">
                      Qualified Amount <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                      <Input
                        id="qualified-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        max={subtotal - discountAmount}
                        value={qualifiedAmount}
                        onChange={(e) => setQualifiedAmount(e.target.value)}
                        placeholder="Eligible amount for discount"
                        aria-required="true"
                        className="pl-7 h-11 text-base"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maximum: {formatCurrency(subtotal - discountAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Payment Method</h4>
              <span className="text-xs text-muted-foreground">
                {method === "cash" ? "Cash payment" : method === "card" ? "Card payment" : "E-Wallet payment"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Select payment method">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={`
                    relative flex flex-col items-center justify-center gap-2
                    rounded-xl border-2 p-4 text-sm font-medium transition-all min-h-[80px]
                    ${
                      method === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                    }
                  `}
                >
                  <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                  <span className="font-medium">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Cash-specific fields */}
            {isCash && (
              <div className="space-y-3 rounded-lg bg-muted/30 p-4 border" aria-labelledby="cash-heading">
                <h4 id="cash-heading" className="text-sm font-medium text-foreground">Cash Payment</h4>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cash-received" className="text-sm font-medium">
                      Amount Received <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                      <Input
                        id="cash-received"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="Enter amount received"
                        aria-invalid={isInsufficient}
                        aria-describedby={isInsufficient ? "cash-error" : undefined}
                        className={`pl-7 h-11 text-base ${
                          isInsufficient ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
                        autoFocus
                      />
                    </div>
                    {isInsufficient && (
                      <p id="cash-error" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Insufficient amount. Minimum: {formatCurrency(totalAmount)}
                      </p>
                    )}
                  </div>

                  {changeDisplay !== null && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between" role="status" aria-live="polite">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="font-medium">Change</span>
                      </div>
                      <span className="text-xl font-bold text-emerald-600 tabular-nums">{formatCurrency(changeDisplay)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* E-Wallet specific fields */}
            {method === "e_wallet" && (
              <div className="space-y-3 rounded-lg bg-muted/30 p-4 border" aria-labelledby="ewallet-heading">
                <h4 id="ewallet-heading" className="text-sm font-medium text-foreground">E-Wallet Details</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium" htmlFor="ewallet-provider">Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v ?? "GCash")}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EWALLET_PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium" htmlFor="ewallet-ref">Reference Number</Label>
                    <Input
                      id="ewallet-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Transaction ID / Reference"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Amount charged: <strong>{formatCurrency(totalAmount)}</strong> (exact bill total)
                </p>
              </div>
            )}

            {/* Card specific fields */}
            {method === "card" && (
              <div className="space-y-3 rounded-lg bg-muted/30 p-4 border" aria-labelledby="card-heading">
                <h4 id="card-heading" className="text-sm font-medium text-foreground">Card Payment</h4>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium" htmlFor="card-ref">Reference Number</Label>
                    <Input
                      id="card-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Last 4 digits / Approval code"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Amount charged: <strong>{formatCurrency(totalAmount)}</strong> (exact bill total)
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={!canProcess || isProcessing}
            className="min-w-[160px]"
            aria-busy={isProcessing}
          >
            {isProcessing && (
              <>
                <LoadingSpinner size="sm" className="mr-2" aria-hidden="true" />
                Processing...
              </>
            )}
            {!isProcessing && "Process Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
