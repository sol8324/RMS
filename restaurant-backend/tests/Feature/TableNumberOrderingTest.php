<?php

namespace Tests\Feature;

use App\Models\FloorPlan;
use App\Models\Role;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TableNumberOrderingTest extends TestCase
{
    use RefreshDatabase;

    private const NATURAL_ORDER = ['1', '2', '10', 'TBL-2', 'TBL-10'];

    private User $user;

    private FloorPlan $floorPlan;

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

        foreach (['10', 'TBL-10', '2', '1', 'TBL-2'] as $number) {
            Table::create([
                'floor_plan_id' => $this->floorPlan->id,
                'number' => $number,
                'capacity' => 4,
                'status' => 'available',
                'is_active' => true,
            ]);
        }
    }

    public function test_tables_index_and_floor_plan_use_natural_number_order(): void
    {
        $index = $this->actingAs($this->user)->getJson('/api/v1/tables')->assertOk();
        $this->assertSame(self::NATURAL_ORDER, collect($index->json('data.items'))->pluck('number')->all());

        $floorPlan = $this->actingAs($this->user)
            ->getJson("/api/v1/floor-plans/{$this->floorPlan->id}")
            ->assertOk();
        $this->assertSame(self::NATURAL_ORDER, collect($floorPlan->json('data.tables'))->pluck('number')->all());
    }

    public function test_order_eligible_and_available_tables_use_natural_number_order(): void
    {
        $eligible = $this->actingAs($this->user)
            ->getJson('/api/v1/tables/order-eligible')
            ->assertOk();
        $this->assertSame(self::NATURAL_ORDER, collect($eligible->json('data.items'))->pluck('number')->all());

        $available = $this->actingAs($this->user)
            ->getJson('/api/v1/tables/available?reservation_date=2030-01-01&reservation_time=12:00')
            ->assertOk();
        $this->assertSame(self::NATURAL_ORDER, collect($available->json('data.items'))->pluck('number')->all());
    }

    public function test_calendar_table_occupancy_uses_natural_number_order(): void
    {
        $calendar = $this->actingAs($this->user)
            ->getJson('/api/v1/reservations/calendar?start_date=2030-01-01&end_date=2030-01-01')
            ->assertOk();

        $this->assertSame(
            self::NATURAL_ORDER,
            collect($calendar->json('data.table_occupancy.2030-01-01'))->pluck('number')->all()
        );
    }
}
