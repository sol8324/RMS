<?php

namespace Tests\Feature;

use App\Models\FloorPlan;
use App\Models\Role;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTableAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private string $floorPlanId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();
        $this->admin->roles()->attach(
            Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin', 'module' => 'system'])
        );
        $this->floorPlanId = FloorPlan::create(['name' => 'Avail Floor', 'is_active' => true])->id;
    }

    private function makeTable(string $number, string $status = 'available', bool $isActive = true): Table
    {
        return Table::create([
            'floor_plan_id' => $this->floorPlanId,
            'number' => $number,
            'capacity' => 4,
            'status' => $status,
            'shape' => 'rectangular',
            'pos_x' => 0.0,
            'pos_y' => 0.0,
            'width' => 1.0,
            'height' => 1.0,
            'is_active' => $isActive,
        ]);
    }

    private function reservationPayload(?string $tableId): array
    {
        return [
            'guest_name' => 'Avail Guest',
            'guest_phone' => '09170000009',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
            'table_id' => $tableId,
            'card_on_file' => true,
        ];
    }

    public function test_store_rejects_needs_cleaning_table(): void
    {
        $table = $this->makeTable('TA1', 'needs_cleaning');

        $this->actingAs($this->admin)
            ->postJson('/api/v1/reservations', $this->reservationPayload($table->id))
            ->assertStatus(422);
    }

    public function test_store_rejects_maintenance_table(): void
    {
        $table = $this->makeTable('TA2', 'maintenance');

        $this->actingAs($this->admin)
            ->postJson('/api/v1/reservations', $this->reservationPayload($table->id))
            ->assertStatus(422);
    }

    public function test_store_rejects_archived_table(): void
    {
        $table = $this->makeTable('TA3', 'available', false);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/reservations', $this->reservationPayload($table->id))
            ->assertStatus(422);
    }

    public function test_store_accepts_available_table(): void
    {
        $table = $this->makeTable('TA4', 'available');

        $this->actingAs($this->admin)
            ->postJson('/api/v1/reservations', $this->reservationPayload($table->id))
            ->assertCreated();
    }

    public function test_available_endpoint_excludes_unusable_tables(): void
    {
        $this->makeTable('TA5', 'available');
        $this->makeTable('TA6', 'needs_cleaning');
        $this->makeTable('TA7', 'maintenance');
        $this->makeTable('TA8', 'available', false);

        $response = $this->actingAs($this->admin)->getJson('/api/v1/tables/available?' . http_build_query([
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
            'party_size' => 2,
        ]));

        $response->assertOk();
        $numbers = collect($response->json('data.items'))->pluck('number')->all();
        $this->assertContains('TA5', $numbers);
        $this->assertNotContains('TA6', $numbers);
        $this->assertNotContains('TA7', $numbers);
        $this->assertNotContains('TA8', $numbers);
    }
}
