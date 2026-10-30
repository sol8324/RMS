"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Wallet, Smartphone, Building2 } from "lucide-react";
import { useActivePaymentMethods } from "@/features/settings/hooks/useSettings";

const METHOD_CONFIG = {
  cash: { label: "Cash", icon: Wallet, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  card: { label: "Card", icon: CreditCard, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  e_wallet: { label: "E-Wallet", icon: Smartphone, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  e_bank: { label: "E-Bank", icon: Building2, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
} as const;

interface PaymentMethodDisplayProps {
  /** Title to display */
  title?: string;
  /** Show as compact list instead of cards */
  compact?: boolean;
}

export function PaymentMethodDisplay({
  title = "Accepted Payment Methods",
  compact = false,
}: PaymentMethodDisplayProps) {
  const { cash, card, e_wallet, e_bank } = useActivePaymentMethods();

  const methods = useMemo(() => {
    const allEnabled = [
      cash && "cash",
      card && "card",
      e_wallet && "e_wallet",
      e_bank && "e_bank",
    ].filter(Boolean) as Array<keyof typeof METHOD_CONFIG>;

    return allEnabled;
  }, [cash, card, e_wallet, e_bank]);

  if (methods.length === 0) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4">
          <p className="text-sm text-muted-foreground">No payment methods configured</p>
          <p className="text-xs text-muted-foreground mt-1">Contact admin to enable payment methods</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {methods.map((method) => {
            const config = METHOD_CONFIG[method];
            const Icon = config.icon;
            return (
              <Badge key={method} variant="secondary" className={`${config.color} gap-1 px-2.5 py-1.5`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </Badge>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {methods.map((method) => {
            const config = METHOD_CONFIG[method];
            const Icon = config.icon;
            return (
              <div
                key={method}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border ${config.color} border-transparent hover:border-opacity-50 transition-colors`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">{config.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}