"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  PageHeader,
  StatsCardsSkeleton,
  ChartSkeleton,
  CardGridSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/shared";
import {
  RevenueCards,
  SalesSummary,
  TableOccupancy,
  InventoryAlerts,
  KitchenQueue,
  RecentOrders,
  RecentActivity,
} from "@/features/dashboard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, RefreshCw, LayoutDashboard } from "lucide-react";
import { useDashboard, type DashboardDateRange } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";
import {
  DemandForecastCard,
  InventoryForecastCard,
} from "@/features/reports";

const PeakHoursChart = dynamic(
  () => import("@/features/dashboard").then((m) => ({ default: m.PeakHoursChart })),
  { loading: () => <div className="animate-pulse rounded-2xl bg-muted h-[300px]" /> }
);
const RevenueChart = dynamic(
  () => import("@/features/dashboard").then((m) => ({ default: m.RevenueChart })),
  { loading: () => <div className="animate-pulse rounded-2xl bg-muted h-[350px]" /> }
);
const TopSellingItems = dynamic(
  () => import("@/features/dashboard").then((m) => ({ default: m.TopSellingItems })),
  { loading: () => <div className="animate-pulse rounded-2xl bg-muted h-[250px]" /> }
);

// Normalization now lives in `useDashboard` (src/features/dashboard/normalizer.ts)
// so the page never consumes a raw/unsafe payload.

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "waiter";
  const [dateRange, setDateRange] = useState<DashboardDateRange>({
    date_from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    date_to: new Date().toISOString().split("T")[0],
  });
  const { data, isLoading, error, refetch } = useDashboard(dateRange);

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading dashboard">
        <PageHeader title="Dashboard" description="Overview of your restaurant" />
        <StatsCardsSkeleton count={4} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <CardGridSkeleton count={6} className="sm:grid-cols-2 lg:grid-cols-3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your restaurant" />
        <ErrorState
          message="Failed to load dashboard data. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your restaurant" />
        <EmptyState
          title="No dashboard data yet"
          description="Once orders start coming in, your overview will appear here."
          icon={<LayoutDashboard className="h-8 w-8" />}
        />
      </div>
    );
  }

  const safeData = data;

  // Render role-specific dashboard content
  function renderDashboardContent() {
    switch (role) {
      case "admin":
        return (
          <div className="space-y-8">
            <RevenueCards data={safeData} />
            <div className="grid gap-8 lg:grid-cols-2">
              <SalesSummary data={safeData} />
              <RevenueChart data={safeData} />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <KitchenQueue data={safeData} />
              <RecentOrders data={safeData} />
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
              <TableOccupancy data={safeData} />
              <InventoryAlerts data={safeData} />
            </div>
            {/* AI / FORECAST */}
            <DemandForecastCard />
            <InventoryForecastCard />
            <div className="grid gap-8 lg:grid-cols-2">
              <TopSellingItems data={safeData} />
              <PeakHoursChart data={safeData} />
            </div>
            <div>
              <RecentActivity data={safeData} />
            </div>
          </div>
        );
      case "manager":
        return (
          <div className="space-y-8">
            <RevenueCards data={safeData} />
            <div className="grid gap-8 lg:grid-cols-2">
              <SalesSummary data={safeData} />
              <RevenueChart data={safeData} />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <KitchenQueue data={safeData} />
              <RecentOrders data={safeData} />
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
              <TableOccupancy data={safeData} />
              <InventoryAlerts data={safeData} />
            </div>
            {/* AI / FORECAST */}
            <DemandForecastCard />
            <InventoryForecastCard />
            <div className="grid gap-8 lg:grid-cols-2">
              <TopSellingItems data={safeData} />
              <PeakHoursChart data={safeData} />
            </div>
            <div>
              <RecentActivity data={safeData} />
            </div>
          </div>
        );
      case "inventory_staff":
        return (
          <div className="space-y-8">
            <InventoryForecastCard />
            <InventoryAlerts data={safeData} />
          </div>
        );
      case "waiter":
        return (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <TableOccupancy data={safeData} />
              <RecentOrders data={safeData} />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <KitchenQueue data={safeData} />
            </div>
          </div>
        );
      case "cashier":
        // No revenue/financial summaries — not authorized for this role.
        return (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <RecentOrders data={safeData} />
              <TableOccupancy data={safeData} />
            </div>
          </div>
        );
      case "kitchen_staff":
        return (
          <div className="space-y-6">
            <KitchenQueue data={safeData} />
            <RecentOrders data={safeData} />
          </div>
        );
      default:
        return (
          <div className="space-y-8">
            <div className="text-center py-12 text-muted-foreground">
              No dashboard configured for this role.
            </div>
          </div>
        );
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Dashboard"
        description="Overview of your restaurant"
        action={
          <div className="flex items-center gap-2">
            <Select
              value={`${dateRange.date_from || ""} to ${dateRange.date_to || ""}`}
              onValueChange={(val) => {
                if (!val) return;
                const [from, to] = val.split(" to ");
                setDateRange({ date_from: from, date_to: to });
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={`${new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`}>
                  Last 7 days (default)
                </SelectItem>
                <SelectItem value={`${new Date().toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`}>
                  Today
                </SelectItem>
                <SelectItem value={`${new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`}>
                  Last 30 days
                </SelectItem>
                <SelectItem value={`${new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`}>
                  Last 90 days
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {renderDashboardContent()}
    </div>
  );
}
