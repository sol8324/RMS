<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Analytics;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\StockMovement;
use App\Models\Wastage;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Engine-safe SQL fragment for the HOUR-of-day of a datetime column.
     * PostgreSQL: EXTRACT(HOUR FROM col). SQLite: strftime('%H', col).
     */
    private function hourSql(string $column = 'created_at'): string
    {
        return config('database.default') === 'sqlite'
            ? "CAST(strftime('%H', {$column}) AS INTEGER)"
            : "EXTRACT(HOUR FROM {$column})";
    }

    /** Engine-safe SQL fragment for weekday name of a datetime column. */
    private function dayOfWeekSql(string $column = 'created_at'): string
    {
        return config('database.default') === 'sqlite'
            ? "strftime('%A', {$column})"
            : "TRIM(TO_CHAR({$column}, 'Day'))";
    }

    protected function getDateRange(Request $request): array
    {
        $period = $request->input('period', 'this_month');
        $dateRange = $request->input('date_range');

        if ($dateRange && isset($dateRange['from']) && isset($dateRange['to'])) {
            return [
                'start' => $dateRange['from'],
                'end' => $dateRange['to'],
            ];
        }

        $now = now();

        $ranges = [
            'today' => [
                'start' => $now->copy()->startOfDay()->toDateString(),
                'end' => $now->copy()->endOfDay()->toDateString(),
            ],
            'yesterday' => [
                'start' => $now->copy()->subDay()->startOfDay()->toDateString(),
                'end' => $now->copy()->subDay()->endOfDay()->toDateString(),
            ],
            'this_week' => [
                'start' => $now->copy()->startOfWeek()->toDateString(),
                'end' => $now->copy()->endOfWeek()->toDateString(),
            ],
            'this_month' => [
                'start' => $now->copy()->startOfMonth()->toDateString(),
                'end' => $now->copy()->endOfMonth()->toDateString(),
            ],
            'last_month' => [
                'start' => $now->copy()->subMonth()->startOfMonth()->toDateString(),
                'end' => $now->copy()->subMonth()->endOfMonth()->toDateString(),
            ],
            'this_quarter' => [
                'start' => $now->copy()->startOfQuarter()->toDateString(),
                'end' => $now->copy()->endOfQuarter()->toDateString(),
            ],
            'this_year' => [
                'start' => $now->copy()->startOfYear()->toDateString(),
                'end' => $now->copy()->endOfYear()->toDateString(),
            ],
        ];

        return $ranges[$period] ?? $ranges['this_month'];
    }

public function revenue(Request $request): JsonResponse
    {
        $range = $this->getDateRange($request);
        $start = $range['start'];
        $end = $range['end'];

        $totalRevenue = (float) Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->sum('total');

        $totalOrders = (int) Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->count();

        $aov = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        $byDay = Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ]);

        $byHour = Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw($this->hourSql() . " as hour, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->map(fn ($row) => [
                'hour' => (int) $row->hour,
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ]);

        $byType = Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("order_type, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('order_type')
            ->get()
            ->map(fn ($row) => [
                'type' => $row->order_type,
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ]);

        $prevStart = Carbon::parse($start)->subDays(Carbon::parse($start)->diffInDays($end) + 1)->toDateString();
        $prevEnd = Carbon::parse($start)->subDay()->toDateString();
        $prevTotal = (float) Order::where('status', 'completed')
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->sum('total');
        $revenueGrowth = $prevTotal > 0 ? (($totalRevenue - $prevTotal) / $prevTotal) * 100 : 0;

        $prevByDay = Order::where('status', 'completed')
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->selectRaw("DATE(created_at) as date, SUM(total) as revenue")
            ->groupBy('date')
            ->pluck('revenue', 'date');

        $trend = $byDay->map(function ($item) use ($prevByDay) {
            $prevDate = Carbon::parse($item['date'])->subDays(
                (int) Carbon::parse($item['date'])->diffInDays($item['date']) + 1
            )->toDateString();
            $prevRevenue = (float) ($prevByDay[$prevDate] ?? 0);
            return [
                'date' => $item['date'],
                'revenue' => $item['revenue'],
                'previous_period_revenue' => $prevRevenue,
            ];
        });

        return $this->success([
            'total_revenue' => $totalRevenue,
            'revenue_growth' => round($revenueGrowth, 2),
            'average_order_value' => round($aov, 2),
            'revenue_by_hour' => $byHour,
            'revenue_by_day' => $byDay,
            'revenue_by_type' => $byType,
            'revenue_trend' => $trend,
        ]);
    }

