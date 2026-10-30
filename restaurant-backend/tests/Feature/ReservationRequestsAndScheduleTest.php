<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FloorPlan;
use App\Models\Reservation;
use App\Models\RestaurantSetting;
use App\Models\Role;
use App\Models\StaffNotification;
use App\Models\Table;
use App\Models\User;
use App\Services\ReservationAvailabilityService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationRequestsAndScheduleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    private FloorPlan $floorPlan;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin', 'module' => 'system']);
        Role::firstOrCreate(['name' => 'manager'], ['display_name' => 'Manager', 'module' => 'system']);

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->roles()->attach(Role::where('name', 'admin')->first());
        $this->manager = User::factory()->create(['is_active' => true]);
        $this->manager->roles()->attach(Role::where('name', 'manager')->first());

        RestaurantSetting::create([
            'name' => 'Test Restaurant',
            'currency' => 'PHP',
            'currency_symbol' => 'P',
            'default_tax_rate' => 12,
            'vat_enabled' => true,
            'vat_inclusive' => true,
            'reservation_weekend_days' => [],
            'reservation_regular_duration_minutes' => 60,
            'reservation_large_duration_minutes' => 90,
            'reservation_turnover_buffer_minutes' => 15,
        ]);

        $this->floorPlan = FloorPlan::create(['name' => 'Main', 'is_active' => true]);
    }

    private function makeTable(string $number, int $capacity, array $overrides = []): Table
    {
        return Table::create(array_merge([
            'floor_plan_id' => $this->floorPlan->id,
            'number' => $number,
            'capacity' => $capacity,
            'status' => 'available',
            'shape' => 'rectangle',
            'pos_x' => 0,
            'pos_y' => 0,
            'width' => 80,
            'height' => 80,
            'is_active' => true,
        ], $overrides));
    }

    public function test_auto_assignment_prefers_matching_location_and_tracks_requests(): void
    {
        $center = $this->makeTable('T1', 4, ['location' => 'Center']);
        $window = $this->makeTable('T2', 4, ['location' => 'Window']);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Window Guest',
            'guest_phone' => '09170000001',
            'party_size' => 2,
            'reservation_date' => now()->addWeekday()->toDateString(),
            'reservation_time' => '18:00',
            'requests' => [
                [
                    'category' => 'seating',
                    'label' => 'Window seat',
                    'value' => 'window',
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.table.id', $window->id)
            ->assertJsonPath('data.requests.0.label', 'Window seat')
            ->assertJsonPath('data.requests.0.is_matched', true);

        $this->assertNotSame($center->id, $response->json('data.table.id'));
        $this->assertDatabaseHas('reservation_requests', [
            'reservation_id' => $response->json('data.id'),
            'category' => 'seating',
            'is_matched' => true,
        ]);
    }

    public function test_best_effort_assignment_flags_unmet_preference(): void
    {
        $this->makeTable('T3', 4, ['location' => 'Center']);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Patio Guest',
            'guest_phone' => '09170000002',
            'party_size' => 2,
            'reservation_date' => now()->addWeekday()->toDateString(),
            'reservation_time' => '18:00',
            'requests' => [
                [
                    'category' => 'seating',
                    'label' => 'Patio seat',
                    'value' => 'outdoor',
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.requests.0.is_matched', false);
        $this->assertSame(1, $response->json('data.assignment.unmet_requests') === []
            ? 0
            : count($response->json('data.assignment.unmet_requests')));
    }

    public function test_turnover_buffer_blocks_until_cleaned(): void
    {
        $table = $this->makeTable('T4', 4);
        $start = Carbon::parse('2026-11-02 18:00');

        Reservation::create([
            'reservation_number' => 'RES-BUFFER',
            'guest_name' => 'Buffer Guest',
            'guest_phone' => '09170000003',
            'party_size' => 2,
            'reservation_date' => $start->toDateString(),
            'reservation_time' => '18:00',
            'duration_minutes' => 60,
            'end_time' => '19:00',
            'status' => 'confirmed',
            'table_id' => $table->id,
        ]);

        $service = app(ReservationAvailabilityService::class);

        $this->assertTrue($service->tableHasConflict($table->id, $start->copy()->addMinutes(70), 30));
        $this->assertFalse($service->tableHasConflict($table->id, $start->copy()->addMinutes(75), 30));
    }

    public function test_schedule_endpoint_returns_reservations_and_slots(): void
    {
        $table = $this->makeTable('T5', 4);
        $date = now()->addWeekday()->toDateString();

        $reservation = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Schedule Guest',
            'guest_phone' => '09170000004',
            'party_size' => 2,
            'reservation_date' => $date,
            'reservation_time' => '18:00',
            'table_id' => $table->id,
        ])->assertCreated()->json('data');

        $response = $this->actingAs($this->admin)
            ->getJson("/api/v1/tables/{$table->id}/schedule?date={$date}&days=1");

        $response->assertOk()
            ->assertJsonPath('data.reservations.0.id', $reservation['id'])
            ->assertJsonPath('data.buffer_minutes', 15);

        $this->assertNotEmpty($response->json('data.slots'));
    }

    public function test_request_status_api_and_staff_notifications(): void
    {
        $table = $this->makeTable('T6', 4);

        $reservationId = $this->actingAs($this->admin)->postJson('/api/v1/reservations', [
            'guest_name' => 'Request Guest',
            'guest_phone' => '09170000005',
            'party_size' => 2,
            'reservation_date' => now()->addWeekday()->toDateString(),
            'reservation_time' => '18:00',
            'table_id' => $table->id,
        ])->assertCreated()->json('data.id');

        $requestId = $this->actingAs($this->admin)->postJson(
            "/api/v1/reservations/{$reservationId}/requests",
            [
                'category' => 'dietary',
                'label' => 'Nut allergy',
                'priority' => 'high',
            ]
        )->assertCreated()->json('data.id');

        $this->actingAs($this->manager)->patchJson(
            "/api/v1/reservations/{$reservationId}/requests/{$requestId}",
            ['status' => 'acknowledged']
        )->assertOk()->assertJsonPath('data.status', 'acknowledged');

        $this->assertGreaterThanOrEqual(
            2,
            StaffNotification::where('user_id', $this->manager->id)->count()
        );

        $this->actingAs($this->manager)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unread_count', StaffNotification::where('user_id', $this->manager->id)->whereNull('read_at')->count());
    }

    public function test_schedule_exposes_current_and_upcoming_customer_context(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-02 18:30'));

        $table = $this->makeTable('T7', 4);

        $customer = Customer::create([
            'name' => 'Registered Guest',
            'email' => 'guest@example.com',
            'phone' => '09171234567',
            'customer_type' => 'registered',
            'loyalty_points' => 0,
            'total_spent' => 0,
            'visit_count' => 0,
            'is_active' => true,
        ]);

        $current = Reservation::create([
            'customer_id' => $customer->id,
            'table_id' => $table->id,
            'reservation_number' => 'RES-CURRENT',
            'guest_name' => 'Registered Guest',
            'guest_phone' => '09171234567',
            'party_size' => 2,
            'reservation_date' => '2026-11-02',
            'reservation_time' => '18:00',
            'duration_minutes' => 60,
            'status' => 'seated',
        ]);

        $upcoming = Reservation::create([
            'table_id' => $table->id,
            'reservation_number' => 'RES-UPCOMING',
            'guest_name' => 'Walk-In Guest',
            'guest_phone' => '09170000009',
            'party_size' => 4,
            'reservation_date' => '2026-11-02',
            'reservation_time' => '20:00',
            'duration_minutes' => 60,
            'status' => 'confirmed',
        ]);

        Reservation::create([
            'table_id' => $table->id,
            'reservation_number' => 'RES-COMPLETED',
            'guest_name' => 'Completed Guest',
            'guest_phone' => '09170000010',
            'party_size' => 2,
            'reservation_date' => '2026-11-02',
            'reservation_time' => '16:00',
            'duration_minutes' => 60,
            'status' => 'completed',
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/v1/tables/{$table->id}/schedule?date=2026-11-02&days=1");

        $response->assertOk()
            ->assertJsonPath('data.current_session.id', $current->id)
            ->assertJsonPath('data.current_session.customer.customer_type', 'registered')
            ->assertJsonPath('data.current_session.guest_phone', '09171234567')
            ->assertJsonPath('data.next_reservation.id', $upcoming->id)
            ->assertJsonPath('data.upcoming_reservations.0.id', $upcoming->id);

        $upcomingIds = collect($response->json('data.upcoming_reservations'))->pluck('id');
        $this->assertFalse($upcomingIds->contains('RES-COMPLETED'));

        Carbon::setTestNow();
    }
}
