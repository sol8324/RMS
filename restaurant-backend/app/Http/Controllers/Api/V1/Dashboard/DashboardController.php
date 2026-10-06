<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ReplenishmentRequest;
use App\Models\Reservation;
use App\Models\StockMovement;
use App\Models\Table;
use App\Models\Waitlist;
use App\Models\KotTicket;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        // Date range support: default to last 7 days, allow custom range
        $dateFrom = $request->input('date_from', now()->subDays(6)->startOfDay());
        $dateTo = $request->input('date_to', now()->endOfDay());

        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        $weekStart = now()->startOfWeek();
        $monthStart = now()->startOfMonth();

        $todayOrders = Order::whereBetween('created_at', [$dateFrom, $dateTo])->count();
        $todayRevenue = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->where('status', 'completed')
            ->sum('total');
        $yesterdayRevenue = Order::whereBetween('created_at', [$yesterday, $today])
            ->where('status', 'completed')
            ->sum('total');
        $weekRevenue = Order::whereBetween('created_at', [$weekStart, $dateTo])
            ->where('status', 'completed')
            ->sum('total');
        $monthRevenue = Order::whereBetween('created_at', [$monthStart, $dateTo])
            ->where('status', 'completed')
            ->sum('total');

        $comparisonPercentage = $yesterdayRevenue > 0
            ? round((($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100, 1)
            : 0;

        $dailyBreakdown = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->where('status', 'completed')
            ->selectRaw("date(created_at) as date, sum(total) as amount")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'amount' => (float) $row->amount,
            ]);

        $transactionCount = $todayOrders;
        $averageTicket = $transactionCount > 0 ? round((float) $todayRevenue / $transactionCount, 2) : 0;

        $salesByType = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->selectRaw("order_type, count(*) as count, sum(total) as revenue")
            ->groupBy('order_type')
            ->get()
            ->map(fn ($row) => [
                'order_type' => $row->order_type,
                'count' => (int) $row->count,
                'revenue' => (float) $row->revenue,
            ]);

        $salesByPayment = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->where('status', 'completed')
            ->whereNotNull('payment_method')
            ->selectRaw("payment_method, count(*) as count, sum(total) as revenue")
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'count' => (int) $row->count,
                'revenue' => (float) $row->revenue,
            ]);

        $activeOrders = Order::whereIn('status', ['pending', 'confirmed', 'preparing', 'ready', 'served'])->count();
        $completedToday = Order::whereBetween('created_at', [$dateFrom, $dateTo])->where('status', 'completed')->count();
        $cancelledToday = Order::whereBetween('created_at', [$dateFrom, $dateTo])->where('status', 'cancelled')->count();

        $avgPrepTime = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->where('status', 'completed')
            ->get(['created_at', 'updated_at'])
            ->avg(fn ($order) => $order->created_at->diffInSeconds($order->updated_at) / 60);

        $statusBreakdown = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->selectRaw("status, count(*) as count")
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count]);

        $tables = Table::where('is_active', true)->get();
        $totalTables = $tables->count();
        $availableTables = $tables->where('status', 'available')->count();
        $occupiedTables = $tables->where('status', 'occupied')->count();
        $reservedTables = $tables->where('status', 'reserved')->count();
        $needsCleaning = $tables->where('status', 'needs_cleaning')->count();
        $maintenanceTables = $tables->where('status', 'maintenance')->count();
        $occupancyRate = $totalTables > 0 ? round(($occupiedTables / $totalTables) * 100, 1) : 0;

        $pendingKOTs = KotTicket::whereNotIn('status', ['completed', 'voided'])->count();
        $kotAvgWait = KotTicket::where('status', 'in_progress')
            ->where('created_at', '>=', now()->subHours(2))
            ->get(['created_at'])
            ->avg(fn ($kot) => $kot->created_at->diffInSeconds(now()) / 60) ?? 0;

        $kitchenOrders = KotTicket::whereIn('status', ['received', 'in_progress', 'ready'])
            ->with(['order.table', 'items'])
            ->orderBy('created_at', 'asc')
            ->limit(10)
            ->get()
            ->map(fn ($kot) => [
                'id' => $kot->id,
                'order_number' => $kot->order ? '#' . $kot->order->order_number : '#N/A',
                'table_number' => $kot->order?->table?->number,
                'order_type' => $kot->order?->order_type ?? 'dine_in',
                'items' => $kot->items ?? [],
                'status' => $kot->status,
                'elapsed_minutes' => (int) $kot->created_at->diffInMinutes(now()),
                'priority' => $kot->priority ?? 'normal',
            ]);

        $topSellingItems = OrderItem::whereHas('order', function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('created_at', [$dateFrom, $dateTo])->where('status', 'completed');
            })
            ->selectRaw("menu_item_id, name, sum(quantity) as quantity_sold, sum(total_price) as revenue")
            ->groupBy('menu_item_id', 'name')
            ->orderByDesc('quantity_sold')
            ->limit(10)
            ->get()
            ->map(fn ($item, $index) => [
                'id' => $item->menu_item_id,
                'name' => $item->name,
                'quantity_sold' => (int) $item->quantity_sold,
                'revenue' => (float) $item->revenue,
                'category' => '',
            ]);

        $peakHours = Order::whereBetween('created_at', [$dateFrom, $dateTo])
            ->where('status', 'completed')
            ->get(['created_at', 'total'])
            ->groupBy(fn ($order) => (int) $order->created_at->format('G'))
            ->sortKeys()
            ->map(fn ($rows, $hour) => [
                'hour' => (int) $hour,
                'orders' => $rows->count(),
                'revenue' => (float) $rows->sum('total'),
            ])
            ->values();

        $lowStockIngredients = Ingredient::where('is_active', true)
            ->whereColumn('current_stock', '<=', 'minimum_stock')
            ->get()
            ->map(fn ($ing, $index) => [
                'id' => $ing->id,
                'ingredient_name' => $ing->name,
                'current_stock' => (float) $ing->current_stock,
                'min_threshold' => (float) $ing->minimum_stock,
                'unit' => $ing->unit,
                'severity' => $ing->current_stock <= 0 ? 'out_of_stock' : ($ing->current_stock <= ($ing->minimum_stock / 2) ? 'critical' : 'low'),
                'supplier' => $ing->supplier?->name,
            ]);

        $dashboardAlerts = [];
        foreach ($lowStockIngredients as $alert) {
            $dashboardAlerts[] = [
                'id' => $alert['id'],
                'type' => 'low_inventory',
                'title' => 'Low Stock: ' . $alert['ingredient_name'],
                'message' => "{$alert['current_stock']} {$alert['unit']} remaining. Threshold is {$alert['min_threshold']} {$alert['unit']}.",
                'severity' => $alert['severity'] === 'out_of_stock' ? 'critical' : $alert['severity'],
                'created_at' => now()->toISOString(),
            ];
        }

        $upcomingReservations = Reservation::whereDate('reservation_date', today())
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->orderBy('reservation_date')
            ->limit(3)
            ->get();
        foreach ($upcomingReservations as $res) {
            $dashboardAlerts[] = [
                'id' => $res->id,
                'type' => 'reservation',
                'title' => 'Reservation at ' . Carbon::parse($res->reservation_date)->format('g:i A'),
                'message' => "{$res->guest_name} - party of {$res->party_size}",
                'severity' => 'info',
                'created_at' => $res->created_at?->toISOString() ?? now()->toISOString(),
            ];
        }

        $recentOrders = Order::with(['customer', 'table'])
            ->withCount('items')
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => '#' . $o->order_number,
                'customer_name' => $o->customer?->name ?? ($o->table ? 'Table ' . $o->table->number : null),
                'table_number' => $o->table?->number,
                'order_type' => $o->order_type,
                'status' => $o->status,
                'total' => (float) $o->total,
                'items_count' => $o->items_count ?? 0,
                'created_at' => $o->created_at?->toISOString(),
            ]);

        $recentActivities = Order::with(['customer', 'table'])
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->orderBy('created_at', 'desc')
            ->limit(15)
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'type' => match ($o->status) {
                    'pending' => 'order_placed',
                    'completed' => 'order_completed',
                    'cancelled' => 'order_cancelled',
                    default => 'order_placed',
                },
                'message' => 'Order #' . $o->order_number . ' ' . str_replace('_', ' ', $o->status),
                'details' => ($o->table ? 'Table ' . $o->table->number . ' — ' : '') . '₱' . number_format((float) $o->total, 0),
                'created_at' => $o->created_at?->toISOString(),
            ]);

        $totalCustomers = Customer::where('is_active', true)->count();
        $todayReservations = Reservation::whereDate('reservation_date', $today)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->count();
        $waitlistCount = Waitlist::where('status', 'waiting')->count();

        // Inventory operations (for the inventory_staff payload; quantities
        // only — unit costs and inventory value are never exposed here).
        $replenishmentByStatus = ReplenishmentRequest::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');
        $replenishmentPending = (int) ($replenishmentByStatus['submitted'] ?? 0)
            + (int) ($replenishmentByStatus['approved'] ?? 0)
            + (int) ($replenishmentByStatus['processing'] ?? 0);
        $recentMovements = StockMovement::with('ingredient:id,name,unit')
            ->orderBy('created_at', 'desc')
            ->limit(8)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'ingredient_name' => $m->ingredient?->name,
                'type' => $m->type,
                'quantity' => (float) $m->quantity,
                'reference_type' => $m->reference_type,
                'created_at' => $m->created_at?->toISOString(),
            ]);
        $outOfStockCount = Ingredient::where('is_active', true)
            ->where('current_stock', '<=', 0)->count();
        $lowStockCount = $lowStockIngredients->where('severity', '!=', 'out_of_stock')->count();

        $full = [
            'revenue' => [
                'today' => (float) $todayRevenue,
                'yesterday' => (float) $yesterdayRevenue,
                'this_week' => (float) $weekRevenue,
                'this_month' => (float) $monthRevenue,
                'comparison_percentage' => $comparisonPercentage,
                'daily_breakdown' => $dailyBreakdown,
            ],
            'sales' => [
                'total_today' => (float) $todayRevenue,
                'transaction_count' => $transactionCount,
                'average_ticket' => $averageTicket,
                'by_type' => $salesByType,
                'by_payment' => $salesByPayment,
            ],
            'orders' => [
                'total_today' => $todayOrders,
                'active' => $activeOrders,
                'completed' => $completedToday,
                'cancelled' => $cancelledToday,
                'average_preparation_time' => round((float) ($avgPrepTime ?? 0), 1),
                'status_breakdown' => $statusBreakdown,
            ],
            'tables' => [
                'total' => $totalTables,
                'available' => $availableTables,
                'occupied' => $occupiedTables,
                'reserved' => $reservedTables,
                'needs_cleaning' => $needsCleaning,
                'maintenance' => $maintenanceTables,
                'occupancy_rate' => $occupancyRate,
            ],
            'kitchen' => [
                'queue_length' => $pendingKOTs,
                'avg_wait_time' => round((float) $kotAvgWait, 1),
                'orders_in_progress' => $kitchenOrders,
            ],
            'top_selling_items' => $topSellingItems,
            'peak_hours' => $peakHours,
            'alerts' => $dashboardAlerts,
            'inventory_alerts' => $lowStockIngredients,
            'inventory_low_count' => $lowStockCount,
            'inventory_out_count' => $outOfStockCount,
            'replenishment_pending' => $replenishmentPending,
            'replenishment_by_status' => $replenishmentByStatus,
            'recent_movements' => $recentMovements,
            'recent_orders' => $recentOrders,
            'recent_activities' => $recentActivities,
            'meta' => [
                'total_customers' => $totalCustomers,
                'today_reservations' => $todayReservations,
                'waitlist_count' => $waitlistCount,
                'date_range' => [
                    'from' => $dateFrom->toDateString(),
                    'to' => $dateTo->toDateString(),
                ],
            ],
        ];

        return $this->success($this->payloadForRole($request->user(), $full, [
            'today_reservations' => $todayReservations,
            'waitlist_count' => $waitlistCount,
        ]));
    }

    /**
     * Role-aware payload filter. Admin/manager receive the full management
     * payload; every operational role receives ONLY its job-relevant
     * sections. Sensitive sections (revenue, sales, customer analytics,
     * supplier data, inventory value) are never sent to unauthorized roles
     * — frontend hiding alone would still leak them via direct API calls.
     */
    private function payloadForRole($user, array $full, array $serviceMeta): array
    {
        if ($user->hasRole('admin') || $user->hasRole('manager')) {
            return $full;
        }

        $reservationAlerts = array_values(array_filter(
            $full['alerts'],
            fn ($a) => ($a['type'] ?? null) === 'reservation'
        ));
        $inventoryOnlyAlerts = array_values(array_filter(
            $full['alerts'],
            fn ($a) => ($a['type'] ?? null) === 'low_inventory'
        ));

        if ($user->hasRole('waiter')) {
            return [
                'orders' => $full['orders'],
                'tables' => $full['tables'],
                'kitchen' => $full['kitchen'],
                'recent_orders' => $full['recent_orders'],
                'alerts' => $reservationAlerts,
                'meta' => $serviceMeta,
            ];
        }

        if ($user->hasRole('cashier')) {
            return [
                'orders' => $full['orders'],
                'tables' => $full['tables'],
                'recent_orders' => $full['recent_orders'],
                'meta' => $serviceMeta,
            ];
        }

        if ($user->hasRole('kitchen_staff')) {
            return [
                'orders' => $full['orders'],
                'kitchen' => $full['kitchen'],
                'recent_orders' => $full['recent_orders'],
            ];
        }

        if ($user->hasRole('inventory_staff')) {
            return [
                'inventory' => [
                    'low_stock_count' => $full['inventory_low_count'] ?? 0,
                    'out_of_stock_count' => $full['inventory_out_count'] ?? 0,
                    'replenishment_pending' => $full['replenishment_pending'] ?? 0,
                    'replenishment_by_status' => $full['replenishment_by_status'] ?? [],
                    'recent_movements' => $full['recent_movements'] ?? [],
                ],
                'inventory_alerts' => $full['inventory_alerts'],
                'alerts' => $inventoryOnlyAlerts,
            ];
        }

        return [];
    }

    public function revenue(Request $request): JsonResponse
    {
        $period = $request->input('period', 'daily');
        $startDate = $request->input('start_date', now()->subDays(30)->toDateString());
        $endDate = $request->input('end_date', now()->toDateString());

        $query = Order::where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate]);

        $rows = $query->get(['created_at', 'total']);

        $groupFormat = match ($period) {
            'weekly' => 'o-W',
            'monthly' => 'Y-m',
            default => 'Y-m-d',
        };

        $data = $rows
            ->groupBy(fn ($order) => $order->created_at->format($groupFormat))
            ->sortKeys()
            ->map(function ($group) use ($period) {
                $anchor = $group->first()->created_at->copy();
                $label = match ($period) {
                    'weekly' => $anchor->startOfWeek()->toDateString(),
                    'monthly' => $anchor->startOfMonth()->toDateString(),
                    default => $anchor->toDateString(),
                };

                return (object) [
                    'date' => $label,
                    'revenue' => (float) $group->sum('total'),
                    'orders' => $group->count(),
                ];
            })
            ->values();

        return $this->success([
            'period' => $period,
            'items' => $data->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ]),
            'total_revenue' => (float) $data->sum('revenue'),
            'total_orders' => $data->sum('orders'),
        ]);
    }

    public function orders(Request $request): JsonResponse
    {
        $statusCounts = Order::selectRaw("status, count(*) as count")
            ->groupBy('status')
            ->pluck('count', 'status');

        $typeCounts = Order::whereDate('created_at', now())
            ->selectRaw("order_type, count(*) as count")
            ->groupBy('order_type')
            ->pluck('count', 'order_type');

        $avgOrderValue = Order::where('status', 'completed')
            ->whereDate('created_at', now())
            ->avg('total');

        return $this->success([
            'by_status' => $statusCounts,
            'today_by_type' => $typeCounts,
            'today_avg_order_value' => round((float) $avgOrderValue, 2),
        ]);
    }

    public function tables(Request $request): JsonResponse
    {
        $tables = Table::with('floorPlan')
            ->where('is_active', true)
            ->orderBy('number')
            ->get();

        $byStatus = $tables->groupBy('status')->map(fn ($t) => $t->count());
        $byFloor = $tables->groupBy('floorPlan.name')->map(function ($items) {
            return [
                'total' => $items->count(),
                'available' => $items->where('status', 'available')->count(),
                'occupied' => $items->where('status', 'occupied')->count(),
                'reserved' => $items->where('status', 'reserved')->count(),
            ];
        });

        return $this->success([
            'summary' => [
                'total' => $tables->count(),
                'by_status' => $byStatus,
            ],
            'by_floor' => $byFloor,
        ]);
    }

    public function alerts(Request $request): JsonResponse
    {
        $alerts = [];

        $lowStock = Ingredient::where('is_active', true)
            ->whereColumn('current_stock', '<=', 'minimum_stock')
            ->get();

        foreach ($lowStock as $ingredient) {
            $alerts[] = [
                'type' => 'low_stock',
                'severity' => 'warning',
                'message' => "{$ingredient->name} is low on stock ({$ingredient->current_stock} {$ingredient->unit})",
                'ingredient_id' => $ingredient->id,
            ];
        }

        $longPending = Order::whereIn('status', ['pending', 'preparing'])
            ->where('created_at', '<', now()->subMinutes(30))
            ->get();

        foreach ($longPending as $order) {
            $alerts[] = [
                'type' => 'long_pending_order',
                'severity' => 'critical',
                'message' => "Order {$order->order_number} has been pending for over 30 minutes",
                'order_id' => $order->id,
            ];
        }

        $waitlistLong = Waitlist::where('status', 'waiting')
            ->where('created_at', '<', now()->subMinutes(45))
            ->get();

        foreach ($waitlistLong as $w) {
            $alerts[] = [
                'type' => 'waitlist_timeout',
                'severity' => 'info',
                'message' => "{$w->guest_name} has been on waitlist for over 45 minutes",
                'waitlist_id' => $w->id,
            ];
        }

        return $this->success([
            'items' => $alerts,
            'count' => count($alerts),
        ]);
    }
}
