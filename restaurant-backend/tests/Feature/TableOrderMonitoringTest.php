<?php

namespace Tests\Feature;

use App\Models\FloorPlan;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Role;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TableOrderMonitoringTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private FloorPlan $floorPlan;

    private Table $table;

    private Table $otherTable;

    private MenuItem $menuItem;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->user->roles()->attach(
            Role::firstOrCreate(
                ['name' => 'admin'],
                ['display_name' => 'Admin', 'module' => 'system']
            )
        );

        $this->floorPlan = FloorPlan::create([
            'name' => 'Main Floor',
            'sort_order' => 1,
        ]);

        $this->table = Table::create([
            'floor_plan_id' => $this->floorPlan->id,
            'number' => 'T1',
            'capacity' => 4,
            'status' => 'occupied',
            'shape' => 'rectangle',
            'is_active' => true,
            'is_wheelchair_accessible' => true,
        ]);

        $this->otherTable = Table::create([
            'floor_plan_id' => $this->floorPlan->id,
            'number' => 'T2',
            'capacity' => 2,
            'status' => 'occupied',
            'shape' => 'square',
            'is_active' => true,
        ]);

        $category = MenuCategory::create([
            'name' => 'Mains',
            'slug' => 'mains-'.uniqid(),
        ]);

        $this->menuItem = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Rice Bowl',
            'slug' => 'rice-bowl-'.uniqid(),
            'price' => 100,
        ]);
    }

    public function test_active_table_orders_include_items_and_exclude_terminal_or_other_table_orders(): void
    {
        $pending = $this->createOrder($this->table, 'pending');
        $onHold = $this->createOrder($this->table, 'on_hold');
        $completed = $this->createOrder($this->table, 'completed');
        $otherTable = $this->createOrder($this->otherTable, 'preparing');

        OrderItem::create([
            'order_id' => $pending->id,
            'menu_item_id' => $this->menuItem->id,
            'name' => 'Rice Bowl',
            'quantity' => 2,
            'unit_price' => 100,
            'total_price' => 200,
            'status' => 'preparing',
            'notes' => 'No chili',
        ]);

        $response = $this->actingAs($this->user)->getJson(
            "/api/v1/orders?table_id={$this->table->id}&active=1&with_items=1"
        );

        $response->assertOk();
        $rows = collect($response->json('data.items'));
        $ids = $rows->pluck('id');

        $this->assertCount(2, $rows);
        $this->assertTrue($ids->contains($pending->id));
        $this->assertTrue($ids->contains($onHold->id));
        $this->assertFalse($ids->contains($completed->id));
        $this->assertFalse($ids->contains($otherTable->id));

        $pendingRow = $rows->firstWhere('id', $pending->id);
        $this->assertCount(1, $pendingRow['items']);
        $this->assertSame('Rice Bowl', $pendingRow['items'][0]['name']);
        $this->assertSame(2, $pendingRow['items'][0]['quantity']);
        $this->assertSame('No chili', $pendingRow['items'][0]['notes']);
        $this->assertSame([], $pendingRow['items'][0]['modifiers']);
    }

    public function test_items_are_not_added_to_the_order_list_unless_requested(): void
    {
        $this->createOrder($this->table, 'pending');

        $response = $this->actingAs($this->user)->getJson(
            "/api/v1/orders?table_id={$this->table->id}&active=1"
        );

        $response->assertOk();
        $row = $response->json('data.items.0');

        $this->assertArrayNotHasKey('items', $row);
    }

    public function test_table_id_filter_requires_a_uuid(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/v1/orders?table_id=not-a-uuid&active=1')
            ->assertStatus(422);
    }

    public function test_tables_api_exposes_wheelchair_accessibility_and_floor_plan(): void
    {
        $response = $this->actingAs($this->user)->getJson('/api/v1/tables');

        $response->assertOk();
        $row = collect($response->json('data.items'))->firstWhere('id', $this->table->id);

        $this->assertTrue($row['is_wheelchair_accessible']);
        $this->assertSame('Main Floor', $row['floor_plan']['name']);
    }

    private function createOrder(Table $table, string $status): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'order_type' => 'dine_in',
            'table_id' => $table->id,
            'status' => $status,
            'payment_status' => 'unpaid',
            'subtotal' => 100,
            'total' => 100,
        ]);
    }
}
