<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Table;
use App\Models\User;
use App\Services\PricingService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class RecentAnalyticsSeeder extends Seeder
{
    private const ORDER_PREFIX = 'ORD-DEMO-ANALYTICS-';

    private const INVOICE_PREFIX = 'INV-DEMO-ANALYTICS-';

    private const PAYMENT_PREFIX = 'PAY-DEMO-ANALYTICS-';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing', 'development', 'dev'])) {
            throw new \RuntimeException(
                'RecentAnalyticsSeeder only runs in local/testing/development environments.'
            );
        }

        DB::transaction(function (): void {
            $this->removePreviousDemoOrders();

            $pricing = app(PricingService::class);
            $menuItems = MenuItem::query()
                ->where('is_available', true)
                ->where('price', '>', 0)
                ->get();

            if ($menuItems->isEmpty()) {
                throw new \RuntimeException('RecentAnalyticsSeeder requires at least one available menu item.');
            }

            $customers = Customer::query()
                ->where('is_active', true)
                ->pluck('id')
                ->all();
            $tables = Table::query()
                ->where('is_active', true)
                ->pluck('id')
                ->all();
            $actorId = User::where('email', 'admin@rms.com')->value('id')
                ?? User::query()->value('id');

            mt_srand(20261027);

            $sequence = 1;
            $startDate = now()->subDays(29)->startOfDay();

            Model::unguarded(function () use (
                $pricing,
                $menuItems,
                $customers,
                $tables,
                $actorId,
                $startDate,
                &$sequence
            ): void {
                for ($dayOffset = 0; $dayOffset < 30; $dayOffset++) {
                    $day = $startDate->copy()->addDays($dayOffset);
                    $isWeekend = in_array($day->dayOfWeek, [5, 6], true);
                    $ordersToday = $isWeekend
                        ? mt_rand(24, 38)
                        : mt_rand(18, 30);

                    for ($i = 0; $i < $ordersToday; $i++) {
                        $createdAt = $this->randomOrderTime($day);
                        $orderType = $this->weightedValue([
                            'dine_in' => 62,
                            'takeout' => 24,
                            'delivery' => 14,
                        ]);
                        $isCancelled = mt_rand(1, 100) <= 6;
                        $paymentMethod = $this->weightedValue([
                            'cash' => 52,
                            'card' => 30,
                            'e_wallet' => 18,
                        ]);

                        $lineItems = $this->buildLineItems($menuItems);
                        $subtotal = round($lineItems->sum('total_price'), 2);
                        $totals = $pricing->orderTotals($subtotal);

                        $orderNumber = self::ORDER_PREFIX . str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
                        $customerId = $customers !== [] && mt_rand(1, 100) <= 70
                            ? $customers[array_rand($customers)]
                            : null;
                        $tableId = $orderType === 'dine_in' && $tables !== []
                            ? $tables[array_rand($tables)]
                            : null;

                        $order = Order::create([
                            'order_number' => $orderNumber,
                            'customer_id' => $customerId,
                            'table_id' => $tableId,
                            'order_type' => $orderType,
                            'status' => $isCancelled ? 'cancelled' : 'completed',
                            'subtotal' => $totals['subtotal'],
                            'tax_amount' => $totals['tax_amount'],
                            'discount_amount' => $totals['discount_amount'],
                            'service_charge' => $totals['service_charge'],
                            'total' => $totals['total'],
                            'payment_status' => $isCancelled ? 'unpaid' : 'paid',
                            'payment_method' => $isCancelled ? null : $paymentMethod,
                            'notes' => 'Recent analytics demo order.',
                            'cancellation_reason' => $isCancelled ? 'Guest cancelled the order.' : null,
                            'created_by' => $actorId,
                            'created_at' => $createdAt,
                            'updated_at' => $createdAt,
                        ]);

                        foreach ($lineItems as $lineItem) {
                            OrderItem::create([
                                'order_id' => $order->id,
                                'menu_item_id' => $lineItem['menu_item_id'],
                                'name' => $lineItem['name'],
                                'quantity' => $lineItem['quantity'],
                                'unit_price' => $lineItem['unit_price'],
                                'total_price' => $lineItem['total_price'],
                                'discount_amount' => 0,
                                'status' => $isCancelled ? 'cancelled' : 'served',
                                'created_at' => $createdAt->copy()->addMinutes(2),
                                'updated_at' => $createdAt->copy()->addMinutes(2),
                            ]);
                        }

                        $statuses = $isCancelled
                            ? ['pending', 'confirmed', 'cancelled']
                            : ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

                        foreach ($statuses as $statusIndex => $status) {
                            $statusAt = $createdAt->copy()->addMinutes($statusIndex * 6);
                            OrderStatusHistory::create([
                                'order_id' => $order->id,
                                'status' => $status,
                                'notes' => 'Recent analytics demo workflow.',
                                'changed_by' => $actorId,
                                'created_at' => $statusAt,
                                'updated_at' => $statusAt,
                            ]);
                        }

                        if (! $isCancelled) {
                            $paidAt = $createdAt->copy()->addMinutes(35);
                            $invoice = Invoice::create([
                                'invoice_number' => self::INVOICE_PREFIX . str_pad((string) $sequence, 5, '0', STR_PAD_LEFT),
                                'order_id' => $order->id,
                                'subtotal' => $totals['subtotal'],
                                'tax_amount' => $totals['tax_amount'],
                                'discount_amount' => $totals['discount_amount'],
                                'service_charge' => $totals['service_charge'],
                                'total' => $totals['total'],
                                'amount_paid' => $totals['total'],
                                'balance' => 0,
                                'status' => 'paid',
                                'created_at' => $paidAt,
                                'updated_at' => $paidAt,
                            ]);

                            Payment::create([
                                'invoice_id' => $invoice->id,
                                'amount' => $totals['total'],
                                'payment_method' => $paymentMethod,
                                'reference_number' => self::PAYMENT_PREFIX . str_pad((string) $sequence, 5, '0', STR_PAD_LEFT),
                                'notes' => 'Recent analytics demo payment.',
                                'processed_by' => $actorId,
                                'created_at' => $paidAt,
                                'updated_at' => $paidAt,
                            ]);
                        }

                        $sequence++;
                    }
                }
            });

            $this->clearAnalyticsCaches();

            $this->command?->info('Recent analytics demo data ready.');
            $this->command?->line(sprintf('  Created %d orders across the last 30 days.', $sequence - 1));
            $this->command?->line('  Forecast and AI insight caches were cleared.');
        });
    }

    private function removePreviousDemoOrders(): void
    {
        Order::withTrashed()
            ->where('order_number', 'like', self::ORDER_PREFIX . '%')
            ->get()
            ->each
            ->forceDelete();
    }

    private function buildLineItems($menuItems)
    {
        $lineCount = min(mt_rand(1, 5), $menuItems->count());
        $selected = [];
        $items = collect();

        while (count($selected) < $lineCount) {
            $index = array_rand($menuItems->all());
            $selected[$index] = true;
        }

        foreach (array_keys($selected) as $index) {
            $menuItem = $menuItems[$index];
            $quantity = mt_rand(1, 3);
            $unitPrice = (float) $menuItem->price;

            $items->push([
                'menu_item_id' => $menuItem->id,
                'name' => $menuItem->name,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => round($unitPrice * $quantity, 2),
            ]);
        }

        return $items;
    }

    private function randomOrderTime(Carbon $day): Carbon
    {
        $open = $day->copy()->setTime(10, 0);
        $close = $day->copy()->setTime(21, 30);

        if ($day->isToday()) {
            $close = now()->subMinutes(5);
        }

        if ($close->lessThan($open)) {
            $open = $day->copy();
            $close = now();
        }

        $openTimestamp = $open->getTimestamp();
        $closeTimestamp = max($openTimestamp, $close->getTimestamp());

        return Carbon::createFromTimestamp(
            mt_rand($openTimestamp, $closeTimestamp),
            $day->getTimezone()
        );
    }

    private function weightedValue(array $weights): string
    {
        $roll = mt_rand(1, array_sum($weights));

        foreach ($weights as $value => $weight) {
            $roll -= $weight;

            if ($roll <= 0) {
                return $value;
            }
        }

        return (string) array_key_first($weights);
    }

    private function clearAnalyticsCaches(): void
    {
        if (config('cache.default') !== 'database') {
            Cache::flush();

            return;
        }

        DB::table(config('cache.stores.database.table', 'cache'))
            ->where(function ($query): void {
                $query->where('key', 'like', '%demand_forecast:%')
                    ->orWhere('key', 'like', '%ai_insights:%');
            })
            ->delete();
    }
}
