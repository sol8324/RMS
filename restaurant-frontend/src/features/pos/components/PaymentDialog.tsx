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
import type { OrderType } from "@/lib/types";
import type { Order } from "@/lib/types";
import { useCustomers } from "@/lib/hooks";
import { useTables } from "@/lib/hooks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaxRate } from "@/features/settings/hooks/useSettings";
import { useActivePaymentMethods } from "@/features/settings/hooks/useSettings";
import { useAuth } from "@/providers/AuthProvider";
import {
  customerDisplayName,
  formatTableDisplay,
  tableSelectOptions,
} from "@/lib/utils/orderDisplay";
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
  const { user } = useAuth();
  const { cash, card, e_wallet, e_bank } = useActivePaymentMethods();

  // Build dynamic payment methods based on admin settings and user role
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const isCashier = user?.role === "cashier";

  // Cashier and admin see all enabled methods
  // Waiter sees enabled methods (for reference, but they don't process payments)
  const paymentMethods = useMemo(() => {
    const methods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [];

    if (cash) {
      methods.push({
        value: "cash",
        label: "Cash",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M12 2v20M17 5H7M17 19H7"/><path d="M5 13h14"/><path d="M15 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>,
      });
    }
    if (card) {
      methods.push({
        value: "card",
        label: "Card",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="15" y1="14" x2="22" y2="14"/></svg>,
      });
    }
    if (e_wallet) {
      methods.push({
        value: "e_wallet",
        label: "E-Wallet",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/><path d="M9 10h.01M15 10h.01"/></svg>,
      });
    }
    if (e_bank && (isAdminOrManager || isCashier)) {
      // E-Bank only for admin/cashier (backend processing)
      methods.push({
        value: "e_wallet", // Use e_wallet as fallback since backend only supports cash, card, e_wallet
        label: "E-Bank",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>,
      });
    }

    return methods;
  }, [cash, card, e_wallet, e_bank, isAdminOrManager, isCashier]);

  const [method, setMethod] = useState<PaymentMethod>(() => {
    if (cash) return "cash";
    if (card) return "card";
    if (e_wallet) return "e_wallet";
    return "cash";
  });
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
  const tableSelectItems = useMemo(
    () => [
      { value: "", label: "No Table" },
      ...tableSelectOptions(availableTables),
    ],
    [availableTables]
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
      setMethod(paymentMethods[0]?.value ?? "cash");
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
  }, [open, paymentMethods]);

  function handleProcess() {
    if (!canProcess) return;
    const backendMethod = method;
    const line: PaymentLine = {
      id: crypto.randomUUID(),
      method: backendMethod,
      amount: Math.round(tenderedAmount * 100) / 100,
      reference:
        backendMethod === "card"
          ? reference || undefined
          : backendMethod === "e_wallet"
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
      <DialogContent className="sm:max-w-md w-[calc(100vw-16px)] max-h-[min(92dvh,640px)] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">Process Payment</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3">
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
                {existingOrder.table && (
                  <> · {formatTableDisplay(existingOrder.table)}</>
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
                    <Select
                      items={tableSelectItems}
                      value={tableId}
                      onValueChange={(v) => setTableId(v ?? "")}
                    >
                      <SelectTrigger className="h-9 flex-1 min-w-0">
                        <SelectValue placeholder="Select Table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tableSelectItems.map((item) => (
                          <SelectItem
                            key={item.value || "none"}
                            value={item.value}
                            className="truncate"
                          >
                            {item.label}
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
          <div className="rounded-md border px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-foreground">Bill Summary</h4>
            </div>
            <div className="space-y-1 text-xs">
              {breakdownRows.map((row, index) => (
                <div
                  key={index}
                  className={`flex justify-between ${
                    row.variant === "destructive"
                      ? "text-destructive"
                      : row.variant === "muted"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.value}</span>
                </div>
              ))}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Total Due</span>
                <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Statutory Discount (Senior Citizen / PWD) */}
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-foreground">Statutory Discount</h4>
              <span className="text-[11px] text-muted-foreground">SC/PWD (20%)</span>
            </div>
            <div className="space-y-1.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Discount Type</Label>
                <Select value={statutoryDiscountType ?? ""} onValueChange={(v) => setStatutoryDiscountType(v as StatutoryDiscountType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="senior_citizen">Senior Citizen</SelectItem>
                    <SelectItem value="pwd">PWD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {statutoryDiscountType !== null && (
                <div className="space-y-1.5">
                  <div className="space-y-1">
                    <Label htmlFor="statutory-ref" className="text-[11px]">
                      Reference / ID No. <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="statutory-ref"
                      value={statutoryDiscountReference}
                      onChange={(e) => setStatutoryDiscountReference(e.target.value)}
                      placeholder="OSCA/PWD ID"
                      aria-required="true"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="statutory-name" className="text-[11px]">Name on ID (optional)</Label>
                    <Input
                      id="statutory-name"
                      value={statutoryDiscountName}
                      onChange={(e) => setStatutoryDiscountName(e.target.value)}
                      placeholder="Name"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="qualified-amount" className="text-[11px]">
                      Qualified Amount <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                      <Input
                        id="qualified-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        max={subtotal - discountAmount}
                        value={qualifiedAmount}
                        onChange={(e) => setQualifiedAmount(e.target.value)}
                        placeholder="Eligible amount"
                        aria-required="true"
                        className="pl-6 h-8 text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Max: {formatCurrency(subtotal - discountAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-foreground">Payment Method</h4>
              <span className="text-[11px] text-muted-foreground">
                {method === "cash" ? "Cash" : method === "card" ? "Card" : method === "e_wallet" ? "E-Wallet" : "E-Bank"}
              </span>
            </div>
            <div className={`grid grid-cols-${paymentMethods.length || 1} gap-1.5`} role="radiogroup" aria-label="Select payment method">
              {paymentMethods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={`
                    relative flex items-center justify-center gap-1.5
                    rounded-md border px-2 py-1.5 text-xs font-medium transition-all
                    ${
                      method === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                    }
                  `}
                >
                  <span className="h-4 w-4" aria-hidden="true">{m.icon}</span>
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
              <div className="space-y-2 rounded-md bg-muted/30 p-2.5 border" aria-labelledby="ewallet-heading">
                <h4 id="ewallet-heading" className="text-xs font-medium text-foreground">E-Wallet Details</h4>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]" htmlFor="ewallet-provider">Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v ?? "GCash")}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EWALLET_PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]" htmlFor="ewallet-ref">Reference No.</Label>
                    <Input
                      id="ewallet-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Reference"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Amount: {formatCurrency(totalAmount)}
                </p>
              </div>
            )}

            {/* Card specific fields */}
            {method === "card" && (
              <div className="space-y-2 rounded-md bg-muted/30 p-2.5 border" aria-labelledby="card-heading">
                <h4 id="card-heading" className="text-xs font-medium text-foreground">Card Payment</h4>
                <div className="space-y-1">
                  <Label className="text-[11px]" htmlFor="card-ref">Reference No. / Approval Code</Label>
                  <Input
                    id="card-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Reference"
                    className="h-8 text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Amount: {formatCurrency(totalAmount)}
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-4 py-2.5 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="min-w-[80px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleProcess}
            disabled={!canProcess || isProcessing}
            className="min-w-[130px]"
            aria-busy={isProcessing}
          >
            {isProcessing && (
              <>
                <LoadingSpinner size="sm" className="mr-1.5" aria-hidden="true" />
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
