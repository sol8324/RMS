"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { normalizePaginated } from "@/lib/utils/api";
import { addNotification } from "./useNotifications";
import type {
  ApiResponse,
  QueryParams,
  PaginatedResponse,
  Order,
  OrderFormData,
  OrderStatus,
  PaymentFormData,
  RefundFormData,
} from "@/lib/types";

export function useOrders(
  params?: QueryParams & { status?: string; order_type?: string }
) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["orders", params],
    queryFn: () =>
      api
        .get<PaginatedResponse<Order>>("/orders", { params })
        .then((res) => normalizePaginated(res.data)),
    staleTime: 10_000,
  });

  const create = useMutation({
    mutationFn: (data: OrderFormData) =>
      api.post<ApiResponse<Order>>("/orders", data),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      addNotification(queryClient, {
        type: "order",
        icon: "order",
        title: "Order created",
        description: `Order #${order.order_number} has been created.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderFormData }) =>
      api.put<ApiResponse<Order>>(`/orders/${id}`, data),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      addNotification(queryClient, {
        type: "order",
        icon: "order",
        title: "Order updated",
        description: `Order #${order.order_number} has been updated.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status }),
    onSuccess: (res, variables) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders-all"] });
      addNotification(queryClient, {
        type: "info",
        icon: "info",
        title: "Order status changed",
        description: `Order #${order.order_number} is now ${variables.status}.`,
        action: { label: "View order", href: `/orders/${variables.id}` },
      });
    },
  });

  const addPayment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentFormData }) =>
      api.post<ApiResponse<unknown>>(`/orders/${id}/payments`, data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      addNotification(queryClient, {
        type: "payment",
        icon: "payment",
        title: "Payment processed",
        description: `Payment of ${variables.data.amount} has been processed.`,
        action: { label: "View order", href: `/orders/${variables.id}` },
      });
    },
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch<ApiResponse<Order>>(`/orders/${id}/status`, {
        status: "cancelled",
        notes: reason,
      }),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders-all"] });
      addNotification(queryClient, {
        type: "warning",
        icon: "warning",
        title: "Order cancelled",
        description: `Order #${order.order_number} has been cancelled.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<Order>>(`/orders/${id}/archive`, {}),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      addNotification(queryClient, {
        type: "info",
        icon: "info",
        title: "Order archived",
        description: `Order #${order.order_number} has been archived.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const unarchive = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<Order>>(`/orders/${id}/archive`),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      addNotification(queryClient, {
        type: "info",
        icon: "info",
        title: "Order restored",
        description: `Order #${order.order_number} has been restored.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const voidOrder = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ApiResponse<Order>>(`/orders/${id}/void`, { reason }),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders-all"] });
      addNotification(queryClient, {
        type: "warning",
        icon: "warning",
        title: "Order voided",
        description: `Order #${order.order_number} has been voided.`,
        action: { label: "View order", href: `/orders/${order.id}` },
      });
    },
  });

  const refund = useMutation({
    mutationFn: ({
      invoiceId,
      data,
    }: {
      invoiceId: string;
      data: RefundFormData;
    }) =>
      api.post<ApiResponse<unknown>>(
        `/invoices/${invoiceId}/refund`,
        data
      ),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      addNotification(queryClient, {
        type: "payment",
        icon: "payment",
        title: "Refund processed",
        description: `Refund of ${variables.data.amount} has been processed.`,
      });
    },
  });

  return {
    list,
    create,
    update,
    updateStatus,
    addPayment,
    cancel,
    archive,
    unarchive,
    voidOrder,
    refund,
  };
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () =>
      api
        .get<ApiResponse<Order>>(`/orders/${id}`)
        .then((res) => res.data.data),
    enabled: !!id,
  });
}

export function useUnpaidOrders() {
  return useQuery({
    queryKey: ["orders", "unpaid"],
    queryFn: () =>
      api
        .get<PaginatedResponse<Order>>("/orders", {
          params: {
            status: "served",
            payment_status: "unpaid,partial",
            per_page: 200,
          },
        })
        .then((res) => normalizePaginated(res.data)),
    staleTime: 10_000,
  });
}

/**
 * Active orders for a single table, used by the table details modal.
 * Polling is enabled only while the modal is open; there is no backend
 * WebSocket service, so this is the safe real-time fallback.
 */
export function useTableActiveOrders(
  tableId?: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: ["orders", "table", tableId, "active"],
    queryFn: () =>
      api
        .get<PaginatedResponse<Order>>("/orders", {
          params: {
            table_id: tableId,
            active: 1,
            with_items: 1,
            per_page: 50,
          },
        })
        .then((res) => normalizePaginated(res.data)),
    enabled: enabled && !!tableId,
    staleTime: 0,
    refetchInterval: enabled && tableId ? 5_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
