"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  usePosCart,
  PosHeader,
  ProductGrid,
  CartPanel,
  PaymentDialog,
  ReceiptDialog,
  ExistingOrderDialog,
  PaymentMethodDisplay,
} from "@/features/pos";
import { useOrders, useOrder } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { canAccessRevenueReport } from "@/lib/utils/permissions";
import type { MenuItem, OrderType, Order } from "@/lib/types";
import type { PaymentLine as PosPaymentLine, CartItemType } from "@/features/pos";
import type { StatutoryDiscountType } from "@/features/pos/components/PaymentDialog";
import type { PaymentFormData, OrderFormData, OrderItemFormData } from "@/lib/types";

export default function PosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const cart = usePosCart();
  const { addPayment, create: createOrder, updateStatus } = useOrders();

  const isWaiter = user?.role === "waiter";
  const isCashier = user?.role === "cashier";
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  // Waiters can create/serve orders
  const canServe = isWaiter || isAdmin;
  // Cashiers can bill out (create order) and process payments
  const canBillOut = isCashier || isAdmin;
  // Cashiers and admins can process payments
  const canProcessPayments = isCashier || isAdmin;

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [existingDialogOpen, setExistingDialogOpen] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const { data: existingOrderData } = useOrder(existingOrderId ?? "");
  const existingOrder: Order | null = existingOrderId
    ? existingOrderData ?? null
    : null;

  const [completedOrderNumber, setCompletedOrderNumber] = useState("");
  const [completedPayments, setCompletedPayments] = useState<PosPaymentLine[]>([]);
  const [completedOrderType, setCompletedOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedTableNumber, setCompletedTableNumber] = useState("");
  const [completedDiscountName, setCompletedDiscountName] = useState<string | undefined>();
  // Statutory discount fields for receipt
  const [completedStatutoryDiscountType, setCompletedStatutoryDiscountType] = useState<"senior_citizen" | "pwd" | null>(null);
  const [completedStatutoryDiscountName, setCompletedStatutoryDiscountName] = useState<string | undefined>();
  const [completedStatutoryDiscountAmount, setCompletedStatutoryDiscountAmount] = useState<number>(0);
  const [completedQualifiedAmount, setCompletedQualifiedAmount] = useState<number>(0);
  const [completedVatExemptSales, setCompletedVatExemptSales] = useState<number>(0);
  // Server-computed figures captured at payment time so the receipt always
  // mirrors the recorded transaction/invoice instead of client cart math.
  const [completedItems, setCompletedItems] = useState<CartItemType[]>([]);
  const [completedTotals, setCompletedTotals] = useState<{
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    serviceChargeAmount: number;
    totalAmount: number;
  } | null>(null);
  // For partial settlements (existing orders): the balance being paid now and
  // what was already paid before this session.
  const [completedDue, setCompletedDue] = useState<number | undefined>(undefined);
  const [completedPrevPaid, setCompletedPrevPaid] = useState<number | undefined>(undefined);

  function resetCompletedTransaction() {
    setCompletedOrderNumber("");
    setCompletedPayments([]);
    setCompletedItems([]);
    setCompletedTotals(null);
    setCompletedDiscountName(undefined);
    setCompletedStatutoryDiscountType(null);
    setCompletedStatutoryDiscountName(undefined);
    setCompletedStatutoryDiscountAmount(0);
    setCompletedQualifiedAmount(0);
    setCompletedVatExemptSales(0);
    setCompletedDue(undefined);
    setCompletedPrevPaid(undefined);
  }

  const handleAddToCart = useCallback(
    (item: MenuItem) => {
      cart.addItem({
        id: crypto.randomUUID(),
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
      });
      toast.success(`Added ${item.name}`);
    },
    [cart]
  );

  async function payExistingOrder(
    payments: PosPaymentLine[],
    statutoryDiscount?: {
      type: StatutoryDiscountType;
      reference: string;
      name?: string;
      qualifiedAmount: number;
    }
  ) {
    if (!existingOrder) return;
    const orderId = existingOrder.id;
    const backendTotal = existingOrder.total_amount;
    const alreadyPaid = (existingOrder.payments ?? []).reduce(
      (sum, p) => sum + (p.amount ?? 0),
      0
    );
    const dueNow = Math.max(
      0,
      Math.round((backendTotal - alreadyPaid) * 100) / 100
    );

    setCompletedCustomerName(existingOrder.customer?.name ?? "");
    setCompletedTableNumber(existingOrder.table?.number ?? "");
    setCompletedItems(
      (existingOrder.items ?? []).map((i) => ({
        id: i.id,
        menu_item_id: i.menu_item_id,
        name: i.name ?? i.menu_item_name ?? "Unnamed item",
        price: i.unit_price,
        quantity: i.quantity,
      }))
    );
    setCompletedTotals({
      subtotal: existingOrder.subtotal,
      discountAmount: existingOrder.discount_amount ?? 0,
      vatAmount: existingOrder.tax_amount ?? 0,
      serviceChargeAmount: existingOrder.service_charge ?? 0,
      totalAmount: backendTotal,
    });
    setCompletedDiscountName(existingOrder.applied_discount?.name);
    
    // Capture statutory discount data for receipt
    setCompletedStatutoryDiscountType(existingOrder.statutory_discount_type ?? null);
    setCompletedStatutoryDiscountName(existingOrder.statutory_discount_name);
    setCompletedStatutoryDiscountAmount(existingOrder.statutory_discount_amount ?? 0);
    setCompletedQualifiedAmount(existingOrder.qualified_amount ?? 0);
    setCompletedVatExemptSales(existingOrder.vat_exempt_sales ?? 0);
    
    setCompletedDue(dueNow);
    setCompletedPrevPaid(alreadyPaid);

    // Single payment settles the remaining balance. The dialog already emits
    // the exact due for card/e-wallet and the full tendered amount for cash.
    const payment = payments[0];
    const paymentData: PaymentFormData = {
      payment_method: payment.method,
      amount: Math.round(payment.amount * 100) / 100,
      reference: payment.reference,
    };

    if (statutoryDiscount) {
      paymentData.statutory_discount_type = statutoryDiscount.type;
      paymentData.statutory_discount_reference = statutoryDiscount.reference;
      paymentData.statutory_discount_name = statutoryDiscount.name;
      paymentData.qualified_amount = statutoryDiscount.qualifiedAmount;
    }

    await addPayment.mutateAsync({
      id: orderId,
      data: paymentData,
    });

    setCompletedOrderNumber(existingOrder.order_number);
    setCompletedPayments(payments);
    setCompletedOrderType(
      existingOrder.order_type as "dine_in" | "takeaway"
    );
    setExistingOrderId(null);
    setPaymentOpen(false);
    setReceiptOpen(true);
    toast.success("Payment processed successfully");
  }

  async function handleProcessPayment(
    payments: PosPaymentLine[],
    _orderType: OrderType,
    _customerId?: string,
    _tableId?: string,
    statutoryDiscount?: {
      type: StatutoryDiscountType;
      reference: string;
      name?: string;
      qualifiedAmount: number;
    }
  ) {
    try {
      const validPayments = payments.filter((p) => p.amount > 0);
      if (validPayments.length === 0) return;

      // POS is an EXISTING-order settlement screen. It must NEVER create a new
      // restaurant order — order creation belongs to the Waiter/Orders workflow.
      // The cart's Pay button is intentionally disabled until an existing
      // served/unpaid order is loaded (see CartPanel), so reaching this guard
      // is defensive only and must not spawn an orphan Pending Order.
      if (!existingOrder) {
        toast.error("Load an existing served order before settling payment.");
        return;
      }

      await payExistingOrder(validPayments, statutoryDiscount);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        "Failed to process payment";
      toast.error(message);
    }
  }

  // Waiter: Serve Order - Creates order and marks as served
  async function handleServeOrder(
    orderType: OrderType,
    customerId?: string,
    tableId?: string
  ) {
    if (!canServe) {
      toast.error("You don't have permission to serve orders");
      return;
    }
    if (cart.state.items.length === 0) {
      toast.error("Cart is empty. Add items before serving.");
      return;
    }
    if (orderType === "dine_in" && !tableId) {
      toast.error("Select a table for dine-in orders");
      return;
    }

    try {
      const orderItems: OrderItemFormData[] = cart.state.items.map((item) => ({
        menu_item_id: item.menu_item_id,
        variant: item.variant,
        quantity: item.quantity,
        unit_price: item.price,
        notes: item.notes,
        modifiers: item.modifiers?.map((m) => ({
          modifier_option_id: m.name, // This might need adjustment based on actual modifier structure
          price: m.price,
        })),
      }));

      const orderData: OrderFormData = {
        order_type: orderType,
        customer_id: customerId || undefined,
        table_id: orderType === "dine_in" ? tableId : undefined,
        items: orderItems,
        notes: cart.state.notes,
        auto_apply_promotions: true,
      };

      const result = await createOrder.mutateAsync(orderData);
      const newOrder = result.data.data;

      // Mark as served immediately
      await updateStatus.mutateAsync({ id: newOrder.id, status: "served" });

      toast.success(`Order ${newOrder.order_number} created and served`);
      cart.clearCart();
      resetCompletedTransaction();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        "Failed to serve order";
      toast.error(message);
    }
  }

  // Cashier: Bill Out - Creates order (pending) for later payment
  async function handleBillOut(
    orderType: OrderType,
    customerId?: string,
    tableId?: string
  ) {
    if (!canBillOut) {
      toast.error("You don't have permission to bill out orders");
      return;
    }
    if (cart.state.items.length === 0) {
      toast.error("Cart is empty. Add items before billing out.");
      return;
    }
    if (orderType === "dine_in" && !tableId) {
      toast.error("Select a table for dine-in orders");
      return;
    }

    try {
      const orderItems: OrderItemFormData[] = cart.state.items.map((item) => ({
        menu_item_id: item.menu_item_id,
        variant: item.variant,
        quantity: item.quantity,
        unit_price: item.price,
        notes: item.notes,
        modifiers: item.modifiers?.map((m) => ({
          modifier_option_id: m.name,
          price: m.price,
        })),
      }));

      const orderData: OrderFormData = {
        order_type: orderType,
        customer_id: customerId || undefined,
        table_id: orderType === "dine_in" ? tableId : undefined,
        items: orderItems,
        notes: cart.state.notes,
        auto_apply_promotions: true,
      };

      const result = await createOrder.mutateAsync(orderData);
      const newOrder = result.data.data;

      toast.success(`Order ${newOrder.order_number} billed out`);
      cart.clearCart();
      resetCompletedTransaction();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        "Failed to bill out order";
      toast.error(message);
    }
  }

  function handleNewOrder() {
    cart.clearCart();
    resetCompletedTransaction();
    setExistingOrderId(null);
  }

  const dialogTotals = useMemo(() => {
    if (existingOrder) {
      const alreadyPaid = (existingOrder.payments ?? []).reduce(
        (sum, p) => sum + (p.amount ?? 0),
        0
      );
      return {
        totalAmount: Math.max(
          0,
          Math.round((existingOrder.total_amount - alreadyPaid) * 100) / 100
        ),
        subtotal: existingOrder.subtotal,
        discountAmount: existingOrder.discount_amount,
        vatAmount: existingOrder.tax_amount,
        serviceChargeAmount: existingOrder.service_charge,
      };
    }
    return {
      totalAmount: cart.computed.totalAmount,
      subtotal: cart.computed.subtotal,
      discountAmount: cart.computed.discountAmount,
      vatAmount: cart.computed.vatAmount,
      serviceChargeAmount: cart.computed.serviceChargeAmount,
    };
  }, [existingOrder, cart.computed]);

  const receiptItems: CartItemType[] =
    completedItems.length > 0
      ? completedItems
      : existingOrder
        ? existingOrder.items.map((i) => ({
            id: i.id,
            menu_item_id: i.menu_item_id,
            name: i.name ?? i.menu_item_name ?? "Unnamed item",
            price: i.unit_price,
            quantity: i.quantity,
          }))
        : cart.state.items;

  const receiptTotals =
    completedTotals ??
    (existingOrder
      ? {
          subtotal: existingOrder.subtotal,
          discountAmount: existingOrder.discount_amount,
          vatAmount: existingOrder.tax_amount,
          serviceChargeAmount: existingOrder.service_charge,
          totalAmount: existingOrder.total_amount,
        }
      : {
          subtotal: cart.computed.subtotal,
          discountAmount: cart.computed.discountAmount,
          vatAmount: cart.computed.vatAmount,
          serviceChargeAmount: cart.computed.serviceChargeAmount,
          totalAmount: cart.computed.totalAmount,
        });

  const canReport = canAccessRevenueReport(user?.role);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <PosHeader
        itemCount={cart.computed.itemCount}
        onClearCart={cart.clearCart}
        onReport={() => router.push("/reports/revenue")}
        canReport={canReport}
      />

      <div className="flex flex-1 flex-col xl:flex-row overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <ProductGrid onAddToCart={handleAddToCart} />
        </div>

        <div className="w-full xl:w-[380px] xl:shrink-0 border-t xl:border-t-0 xl:border-l overflow-y-auto max-h-[45dvh] xl:max-h-none pb-[env(safe-area-inset-bottom)]">
          <CartPanel
            items={cart.state.items}
            subtotal={cart.computed.subtotal}
            discountAmount={cart.computed.discountAmount}
            vatAmount={cart.computed.vatAmount}
            serviceChargeAmount={cart.computed.serviceChargeAmount}
            serviceChargePercent={cart.computed.serviceChargePercent}
            totalAmount={cart.computed.totalAmount}
            itemCount={cart.computed.itemCount}
            onUpdateQuantity={cart.updateQuantity}
            onRemove={cart.removeItem}
            onUpdateNotes={cart.updateItemNotes}
            onReport={() => router.push("/reports/revenue")}
            existingOrder={existingOrder}
            onSelectExistingOrder={() => setExistingDialogOpen(true)}
            onClearExistingOrder={() => setExistingOrderId(null)}
            onPayExisting={canProcessPayments ? () => setPaymentOpen(true) : undefined}
            onSelectTableOrder={(orderId) => {
              setExistingOrderId(orderId);
              setPaymentOpen(true);
            }}
            onAutoSelectTableOrder={
              canProcessPayments
                ? (orderId) => setExistingOrderId(orderId)
                : undefined
            }
            onTableSelected={() => {
              // When a table is selected, clear any currently selected existing order
              // so the cashier can view fresh orders for that table
              if (!canProcessPayments) setExistingOrderId(null);
            }}
            onServeOrder={canServe ? handleServeOrder : undefined}
            onBillOut={canBillOut ? handleBillOut : undefined}
          />

          {/* Payment method visibility for staff */}
          <div className="p-3 border-t">
            <PaymentMethodDisplay
              title="Available Payments"
              compact
            />
          </div>
        </div>
      </div>

      {canProcessPayments && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          totalAmount={dialogTotals.totalAmount}
          discountAmount={dialogTotals.discountAmount}
          vatAmount={dialogTotals.vatAmount}
          serviceChargeAmount={dialogTotals.serviceChargeAmount}
          subtotal={dialogTotals.subtotal}
          onProcessPayment={handleProcessPayment}
          isProcessing={addPayment.isPending}
          existingOrder={existingOrder}
        />
      )}

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        orderNumber={completedOrderNumber}
        items={receiptItems}
        subtotal={receiptTotals.subtotal}
        discountAmount={receiptTotals.discountAmount}
        discountName={completedDiscountName}
        vatAmount={receiptTotals.vatAmount}
        serviceChargeAmount={receiptTotals.serviceChargeAmount}
        totalAmount={receiptTotals.totalAmount}
        payments={completedPayments}
        previouslyPaid={completedPrevPaid}
        amountDueForChange={completedDue}
        orderType={completedOrderType}
        customerName={completedCustomerName || undefined}
        tableNumber={completedTableNumber || undefined}
        onNewOrder={handleNewOrder}
        statutoryDiscountType={completedStatutoryDiscountType}
        statutoryDiscountName={completedStatutoryDiscountName}
        statutoryDiscountAmount={completedStatutoryDiscountAmount}
        qualifiedAmount={completedQualifiedAmount}
        vatExemptSales={completedVatExemptSales}
      />

      <ExistingOrderDialog
        open={existingDialogOpen}
        onOpenChange={setExistingDialogOpen}
        onSelect={(order) => {
          setExistingOrderId(order.id);
          setExistingDialogOpen(false);
        }}
      />
    </div>
  );
}
