"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import type { ApiResponse } from "@/lib/types";
import { normalizeDashboardSummary } from "@/features/dashboard/normalizer";

export interface DashboardDateRange {
  date_from?: string;
  date_to?: string;
}

export function useDashboard(dateRange?: DashboardDateRange) {
  return useQuery({
    queryKey: ["dashboard", dateRange],
    queryFn: () =>
      api
        .get<ApiResponse<unknown>>("/dashboard/summary", {
          params: dateRange,
        })
        .then((res) => normalizeDashboardSummary(res.data.data)),
    staleTime: 30000,
    refetchInterval: 30000,
  });
}
