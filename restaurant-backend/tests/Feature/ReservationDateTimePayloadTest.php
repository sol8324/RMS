<?php

namespace Tests\Feature;

use App\Models\FloorPlan;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationDateTimePayloadTest extends TestCase
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

    public function test_store_accepts_iso_datetime_date_without_500(): void
    {
        $plan = FloorPlan::create(['name' => 'T01 Floor', 'is_active' => true]);
        $table = Table::create([
            'floor_plan_id' => $plan->id,
            'number' => 'T01',
            'capacity' => 4,
            'status' => 'available',
            'shape' => 'rectangular',
            'pos_x' => 0.0,
            'pos_y' => 0.0,
            'width' => 1.0,
            'height' => 1.0,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Test Customer',
            'guest_phone' => '09170000001',
            'party_size' => 4,
            'reservation_date' => now()->addDay()->toDateString() . 'T19:00',
            'reservation_time' => '19:00',
            'table_id' => $table->id,
        ]);

        $response->assertCreated();
        $reservation = Reservation::find($response->json('data.id'));
        $this->assertNotNull($reservation);
        $this->assertSame(now()->addDay()->toDateString(), $reservation->reservation_date->toDateString());
        $this->assertSame('T01', $reservation->table->number);
    }

    public function test_calendar_exposes_booking_scope_and_guest_event_details(): void
    {
        $date = now()->addDay()->toDateString();
        $plan = FloorPlan::create(['name' => 'Event Floor', 'is_active' => true]);
        $table = Table::create([
            'floor_plan_id' => $plan->id,
            'number' => 'T02',
            'capacity' => 4,
            'status' => 'available',
            'shape' => 'rectangular',
            'pos_x' => 0.0,
            'pos_y' => 0.0,
            'width' => 1.0,
            'height' => 1.0,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Event Guest',
            'guest_phone' => '09170000002',
            'party_size' => 4,
            'reservation_date' => $date,
            'reservation_time' => '19:00',
            'table_id' => $table->id,
            'event_type' => 'Birthday',
            'booking_scope' => 'half_day',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.booking_scope', 'half_day')
            ->assertJsonPath('data.end_time', '22:00');

        $calendar = $this->actingAs($this->admin)->getJson(
            "/api/v1/reservations/calendar?start_date={$date}&end_date={$date}"
        );

        $calendar->assertOk()
            ->assertJsonPath('data.items.0.booking_scope', 'half_day')
            ->assertJsonPath('data.items.0.end_time', '22:00')
            ->assertJsonPath("data.table_occupancy.{$date}.0.reservations.0.guest_name", 'Event Guest')
            ->assertJsonPath("data.table_occupancy.{$date}.0.reservations.0.party_size", 4)
            ->assertJsonPath("data.table_occupancy.{$date}.0.reservations.0.event_type", 'Birthday')
            ->assertJsonPath("data.table_occupancy.{$date}.0.reservations.0.booking_scope", 'half_day');
    }
}