public function sales(Request $request): JsonResponse
    {
        $range = $this->getDateRange($request);
        $start = $range['start'];
        $end = $range['end'];

        $byType = Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("order_type, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('order_type')
            ->get();

        $totalSales = (float) $byType->sum('revenue');
        $totalOrders = (int) $byType->sum('orders');
        $averageTicket = $totalOrders > 0 ? $totalSales / $totalOrders : 0;

        $prevStart = Carbon::parse($start)->subDays(Carbon::parse($start)->diffInDays($end) + 1)->toDateString();
        $prevEnd = Carbon::parse($start)->subDay()->toDateString();
        $prevSales = (float) Order::where('status', 'completed')
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->sum('total');
        $salesGrowth = $prevSales > 0 ? (($totalSales - $prevSales) / $prevSales) * 100 : 0;

        $byHour = OrderItem::whereHas('order', function ($q) use ($start, $end) {
            $q->where('status', 'completed')
                ->whereBetween('created_at', [$start, $end]);
        })
            ->selectRaw($this->hourSql("order_items.created_at") . " as hour, SUM(order_items.quantity) as items_sold, SUM(order_items.total_price) as revenue")
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->map(fn ($row) => [
                'hour' => (int) $row->hour,
                'items_sold' => (int) $row->items_sold,
                'revenue' => (float) $row->revenue,
            ]);

        $byCategoryRows = OrderItem::whereHas('order', function ($q) use ($start, $end) {
            $q->where('status', 'completed')
                ->whereBetween('created_at', [$start, $end]);
        })
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->join('menu_categories', 'menu_items.category_id', '=', 'menu_categories.id')
            ->selectRaw("menu_categories.name as category, SUM(order_items.quantity) as items_sold, SUM(order_items.total_price) as revenue")
            ->groupBy('menu_categories.name')
            ->orderBy('revenue', 'desc')
            ->get();

        $byCategory = $byCategoryRows->map(fn ($row) => [
            'category' => $row->category ?? 'Uncategorized',
            'items_sold' => (int) $row->items_sold,
            'revenue' => (float) $row->revenue,
            'percentage' => 0,
        ]);

        $catTotal = max((float) $byCategory->sum('revenue'), 1);
        $byCategory = $byCategory->map(function ($item) use ($catTotal) {
            $item['percentage'] = ($item['revenue'] / $catTotal) * 100;
            return $item;
        });

        $byDay = OrderItem::whereHas('order', function ($q) use ($start, $end) {
            $q->where('status', 'completed')
                ->whereBetween('created_at', [$start, $end]);
        })
            ->selectRaw("DATE(order_items.created_at) as date, SUM(order_items.quantity) as items_sold, SUM(order_items.total_price) as revenue")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'items_sold' => (int) $row->items_sold,
                'revenue' => (float) $row->revenue,
            ]);

        $topItems = OrderItem::whereHas('order', function ($q) use ($start, $end) {
            $q->where('status', 'completed')
                ->whereBetween('created_at', [$start, $end]);
        })
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->join('menu_categories', 'menu_items.category_id', '=', 'menu_categories.id')
            ->selectRaw("menu_items.id, menu_items.name, menu_categories.name as category, SUM(order_items.quantity) as quantity_sold, SUM(order_items.total_price) as revenue, AVG(order_items.unit_price) as average_price")
            ->groupBy('menu_items.id', 'menu_items.name', 'menu_categories.name')
            ->orderBy('revenue', 'desc')
            ->limit(20)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->name,
                'category' => $row->category ?? 'Uncategorized',
                'quantity_sold' => (int) $row->quantity_sold,
                'revenue' => (float) $row->revenue,
                'average_price' => round((float) $row->average_price ?? 0, 2),
                'trend' => 'stable',
            ]);

        return $this->success([
            'total_sales' => $totalSales,
            'sales_growth' => round($salesGrowth, 2),
            'total_items_sold' => (int) OrderItem::whereHas('order', function ($q) use ($start, $end) {
                $q->where('status', 'completed')
                    ->whereBetween('created_at', [$start, $end]);
            })->sum('quantity'),
            'average_ticket' => round($averageTicket, 2),
            'sales_by_hour' => $byHour,
            'sales_by_category' => $byCategory,
            'sales_by_day' => $byDay,
            'top_items' => $topItems,
        ]);
    }

    public function peakHours(Request $request): JsonResponse
    {
        $range = $this->getDateRange($request);
        $start = $range['start'];
        $end = $range['end'];

        $hourly = Order::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("" . $this->hourSql() . " as hour, " . $this->dayOfWeekSql() . " as day_of_week, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('hour', 'day_of_week')
            ->orderBy('hour')
            ->get()
            ->map(fn ($row) => [
                'hour' => (int) $row->hour,
                'day_of_week' => trim((string) $row->day_of_week),
                'orders' => (int) $row->orders,
                'revenue' => (float) $row->revenue,
            ]);

        $busiestDay = $hourly->sortByDesc('orders')->first()?->day_of_week ?? 'today';

        $dayMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        $distribution = [];
        for ($h = 0; $h < 24; $h++) {
            $hourData = [
                'hour' => $h,
                'label' => sprintf('%02d:00', $h),
                'monday' => 0, 'tuesday' => 0, 'wednesday' => 0,
                'thursday' => 0, 'friday' => 0, 'saturday' => 0, 'sunday' => 0,
                'average' => 0,
            ];
            foreach ($dayMap as $day) {
                $dayData = $hourly->first(function ($item) use ($h, $day) {
                    return $item['hour'] === $h && strtolower($item['day_of_week']) === $day;
                });
                if ($dayData) {
                    $hourData[$day] = (int) $dayData['orders'];
                }
            }
            $dayVals = array_map(fn ($d) => $hourData[$d], $dayMap);
            $hourData['average'] = count($dayVals) > 0 ? array_sum($dayVals) / count($dayVals) : 0;
            $distribution[] = $hourData;
        }

        $totalOrders = (int) $hourly->sum('orders');
        $avgPerHour = count($distribution) > 0 ? $totalOrders / count($distribution) : 0;

        return $this->success([
            'peak_hours' => $hourly,
            'busiest_day' => $busiestDay,
            'quietest_day' => 'today',
            'average_orders_per_hour' => round($avgPerHour, 2),
            'hourly_distribution' => $distribution,
        ]);
    }

    public function inventory(Request $request): JsonResponse
    {
        $range = $this->getDateRange($request);
        $start = $range['start'];
        $end = $range['end'];

        $totalIngredients = (int) Ingredient::where('is_active', true)->count();
        $totalUsageCost = (float) StockMovement::where('type', 'outward')
            ->whereBetween('created_at', [$start, $end])
            ->sum('unit_cost');

        $wastageCost = (float) Wastage::join('ingredients', 'wastage.ingredient_id', '=', 'ingredients.id')
            ->whereBetween('wastage.created_at', [$start, $end])
            ->sum(DB::raw('wastage.quantity * ingredients.cost_per_unit'));

        $usageByCategoryRows = Ingredient::where('is_active', true)
            ->join('stock_movements', 'ingredients.id', '=', 'stock_movements.ingredient_id')
            ->where('stock_movements.type', 'outward')
            ->whereBetween('stock_movements.created_at', [$start, $end])
            ->selectRaw("ingredients.category, SUM(stock_movements.quantity * stock_movements.unit_cost) as usage_cost")
            ->groupBy('ingredients.category')
            ->orderBy('usage_cost', 'desc')
            ->get();

        $usageByCategory = $usageByCategoryRows->map(fn ($row) => [
            'category' => $row->category ?? 'Uncategorized',
            'usage_cost' => (float) $row->usage_cost,
            'percentage' => 0,
        ]);

        $catUsageTotal = max((float) $usageByCategory->sum('usage_cost'), 1);
        $usageByCategory = $usageByCategory->map(function ($item) use ($catUsageTotal) {
            $item['percentage'] = ($item['usage_cost'] / $catUsageTotal) * 100;
            return $item;
        });

        $topConsumed = Ingredient::where('is_active', true)
            ->join('stock_movements', 'ingredients.id', '=', 'stock_movements.ingredient_id')
            ->where('stock_movements.type', 'outward')
            ->whereBetween('stock_movements.created_at', [$start, $end])
            ->selectRaw("ingredients.id, ingredients.name, ingredients.category, SUM(stock_movements.quantity) as quantity_used, ingredients.unit, SUM(stock_movements.quantity * stock_movements.unit_cost) as cost")
            ->groupBy('ingredients.id', 'ingredients.name', 'ingredients.category', 'ingredients.unit')
            ->orderBy('quantity_used', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->name,
                'category' => $row->category ?? 'Uncategorized',
                'quantity_used' => (float) $row->quantity_used,
                'unit' => $row->unit ?? '',
                'cost' => (float) $row->cost,
            ]);

        $wastageTrend = Wastage::join('ingredients', 'wastage.ingredient_id', '=', 'ingredients.id')
            ->whereBetween('wastage.created_at', [$start, $end])
            ->selectRaw("DATE(wastage.created_at) as date, SUM(wastage.quantity) as wastage_count, SUM(wastage.quantity * ingredients.cost_per_unit) as wastage_cost")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'wastage_count' => (int) $row->wastage_count,
                'wastage_cost' => (float) $row->wastage_cost,
            ]);

        $lowStockAlerts = Ingredient::where('is_active', true)
            ->whereColumn('current_stock', '<=', 'minimum_stock')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'current_stock' => (float) $i->current_stock,
                'min_threshold' => (float) $i->minimum_stock,
                'unit' => $i->unit ?? '',
                'severity' => (float) $i->current_stock <= 0 ? 'out_of_stock' : ((float) $i->current_stock <= ((float) $i->minimum_stock * 0.5) ? 'critical' : 'low'),
            ]);

        return $this->success([
            'total_ingredients' => $totalIngredients,
            'total_usage_cost' => round($totalUsageCost, 2),
            'wastage_cost' => round($wastageCost, 2),
            'usage_by_category' => $usageByCategory,
            'top_consumed' => $topConsumed,
            'wastage_trend' => $wastageTrend,
            'low_stock_alerts' => $lowStockAlerts,
        ]);
    }

    public function customers(Request $request): JsonResponse
    {
        $range = $this->getDateRange($request);
        $start = $range['start'];
        $end = $range['end'];

        $totalCustomers = (int) Customer::count();
        $newCustomers = (int) Customer::whereBetween('created_at', [$start, $end])->count();

        $prevStart = Carbon::parse($start)->subDays(Carbon::parse($start)->diffInDays($end) + 1)->toDateString();
        $prevEnd = Carbon::parse($start)->subDay()->toDateString();
        $prevCustomers = (int) Customer::whereBetween('created_at', [$prevStart, $prevEnd])->count();
        $prevReturning = (int) Customer::where('visit_count', '>', 0)
            ->whereBetween('created_at', [$prevStart, $prevEnd])
            ->count();
        $returningCustomers = (int) Customer::where('visit_count', '>', 0)
            ->whereBetween('created_at', [$start, $end])
            ->count();

        $avgLifetimeValue = (float) Customer::avg('total_spent');
        $avgVisitsPerCustomer = (float) Customer::where('visit_count', '>', 0)->avg('visit_count');

        $topCustomers = Customer::orderBy('total_spent', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name ?? 'Unknown',
                'email' => $c->email ?? '',
                'total_orders' => (int) $c->visit_count,
                'total_spent' => (float) $c->total_spent,
                'last_visit' => $c->created_at ? Carbon::parse($c->created_at)->toISOString() : null,
            ]);

        $segCounts = [
            'vip' => (int) Customer::where('customer_type', 'vip')->count(),
            'regular' => (int) Customer::whereIn('customer_type', ['regular', 'registered'])->count(),
            'walk_in' => (int) Customer::where('customer_type', 'walk_in')->count(),
        ];

        $segments = [];
        foreach (['VIP' => 'vip', 'Regular' => 'regular', 'Walk-in' => 'walk_in'] as $label => $type) {
            $count = $segCounts[$type];
            $segments[] = [
                'segment' => $label,
                'count' => $count,
                'percentage' => $totalCustomers > 0 ? ($count / $totalCustomers) * 100 : 0,
                'average_spend' => (float) Customer::whereIn('customer_type', $type === 'regular' ? ['regular', 'registered'] : [$type])->avg('total_spent'),
            ];
        }

        $visitFreqData = [
            ['range' => '0-2 visits', 'count' => (int) Customer::where('visit_count', '<=', 2)->count(), 'percentage' => 0],
            ['range' => '3-5 visits', 'count' => (int) Customer::whereBetween('visit_count', [3, 5])->count(), 'percentage' => 0],
            ['range' => '6-10 visits', 'count' => (int) Customer::whereBetween('visit_count', [6, 10])->count(), 'percentage' => 0],
            ['range' => '10+ visits', 'count' => (int) Customer::where('visit_count', '>', 10)->count(), 'percentage' => 0],
        ];
        $totalVisitors = max(array_sum(array_column($visitFreqData, 'count')), 1);
        $visitFreqData = array_map(function ($item) use ($totalVisitors) {
            $item['percentage'] = ($item['count'] / $totalVisitors) * 100;
            return $item;
        }, $visitFreqData);

        $visitTrends = [];
        $period = Carbon::parse($start);
        $endPeriod = Carbon::parse($end);
        while ($period <= $endPeriod) {
            $dayStart = $period->copy()->startOfDay();
            $dayEnd = $period->copy()->endOfDay();
            $newCount = (int) Customer::whereBetween('created_at', [$dayStart, $dayEnd])->count();
            $visitTrends[] = [
                'date' => $period->toDateString(),
                'new_customers' => $newCount,
                'returning_customers' => 0,
                'total_visits' => $newCount,
            ];
            $period->addDay();
        }

        return $this->success([
            'total_customers' => $totalCustomers,
            'new_customers' => $newCustomers,
            'returning_customers' => $returningCustomers,
            'average_visit_frequency' => round($avgVisitsPerCustomer, 2),
            'average_lifetime_value' => round($avgLifetimeValue, 2),
            'visit_frequency' => $visitFreqData,
            'customer_segments' => $segments,
            'top_customers' => $topCustomers,
            'visit_trends' => $visitTrends,
        ]);
    }
}
