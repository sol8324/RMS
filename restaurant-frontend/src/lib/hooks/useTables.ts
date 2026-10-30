"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { unwrapArray } from "@/lib/utils/api";
import type {
  ApiResponse,
  Table,
  TableFormData,
  TableSchedule,
} from "@/lib/types";

export function useTables() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["tables"],
    queryFn: () =>
      api
        .get<ApiResponse<Table[]>>("/tables")
        .then((res) => unwrapArray<Table>(res.data)),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: TableFormData) =>
      api.post<ApiResponse<Table>>("/tables", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableFormData> }) =>
      api.put<ApiResponse<Table>>(`/tables/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.patch(`/tables/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  return { list, create, update, archive, restore };
}

/**
 * Tables eligible for a brand-new dine-in order: available tables plus
 * occupied tables held by an active seated reservation with no active
 * order yet (one cover → one active order). The backend remains
 * authoritative — this list is only a convenience filter.
 */
export function useTableSchedule(
  tableId: string | null | undefined,
  date: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["tables", "schedule", tableId, date],
    queryFn: () =>
      api
        .get<ApiResponse<TableSchedule>>(`/tables/${tableId}/schedule`, {
          params: { date, days: 7 },
        })
        .then((res) => res.data.data),
    enabled: !!tableId && enabled,
    staleTime: 30_000,
  });
}

export function useOrderEligibleTables() {
  return useQuery({
    queryKey: ["tables", "order-eligible"],
    queryFn: () =>
      api
        .get<ApiResponse<{ items: Table[] }>>("/tables/order-eligible")
        .then((res) => res.data.data.items ?? []),
    staleTime: 30_000,
  });
}
