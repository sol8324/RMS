"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { LoadingSpinner } from "@/components/shared";
import type { SystemPreferencesFormData } from "../types";

const CURRENCIES = [
  { code: "PHP", symbol: "₱", label: "Philippine Peso" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
];

const formSchema = z.object({
  currency: z.string().min(1),
  currency_symbol: z.string().min(1),
  vat_enabled: z.boolean(),
  vat_registered: z.boolean(),
  vat_inclusive: z.boolean(),
  default_tax_rate: z.coerce.number().min(0).max(100),
  service_charge_enabled: z.boolean(),
  default_service_charge: z.coerce.number().min(0).max(100),
  reservation_turnover_buffer_minutes: z.coerce.number().int().min(0).max(120),
  order_prefix: z.string().max(20),
  receipt_header: z.string().max(500),
  receipt_footer: z.string().max(500),
  payment_cash_enabled: z.boolean(),
  payment_card_enabled: z.boolean(),
  payment_e_wallet_enabled: z.boolean(),
  payment_e_bank_enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function SystemPreferences({ canEdit = false }: { canEdit?: boolean }) {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      currency: "PHP",
      currency_symbol: "₱",
      vat_enabled: true,
      vat_registered: false,
      vat_inclusive: true,
      default_tax_rate: 12,
      service_charge_enabled: false,
      default_service_charge: 0,
      reservation_turnover_buffer_minutes: 15,
      order_prefix: "ORD-",
      receipt_header: "",
      receipt_footer: "",
      payment_cash_enabled: true,
      payment_card_enabled: true,
      payment_e_wallet_enabled: true,
      payment_e_bank_enabled: false,
    },
  });

  // Hydrate after async data arrives (defaultValues alone won't).
  useEffect(() => {
    if (!settings) return;
    form.reset({
      currency: settings.currency || "PHP",
      currency_symbol: settings.currency_symbol || "₱",
      vat_enabled: settings.vat_enabled ?? true,
      vat_registered: settings.vat_registered ?? false,
      vat_inclusive: settings.vat_inclusive ?? true,
      default_tax_rate: settings.default_tax_rate,
      service_charge_enabled: settings.service_charge_enabled,
      default_service_charge: settings.default_service_charge,
      reservation_turnover_buffer_minutes:
        settings.reservation_turnover_buffer_minutes ?? 15,
      order_prefix: settings.order_prefix ?? "ORD-",
      receipt_header: settings.receipt_header ?? "",
      receipt_footer: settings.receipt_footer ?? "",
      payment_cash_enabled: settings.payment_cash_enabled ?? true,
      payment_card_enabled: settings.payment_card_enabled ?? true,
      payment_e_wallet_enabled: settings.payment_e_wallet_enabled ?? true,
      payment_e_bank_enabled: settings.payment_e_bank_enabled ?? false,
    });
  }, [settings, form]);

  if (isLoading) return <LoadingSpinner />;

  if (!canEdit && settings) {
    const activeMethods = [
      settings.payment_cash_enabled && "Cash",
      settings.payment_card_enabled && "Card",
      settings.payment_e_wallet_enabled && "E-Wallet",
      settings.payment_e_bank_enabled && "E-Bank",
    ].filter(Boolean).join(", ");

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">VAT:</span> {settings.vat_enabled ? `Enabled (${settings.default_tax_rate}%)` : "Disabled"}{settings.vat_inclusive ? " · Inclusive" : ""}{settings.vat_registered ? " · Registered" : ""}</p>
            <p><span className="text-muted-foreground">Service Charge:</span> {settings.service_charge_enabled ? `${settings.default_service_charge}%` : "Disabled"}</p>
            <p><span className="text-muted-foreground">Currency:</span> {settings.currency || "Not provided"} ({settings.currency_symbol})</p>
            <p className="text-xs text-muted-foreground mt-3">
              Only Admins can edit billing settings.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Active Methods:</span> {activeMethods || "None"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Table turnover buffer:</span> {settings.reservation_turnover_buffer_minutes} minutes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order / Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Order Prefix:</span> {settings.order_prefix || "Not provided"}</p>
            <p><span className="text-muted-foreground">Receipt Header:</span> {settings.receipt_header || "—"}</p>
            <p><span className="text-muted-foreground">Receipt Footer:</span> {settings.receipt_footer || "—"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values as SystemPreferencesFormData, {
      onSuccess: () => toast.success("Settings updated"),
      onError: (error) => {
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;
        toast.error(msg || "Failed to update settings");
      },
    });
  };

  const vatEnabled = form.watch("vat_enabled");
  const scEnabled = form.watch("service_charge_enabled");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...field}
                        onChange={(e) => {
                          const curr = CURRENCIES.find((c) => c.code === e.target.value);
                          form.setValue("currency", e.target.value);
                          if (curr) form.setValue("currency_symbol", curr.symbol);
                        }}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label} ({c.symbol})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} step={0.01} {...field} disabled={!vatEnabled} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="vat_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Enable VAT</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vat_registered"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!vatEnabled} />
                    </FormControl>
                    <FormLabel className="!mt-0">VAT Registered</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="vat_inclusive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!vatEnabled} />
                  </FormControl>
                  <FormLabel className="!mt-0">VAT Inclusive</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_charge_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Enable service charge by default</FormLabel>
                </FormItem>
              )}
            />
            {scEnabled && (
              <FormField
                control={form.control}
                name="default_service_charge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Charge Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} step={0.01} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable or disable payment methods available at checkout. 
              Disabled methods will not appear in the POS for cashiers or waiters.
            </p>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="payment_cash_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Cash</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_card_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Card (Credit/Debit)</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_e_wallet_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">E-Wallet (GCash, Maya, GrabPay)</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_e_bank_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">E-Bank / Bank Transfer</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="reservation_turnover_buffer_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Turnover Buffer (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={120} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Time reserved after a booking ends before the same table can be booked again.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order / Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="order_prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Prefix</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ORD-" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receipt_header"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Header</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Printed at the top of receipts" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receipt_footer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Footer</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Printed at the bottom of receipts" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
