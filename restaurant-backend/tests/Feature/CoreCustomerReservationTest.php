<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FloorPlan;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoreCustomerReservationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();
        $this->admin->roles()->attach(
            Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin', 'module' => 'system'])
        );
    }

    private function makeTable(int $capacity = 4, bool $isActive = true): Table
    {
        $plan = FloorPlan::create(['name' => 'Test Floor ' . uniqid(), 'is_active' => true]);

        return Table::create([
            'floor_plan_id' => $plan->id,
            'number' => 'T' . uniqid(),
            'capacity' => $capacity,
            'status' => 'available',
            'shape' => 'rectangular',
            'pos_x' => 0.0,
            'pos_y' => 0.0,
            'width' => 1.0,
            'height' => 1.0,
            'is_active' => $isActive,
        ]);
    }

    public function test_saved_customer_is_always_registered_with_zero_derived_metrics(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/customers', [
            'name' => 'UAT Registered Customer',
            'customer_type' => 'walk_in',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.customer_type', 'registered')
            ->assertJsonPath('data.total_orders', 0)
            ->assertJsonPath('data.total_reservations', 0)
            ->assertJsonPath('data.visit_count', 0)
            ->assertJsonPath('data.loyalty_tier', 'Member');

        $this->assertDatabaseHas('customers', [
            'id' => $response->json('data.id'),
            'customer_type' => 'registered',
        ]);
    }

    public function test_registered_reservation_uses_customer_identity_without_incrementing_visit(): void
    {
        $customer = Customer::create([
            'name' => 'UAT Reservation Customer',
            'phone' => '09171234567',
            'email' => 'reservation-customer@uat.local',
        ]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'customer_id' => $customer->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.customer.id', $customer->id)
            ->assertJsonPath('data.guest_name', $customer->name);

        $this->assertSame(0, (int) $customer->fresh()->visit_count);

        $this->actingAs($this->admin)
            ->getJson("/api/v1/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.total_reservations', 1)
            ->assertJsonCount(1, 'data.reservations');
    }

    public function test_guest_reservation_has_no_customer_profile_and_requires_contact(): void
    {
        $before = Customer::count();

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'UAT Guest',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
        ])->assertUnprocessable();

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'UAT Guest',
            'guest_phone' => '09170000000',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.customer_id', null)
            ->assertJsonPath('data.customer', null)
            ->assertJsonPath('data.guest_name', 'UAT Guest');

        $this->assertSame($before, Customer::count());
        $this->assertNull(Reservation::find($response->json('data.id'))->customer_id);
    }

    public function test_registered_reservation_passes(): void
    {
        $table = $this->makeTable(4);
        $customer = Customer::create([
            'name' => 'UAT Reg Customer',
            'phone' => '09171234567',
            'email' => 'reg@uat.local',
        ]);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'customer_id' => $customer->id,
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();
    }

    public function test_guest_reservation_passes_without_customer(): void
    {
        $table = $this->makeTable(4);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'UAT Guest',
            'guest_phone' => '09170000000',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
        ])->assertCreated();
    }

    public function test_overlapping_same_table_is_rejected(): void
    {
        $table = $this->makeTable(4);
        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'First',
            'guest_phone' => '09170000001',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Second',
            'guest_phone' => '09170000002',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:30',
        ])->assertStatus(409)
            ->assertJsonPath('message', 'This table is already reserved for the selected time.');
    }

    public function test_non_overlapping_same_table_is_allowed(): void
    {
        $table = $this->makeTable(4);
        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'First',
            'guest_phone' => '09170000001',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();

        // Party size 2 = 3 hour duration (180 min), so first ends at 21:00
        // Second at 21:00 should not overlap
        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Second',
            'guest_phone' => '09170000002',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '21:00',
        ])->assertCreated();
    }

    public function test_different_table_same_time_is_allowed(): void
    {
        $tableA = $this->makeTable(4);
        $tableB = $this->makeTable(4);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'First',
            'guest_phone' => '09170000001',
            'table_id' => $tableA->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Second',
            'guest_phone' => '09170000002',
            'table_id' => $tableB->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();
    }

    public function test_update_reservation_without_changing_time_passes(): void
    {
        $table = $this->makeTable(4);
        $reservation = Reservation::create([
            'customer_id' => null,
            'table_id' => $table->id,
            'guest_name' => 'UAT Guest',
            'guest_phone' => '09170000001',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
            'status' => 'pending',
            'source' => 'app',
            'reservation_number' => 'RES-' . uniqid(),
        ]);

        $this->actingAs($this->admin)
            ->putJson("/api/v1/reservations/{$reservation->id}", [
                'guest_name' => 'Updated Guest',
            ])
            ->assertOk();
    }

    public function test_update_into_another_active_reservation_is_rejected(): void
    {
        $table = $this->makeTable(4);
        $a = Reservation::create([
            'customer_id' => null,
            'table_id' => $table->id,
            'guest_name' => 'First',
            'guest_phone' => '09170000001',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
            'status' => 'pending',
            'source' => 'app',
            'reservation_number' => 'RES-' . uniqid(),
        ]);
        Reservation::create([
            'customer_id' => null,
            'table_id' => $table->id,
            'guest_name' => 'Second',
            'guest_phone' => '09170000002',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '19:00',
            'status' => 'pending',
            'source' => 'app',
            'reservation_number' => 'RES-' . uniqid(),
        ]);

        $this->actingAs($this->admin)
            ->putJson("/api/v1/reservations/{$a->id}", [
                'reservation_time' => '19:00',
            ])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This table is already reserved for the selected time.');
    }

    public function test_cancelled_slot_can_be_reused(): void
    {
        $table = $this->makeTable(4);
        Reservation::create([
            'customer_id' => null,
            'table_id' => $table->id,
            'guest_name' => 'First',
            'guest_phone' => '09170000001',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
            'status' => 'cancelled',
            'source' => 'app',
            'cancellation_reason' => 'Test',
            'reservation_number' => 'RES-' . uniqid(),
        ]);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'New Guest',
            'guest_phone' => '09170000002',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertCreated();
    }

    public function test_party_size_exceeding_capacity_is_rejected(): void
    {
        $table = $this->makeTable(4);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Big Party',
            'guest_phone' => '09170000001',
            'table_id' => $table->id,
            'party_size' => 10,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Party size exceeds the capacity of the selected table.');
    }

    public function test_inactive_table_is_rejected(): void
    {
        $table = $this->makeTable(4, false);

        $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Guest',
            'guest_phone' => '09170000001',
            'table_id' => $table->id,
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'The selected table is not available.');
    }

    public function test_update_party_size_into_overflow_is_rejected(): void
    {
        $table = $this->makeTable(4);
        $reservation = Reservation::create([
            'customer_id' => null,
            'table_id' => $table->id,
            'guest_name' => 'Guest',
            'guest_phone' => '09170000001',
            'party_size' => 2,
            'reservation_date' => now()->addDay()->toDateString(),
            'reservation_time' => '18:00',
            'status' => 'pending',
            'source' => 'app',
            'reservation_number' => 'RES-' . uniqid(),
        ]);

        $this->actingAs($this->admin)
            ->putJson("/api/v1/reservations/{$reservation->id}", [
                'party_size' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Party size exceeds the capacity of the selected table.');
    }
}
