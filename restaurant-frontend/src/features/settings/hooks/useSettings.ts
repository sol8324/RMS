"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/client";
import type { ApiResponse } from "@/lib/types";
import { normalizeSettings } from "../types";
import type {
  RestaurantSettings,
  RestaurantInfoFormData,
  SystemPreferencesFormData,
} from "../types";

/**
 * Single source of truth: one query key for the one backend row. Both forms
 * consume it; every mutation invalidates the shared key so both stay fresh.
 */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api
        .get<ApiResponse<Record<string, unknown>>>("/admin/settings")
        .then((res) => {
          const payload = res.data.data;
          const settings = payload?.restaurant ?? payload;
          return normalizeSettings(settings);
        }),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Partial<RestaurantInfoFormData & SystemPreferencesFormData>,
    ) => api.put<ApiResponse<unknown>>("/admin/settings", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export type { RestaurantSettings };

/**
 * The backend-configured VAT rate (authoritative for order pricing).
 * Falls back to the Philippine default of 12% until settings load.
 */
export function useTaxRate(): number {
  const { data } = useSettings();
  const rate = data?.default_tax_rate;
  return typeof rate === "number" && rate > 0 ? rate : 12;
}

/**
 * Returns the list of enabled payment methods based on admin settings.
 * Filters by role: cashier/admin see all enabled; waiter/kitchen see enabled methods for display.
 */
export function useActivePaymentMethods(): {
  cash: boolean;
  card: boolean;
  e_wallet: boolean;
  e_bank: boolean;
  enabledMethods: string[];
} {
  const { data } = useSettings();
  return {
    cash: data?.payment_cash_enabled ?? true,
    card: data?.payment_card_enabled ?? true,
    e_wallet: data?.payment_e_wallet_enabled ?? true,
    e_bank: data?.payment_e_bank_enabled ?? false,
    enabledMethods: [
      data?.payment_cash_enabled !== false && "cash",
      data?.payment_card_enabled !== false && "card",
      data?.payment_e_wallet_enabled !== false && "e_wallet",
      data?.payment_e_bank_enabled === true && "e_bank",
    ].filter(Boolean) as string[],
  };
}
