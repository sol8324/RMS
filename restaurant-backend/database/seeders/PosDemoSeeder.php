<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Table;
use App\Models\User;
use App\Services\PricingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PosDemoSeeder extends Seeder
{
    private const ORDER_NUMBERS = [
        'ORD-POS-DEMO-1001',
        'ORD-POS-DEMO-1002',
        'ORD-POS-DEMO-1003',
        'ORD-POS-DEMO-1004',
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing', 'development', 'dev'])) {
            throw new \RuntimeException(
                'PosDemoSeeder only runs in local/testing/development environments.'
            );
        }

        DB::transaction(function (): void {
            $this->removePreviousDemoOrders();

            $pricing = app(PricingService::class);
            $actorId = User::where('email', 'admin@rms.com')->value('id')
                ?? User::query()->value('id');

            $category = MenuCategory::firstOrCreate(
                ['slug' => 'pos-demo'],
                [
                    'name' => 'POS Demo',
                    'description' => 'Example items used by the POS demo orders.',
                    'sort_order' => 99,
                    'is_active' => true,
                ]
            );

            $burger = MenuItem::firstOrCreate(
                ['sku' => 'POS-DEMO-BURGER'],
                [
                    'category_id' => $category->id,
                    'name' => 'Demo House Burger',
                    'slug' => 'demo-house-burger',
                    'description' => 'Sample POS item. Not linked to a recipe.',
                    'price' => 250.00,
                    'is_available' => true,
                    'prep_time_minutes' => 10,
                    'tags' => ['demo'],
                ]
            );

            $tea = MenuItem::firstOrCreate(
                ['sku' => 'POS-DEMO-ICED-TEA'],
                [
                    'category_id' => $category->id,
                    'name' => 'Demo Iced Tea',
                    'slug' => 'demo-iced-tea',
                    'description' => 'Sample POS item. Not linked to a recipe.',
                    'price' => 80.00,
                    'is_available' => true,
                    'prep_time_minutes' => 3,
                    'tags' => ['demo'],
                ]
            );

            $customer = Customer::firstOrCreate(
                ['email' => 'pos.demo@example.local'],
                [
                    'name' => 'POS Demo Guest',
                    'phone' => '09170000000',
                    'customer_type' => 'walk_in',
                    'is_active' => true,
                    'notes' => 'Created by PosDemoSeeder.',
                ]
            );

            $tables = [];

            foreach (['1' => 2, '2' => 4, '3' => 4, '4' => 6] as $number => $capacity) {
                $tables[$number] = Table::firstOrCreate(
                    ['number' => $number],
                    [
                        'capacity' => $capacity,
                        'status' => 'available',
                        'shape' => 'rectangle',
                        'is_active' => true,
                    ]
                );
            }

            $this->createServedOrder(
                $tables['1'],
                self::ORDER_NUMBERS[0],
                [[$burger, 2], [$tea, 1]],
                $pricing,
                $actorId,
                $customer->id
            );

            $this->createServedOrder(
                $tables['2'],
                self::ORDER_NUMBERS[1],
                [[$burger, 1], [$tea, 2]],
                $pricing,
                $actorId,
                $customer->id
            );

            $this->createServedOrder(
                $tables['3'],
                self::ORDER_NUMBERS[2],
                [[$tea, 1]],
                $pricing,
                $actorId
            );

            $this->createServedOrder(
                $tables['3'],
                self::ORDER_NUMBERS[3],
                [[$burger, 1]],
                $pricing,
                $actorId
            );

            $tables['1']->update(['status' => 'occupied']);
            $tables['2']->update(['status' => 'occupied']);
            $tables['3']->update(['status' => 'occupied']);

            $tableFourHasActiveOrders = Order::where('table_id', $tables['4']->id)
                ->whereIn('status', ['pending', 'confirmed', 'preparing', 'ready', 'served'])
                ->exists();

            if (! $tableFourHasActiveOrders) {
                $tables['4']->update(['status' => 'available']);
            }

            $this->command?->info('POS demo data ready.');
            $this->command?->line('  Table 1: one served/unpaid order (auto-loads on selection)');
            $this->command?->line('  Table 2: one served/unpaid order (auto-loads on selection)');
            $this->command?->line('  Table 3: two served/unpaid orders (shows the order picker)');
            $this->command?->line('  Table 4: available table with no unpaid orders');
        });
    }

    private function removePreviousDemoOrders(): void
    {
        Order::withTrashed()
            ->whereIn('order_number', self::ORDER_NUMBERS)
            ->get()
            ->each
            ->forceDelete();
    }

    private function createServedOrder(
        Table $table,
        string $orderNumber,
        array $lines,
        PricingService $pricing,
        ?string $actorId,
        ?string $customerId = null
    ): Order {
        $subtotal = 0.0;
        $lineData = [];

        foreach ($lines as [$menuItem, $quantity]) {
            $unitPrice = (float) $menuItem->price;
            $totalPrice = round($unitPrice * $quantity, 2);
            $subtotal += $totalPrice;

            $lineData[] = [
                'menu_item_id' => $menuItem->id,
                'name' => $menuItem->name,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'discount_amount' => 0,
                'status' => 'served',
            ];
        }

        $totals = $pricing->orderTotals(round($subtotal, 2));

        $order = Order::create([
            'order_number' => $orderNumber,
            'customer_id' => $customerId,
            'table_id' => $table->id,
            'order_type' => 'dine_in',
            'status' => 'served',
            'subtotal' => $totals['subtotal'],
            'tax_amount' => $totals['tax_amount'],
            'discount_amount' => $totals['discount_amount'],
            'service_charge' => $totals['service_charge'],
            'total' => $totals['total'],
            'payment_status' => 'unpaid',
            'payment_method' => null,
            'notes' => 'POS demo order created by PosDemoSeeder.',
            'created_by' => $actorId,
        ]);

        foreach ($lineData as $line) {
            OrderItem::create(['order_id' => $order->id, ...$line]);
        }

        foreach (['pending', 'confirmed', 'preparing', 'ready', 'served'] as $status) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $status,
                'notes' => 'POS demo workflow.',
                'changed_by' => $actorId,
            ]);
        }

        return $order;
    }
}
