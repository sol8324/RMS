<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Table;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Table;
use App\Services\ReservationAvailabilityService;
use App\Services\ReservationRequestService;
use App\Services\TableDiningPolicy;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableController extends Controller
{
    public function __construct(private readonly ReservationAvailabilityService $availability)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Table::with('floorPlan');

        if ($floorPlanId = $request->input('floor_plan_id')) {
            $request->validate([
                'floor_plan_id' => 'uuid',
            ]);
            $query->where('floor_plan_id', $floorPlanId);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($search = $request->input('search')) {
            $query->whereRaw('LOWER(number) LIKE ?', ["%".strtolower($search)."%"]);
        }

        $tables = Table::sortByNumber($query->get());
        $tableIds = $tables->pluck('id')->all();

        $reservations = Reservation::with(['requests', 'customer'])
            ->whereIn('table_id', $tableIds)
            ->whereIn('status', ReservationAvailabilityService::BLOCKING_STATUSES)
            ->whereDate('reservation_date', '>=', now()->toDateString())
            ->whereDate('reservation_date', '<=', now()->copy()->addDays(7)->toDateString())
            ->orderBy('reservation_date')
            ->orderBy('reservation_time')
            ->get();

        $reservationsByTable = $reservations->groupBy('table_id');

        $data = $tables->map(fn (Table $t) => [
            'id' => $t->id,
            'number' => $t->number,
            'capacity' => $t->capacity,
            'status' => $t->status,
            'shape' => $t->shape,
            'pos_x' => (float) $t->pos_x,
            'pos_y' => (float) $t->pos_y,
            'width' => (float) $t->width,
            'height' => (float) $t->height,
            'is_active' => $t->is_active,
            'is_wheelchair_accessible' => (bool) $t->is_wheelchair_accessible,
            'location' => $t->location,
            'location_description' => $t->location_description,
            'floor_plan' => $t->floorPlan ? [
                'id' => $t->floorPlan->id,
                'name' => $t->floorPlan->name,
            ] : null,
            'next_reservation' => $this->nextReservationPayload(
                $reservationsByTable->get($t->id, collect())
            ),
            'reservations_today' => $reservationsByTable->get($t->id, collect())
                ->filter(fn (Reservation $r) => $r->reservation_date?->toDateString() === now()->toDateString())
                ->count(),
            'created_at' => $t->created_at?->toISOString(),
            'updated_at' => $t->updated_at?->toISOString(),
        ]);

        return $this->success(['items' => $data]);
    }

    private function nextReservationPayload(iterable $reservations): ?array
    {
        $now = now();

        foreach ($reservations as $reservation) {
            if (! in_array($reservation->status, TableDiningPolicy::BLOCKING_RESERVATION_STATUSES, true)) {
                continue;
            }

            if (! $reservation->reservation_date || ! $reservation->reservation_time) {
                continue;
            }
            $start = Carbon::parse(
                $reservation->reservation_date->toDateString().' '.$reservation->reservation_time
            );
            $end = $start->copy()->addMinutes((int) ($reservation->duration_minutes ?? 180));

            if ($end->lt($now)) {
                continue;
            }

            return $this->reservationContextPayload($reservation);
        }

        return null;
    }

    private function reservationContextPayload(Reservation $reservation): array
    {
        $reservation->loadMissing(['customer', 'requests']);
        $customer = $reservation->customer;

        return [
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'guest_name' => $reservation->guest_name ?: $customer?->name,
            'guest_phone' => $reservation->guest_phone ?: $customer?->phone,
            'guest_email' => $reservation->guest_email ?: $customer?->email,
            'party_size' => $reservation->party_size,
            'reservation_date' => $reservation->reservation_date?->toDateString(),
            'reservation_time' => $reservation->reservation_time,
            'end_time' => $reservation->end_time,
            'duration_minutes' => $reservation->duration_minutes,
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'event_type' => $reservation->event_type,
            'booking_scope' => $reservation->booking_scope,
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'customer_type' => $customer->customer_type,
                'notes' => $customer->notes,
                'dietary_restrictions' => $customer->dietary_restrictions,
            ] : null,
            'requests' => ReservationRequestService::serializeCollection($reservation->requests),
            'requests_count' => $reservation->requests->count(),
            'unmet_requests_count' => $reservation->requests->where('is_matched', false)->count(),
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Floor-plan geometry is optional on create Ã¢â‚¬â€ the simple Add Table
            // flow sends number/capacity/shape only; defaults below keep the
            // row valid for the floor-plan editor.
            'floor_plan_id' => ['nullable', 'uuid', 'exists:floor_plans,id'],
            'number' => 'required|string|max:50',
            'capacity' => 'required|integer|min:1',
            'status' => 'sometimes|string|in:available,occupied,reserved,maintenance,needs_cleaning',
            'shape' => 'sometimes|string|in:rectangle,circle,square',
            'pos_x' => 'sometimes|numeric|min:0',
            'pos_y' => 'sometimes|numeric|min:0',
            'width' => 'sometimes|numeric|min:1',
            'height' => 'sometimes|numeric|min:1',
            'is_active' => 'sometimes|boolean',
            'is_wheelchair_accessible' => 'sometimes|boolean',
            'location' => 'sometimes|nullable|string|max:100',
            'location_description' => 'sometimes|nullable|string|max:500',
        ]);

        $floorPlanId = $validated['floor_plan_id']
            ?? \App\Models\FloorPlan::query()->orderBy('created_at')->value('id');

        if (!$floorPlanId) {
            return $this->error('No floor plan exists yet. Create a floor plan before adding tables.', 422);
        }

        $normalizedNumber = trim($validated['number']);
        $exists = Table::where('floor_plan_id', $floorPlanId)
            ->whereRaw('LOWER(number) = ?', [strtolower($normalizedNumber)])
            ->exists();

        if ($exists) {
            return $this->error("Table \"{$normalizedNumber}\" already exists. Please use a different table number.", 409);
        }

        $validated['number'] = $normalizedNumber;

        $table = Table::create(array_merge($validated, [
            'floor_plan_id' => $floorPlanId,
            'status' => $validated['status'] ?? 'available',
            'pos_x' => $validated['pos_x'] ?? 0,
            'pos_y' => $validated['pos_y'] ?? 0,
            'width' => $validated['width'] ?? 80,
            'height' => $validated['height'] ?? 80,
        ]));

        \App\Services\AuditLogger::record('table_created', $table, [
            'description' => "Table {$table->number} created (capacity {$table->capacity})",
        ]);

        return $this->created([
            'id' => $table->id,
            'number' => $table->number,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'shape' => $table->shape,
            'pos_x' => (float) $table->pos_x,
            'pos_y' => (float) $table->pos_y,
            'width' => (float) $table->width,
            'height' => (float) $table->height,
            'is_active' => $table->is_active,
            'is_wheelchair_accessible' => (bool) $table->is_wheelchair_accessible,
            'floor_plan_id' => $table->floor_plan_id,
            'created_at' => $table->created_at?->toISOString(),
            'updated_at' => $table->updated_at?->toISOString(),
        ], 'Table created successfully.');
    }

    public function show(string $id): JsonResponse
    {
        $table = Table::with('floorPlan')->find($id);

        if (!$table) {
            return $this->notFound('Table not found.');
        }

        return $this->success([
            'id' => $table->id,
            'number' => $table->number,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'shape' => $table->shape,
            'pos_x' => (float) $table->pos_x,
            'pos_y' => (float) $table->pos_y,
            'width' => (float) $table->width,
            'height' => (float) $table->height,
            'is_active' => $table->is_active,
            'is_wheelchair_accessible' => (bool) $table->is_wheelchair_accessible,
            'location' => $table->location,
            'location_description' => $table->location_description,
            'floor_plan' => $table->floorPlan ? [
                'id' => $table->floorPlan->id,
                'name' => $table->floorPlan->name,
            ] : null,
            'created_at' => $table->created_at?->toISOString(),
            'updated_at' => $table->updated_at?->toISOString(),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $table = Table::find($id);

        if (!$table) {
            return $this->notFound('Table not found.');
        }

        $validated = $request->validate([
            'floor_plan_id' => ['sometimes','uuid','exists:floor_plans,id'],
            'number' => 'sometimes|string|max:50',
            'capacity' => 'sometimes|integer|min:1',
            'status' => 'sometimes|string|in:available,occupied,reserved,maintenance,needs_cleaning',
            'shape' => 'sometimes|string|in:rectangle,circle,square',
            'pos_x' => 'sometimes|numeric|min:0',
            'pos_y' => 'sometimes|numeric|min:0',
            'width' => 'sometimes|numeric|min:1',
            'height' => 'sometimes|numeric|min:1',
            'is_active' => 'sometimes|boolean',
            'is_wheelchair_accessible' => 'sometimes|boolean',
            'location' => 'sometimes|nullable|string|max:100',
            'location_description' => 'sometimes|nullable|string|max:500',
        ]);

        if (isset($validated['number'])) {
            $validated['number'] = trim($validated['number']);
            $floorPlanId = $validated['floor_plan_id'] ?? $table->floor_plan_id;
            $exists = Table::where('floor_plan_id', $floorPlanId)
                ->whereRaw('LOWER(number) = ?', [strtolower($validated['number'])])
                ->where('id', '!=', $id)
                ->exists();
            if ($exists) {
                return $this->error('Table number already exists in this floor plan.', 409);
            }
        }

        $previousStatus = $table->status;

        $table->update($validated);

        if (array_key_exists('status', $validated) && $validated['status'] !== $previousStatus) {
            \App\Services\AuditLogger::record('table_status_changed', $table, [
                'description' => "Table {$table->number} status changed from "
                    .\App\Services\AuditLogger::label($previousStatus).' to '
                    .\App\Services\AuditLogger::label($table->status),
                'from' => $previousStatus,
                'to' => $table->status,
            ], null, ['status' => $previousStatus]);
        } else {
            \App\Services\AuditLogger::record('table_updated', $table, [
                'description' => "Table {$table->number} updated",
            ]);
        }

        return $this->success([
            'id' => $table->id,
            'number' => $table->number,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'shape' => $table->shape,
            'pos_x' => (float) $table->pos_x,
            'pos_y' => (float) $table->pos_y,
            'width' => (float) $table->width,
            'height' => (float) $table->height,
            'is_active' => $table->is_active,
            'is_wheelchair_accessible' => (bool) $table->is_wheelchair_accessible,
            'floor_plan_id' => $table->floor_plan_id,
            'created_at' => $table->created_at?->toISOString(),
            'updated_at' => $table->updated_at?->toISOString(),
        ], 'Table updated successfully.');
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $table = Table::find($id);

        if (!$table) {
            return $this->notFound('Table not found.');
        }

        $validated = $request->validate([
            'status' => 'required|string|in:available,occupied,reserved,maintenance,needs_cleaning',
        ]);

        $previousStatus = $table->status;

        $previousStatus = $table->status;
        $table->update(['status' => $validated['status']]);

        if ($validated['status'] !== $previousStatus) {
            \App\Services\AuditLogger::record('table_status_changed', $table, [
                'description' => "Table {$table->number} status changed from "
                    .\App\Services\AuditLogger::label($previousStatus).' to '
                    .\App\Services\AuditLogger::label($table->status),
                'from' => $previousStatus,
                'to' => $table->status,
            ], null, ['status' => $previousStatus]);
        }

        return $this->success([
            'id' => $table->id,
            'number' => $table->number,
            'status' => $table->status,
        ], 'Table status updated successfully.');
    }

    /**
     * Archive a table (is_active = false). Historical orders and
     * reservations keep their reference Ã¢â‚¬â€ tables are never hard-deleted.
     *
     * A table with an active (non-finished) order or a pending/confirmed
     * reservation cannot be archived; a meaningful 409 explains why.
     */
    public function archive(Request $request, string $id): JsonResponse
    {
        $table = Table::find($id);

        if (!$table) {
            return $this->notFound('Table not found.');
        }

        $activeOrderStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'on_hold'];
        $hasActiveOrder = \App\Models\Order::where('table_id', $table->id)
            ->whereIn('status', $activeOrderStatuses)
            ->whereNull('archived_at')
            ->exists();

        if ($hasActiveOrder) {
            return $this->error(
                "Table {$table->number} cannot be archived while it has an active order.",
                409
            );
        }

        $hasOpenReservation = \App\Models\Reservation::where('table_id', $table->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->exists();

        if ($hasOpenReservation) {
            return $this->error(
                "Table {$table->number} cannot be archived while it has pending or confirmed reservations.",
                409
            );
        }

        // Idempotent.
        if ((bool) $table->is_active) {
            $table->update(['is_active' => false]);
        }

        \App\Services\AuditLogger::record('table_archived', $table, [
            'description' => "Table {$table->number} archived",
        ]);

        return $this->success([
            'id' => $table->id,
            'number' => $table->number,
            'is_active' => false,
        ], 'Table archived successfully.');
    }

    /** Restore an archived table. */
    public function unarchive(Request $request, string $id): JsonResponse
    {
        $table = Table::find($id);

        if (!$table) {
            return $this->notFound('Table not found.');
        }

        $table->update(['is_active' => true]);

        \App\Services\AuditLogger::record('table_restored', $table, [
            'description' => "Table {$table->number} restored",
        ]);

        return $this->success([
            'id' => $table->id,
            'number' => $table->number,
            'is_active' => true,
        ], 'Table restored successfully.');
    }

    public function merge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_ids' => 'required|array|min:2',
            'table_ids.*' => ['required','uuid','exists:tables,id'],
        ]);

        $tables = Table::whereIn('id', $validated['table_ids'])->get();

        if ($tables->count() !== count($validated['table_ids'])) {
            return $this->notFound('One or more tables not found.');
        }

        $occupied = $tables->where('status', '!=', 'available');
        if ($occupied->isNotEmpty()) {
            return $this->error('All tables must be available to merge.', 409);
        }

        $totalCapacity = $tables->sum('capacity');
        $primaryTable = $tables->first();

        $primaryTable->update([
            'capacity' => $totalCapacity,
            'status' => 'occupied',
        ]);

        $tables->slice(1)->each(fn ($t) => $t->update([
            'status' => 'maintenance',
            'is_active' => false,
        ]));

        return $this->success([
            'merged_table' => [
                'id' => $primaryTable->id,
                'number' => $primaryTable->number,
                'capacity' => $primaryTable->capacity,
                'status' => $primaryTable->status,
            ],
            'merged_tables' => $tables->slice(1)->pluck('id'),
        ], 'Tables merged successfully.');
    }

    public function split(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_id' => ['required','uuid','exists:tables,id'],
        ]);

        $table = Table::find($validated['table_id']);

        if ($table->status !== 'occupied') {
            return $this->error('Table is not occupied.', 409);
        }

        $mergedTables = Table::where('is_active', false)
            ->where('status', 'maintenance')
            ->where('floor_plan_id', $table->floor_plan_id)
            ->get();

        if ($mergedTables->isEmpty()) {
            $table->update(['status' => 'available']);
            return $this->success([
                'table' => [
                    'id' => $table->id,
                    'number' => $table->number,
                    'status' => 'available',
                ],
                'restored_tables' => [],
            ], 'Table released (no merged tables to restore).');
        }

        $mergedTables->each(fn ($t) => $t->update([
            'capacity' => (int) ceil($table->capacity / ($mergedTables->count() + 1)),
            'status' => 'available',
            'is_active' => true,
        ]));

        $table->update([
            'capacity' => (int) ceil($table->capacity / ($mergedTables->count() + 1)),
            'status' => 'available',
        ]);

        return $this->success([
            'table' => [
                'id' => $table->id,
                'number' => $table->number,
                'status' => 'available',
            ],
            'restored_tables' => $mergedTables->pluck('id'),
        ], 'Tables split successfully.');
    }

    public function transfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_table_id' => ['required','uuid','exists:tables,id'],
            'to_table_id' => ['required','uuid','exists:tables,id','different:from_table_id'],
        ]);

        $fromTable = Table::find($validated['from_table_id']);
        $toTable = Table::find($validated['to_table_id']);

        if ($fromTable->status !== 'occupied') {
            return $this->error('Source table is not occupied.', 409);
        }

        if ($toTable->status !== 'available') {
            return $this->error('Destination table is not available.', 409);
        }

        $toTable->update(['status' => 'occupied']);
        $fromTable->update(['status' => 'available']);

        return $this->success([
            'from_table' => [
                'id' => $fromTable->id,
                'number' => $fromTable->number,
                'status' => 'available',
            ],
            'to_table' => [
                'id' => $toTable->id,
                'number' => $toTable->number,
                'status' => 'occupied',
            ],
        ], 'Table transferred successfully.');
    }

    /**
     * Tables eligible for a brand-new dine-in order (GET /tables/order-eligible).
     *
     * Contract (order creation surfaces):
     *   returns: { items: Table[] } with optional seating info.
     *
     * Eligible = active AND (
     *   available
     *   OR occupied by an active seated reservation with no other active
     *   dine-in order (one cover Ã¢â€ â€™ one active order)
     * ).
     * needs_cleaning / maintenance / reserved / inactive tables are never
     * listed. Same rule as OrderController::store Ã¢â‚¬â€ the backend remains
     * authoritative (409/422) if the client forces anything else.
     */
    public function orderEligible(Request $request): JsonResponse
    {
        $tables = Table::sortByNumber(
            Table::query()
                ->where('is_active', true)
                ->whereIn('status', ['available', 'occupied'])
                ->get()
        );

        $items = [];
        foreach ($tables as $table) {
            if ($table->status === 'available') {
                $items[] = $this->eligibleTablePayload($table, null);
                continue;
            }

            $seated = \App\Services\TableDiningPolicy::activeSeatedReservation($table->id);
            if ($seated === null
                || \App\Services\TableDiningPolicy::hasActiveOrder($table->id)
            ) {
                continue;
            }

            $items[] = $this->eligibleTablePayload($table, $seated);
        }

        return $this->success(['items' => $items]);
    }

    private function eligibleTablePayload(Table $table, ?\App\Models\Reservation $seated): array
    {
        return [
            'id' => $table->id,
            'number' => $table->number,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'is_active' => $table->is_active,
            'seating' => $seated ? [
                'reservation_number' => $seated->reservation_number,
                'guest_name' => $seated->guest_name,
            ] : null,
        ];
    }

    /**
     * Tables available for a reservation slot (GET /tables/available).
     *
     * Contract (useReservations.availableTables):
     *   params: reservation_date (Y-m-d), reservation_time, party_size?, floor_plan_id?
     *   returns: { items: Table[] }
     *
     * A table is unavailable when:
     *  - it is inactive, or
     *  - its capacity is below the requested party size, or
     *  - it currently holds an "occupied" status and the slot is today, or
     *  - it has a pending/confirmed/seated reservation on that date whose
     *    time window overlaps the requested slot (default 90-minute window).
     * Cancelled / no-show / completed reservations never block availability.
     */
    public function available(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reservation_date' => 'required|date',
            'reservation_time' => 'required|date_format:H:i,H:i:s,g:i A',
            'party_size' => 'nullable|integer|min:1',
            'floor_plan_id' => 'nullable|uuid',
            'exclude_reservation_id' => 'nullable|uuid',
            'requests' => 'sometimes|array|max:20',
        ]);

        $date = Carbon::parse($validated['reservation_date'])->toDateString();
        $time = strlen($validated['reservation_time']) > 5
            ? substr($validated['reservation_time'], 0, 5)
            : $validated['reservation_time'];
        $partySize = (int) ($validated['party_size'] ?? 1);

        $tables = $this->availability->availableTables(
            $date,
            $time,
            $partySize,
            $validated['requests'] ?? [],
            $validated['exclude_reservation_id'] ?? null
        );

        if ($floorPlanId = $request->input('floor_plan_id')) {
            $tables = $tables->where('floor_plan_id', $floorPlanId);
        }

        $tables = Table::sortByNumber($tables, capacityFirst: true);

        $data = $tables->map(fn (Table $t) => [
            'id' => $t->id,
            'number' => $t->number,
            'capacity' => $t->capacity,
            'status' => $t->status,
            'shape' => $t->shape,
            'pos_x' => (float) $t->pos_x,
            'pos_y' => (float) $t->pos_y,
            'width' => (float) $t->width,
            'height' => (float) $t->height,
            'is_active' => $t->is_active,
            'is_wheelchair_accessible' => (bool) $t->is_wheelchair_accessible,
            'location' => $t->location,
            'location_description' => $t->location_description,
            'floor_plan' => $t->floorPlan ? [
                'id' => $t->floorPlan->id,
                'name' => $t->floorPlan->name,
            ] : null,
        ]);

        return $this->success(['items' => $data]);
    }

    public function schedule(Request $request, string $id): JsonResponse
    {
        $table = Table::with('floorPlan')->find($id);
        if (! $table) {
            return $this->notFound('Table not found.');
        }

        $validated = $request->validate([
            'date' => 'sometimes|date',
            'days' => 'sometimes|integer|min:1|max:7',
        ]);

        $startDate = Carbon::parse($validated['date'] ?? now()->toDateString())->startOfDay();
        $days = (int) ($validated['days'] ?? 1);
        $endDate = $startDate->copy()->addDays($days - 1);
        $policy = $this->availability->policy();
        $buffer = $this->availability->bufferMinutes($policy);

        $reservations = Reservation::with(['requests', 'customer'])
            ->where('table_id', $table->id)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->whereDate('reservation_date', '>=', $startDate->toDateString())
            ->whereDate('reservation_date', '<=', $endDate->toDateString())
            ->orderBy('reservation_date')
            ->orderBy('reservation_time')
            ->get();

        $currentSession = TableDiningPolicy::activeSeatedReservation($table->id);
        if ($currentSession) {
            $currentSession->loadMissing(['customer', 'requests']);
        }

        $upcomingReservations = Reservation::with(['requests', 'customer'])
            ->where('table_id', $table->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereDate('reservation_date', '>=', now()->toDateString())
            ->whereDate('reservation_date', '<=', now()->copy()->addDays(7)->toDateString())
            ->orderBy('reservation_date')
            ->orderBy('reservation_time')
            ->get()
            ->filter(function (Reservation $reservation) use ($currentSession, $buffer): bool {
                if (! $reservation->reservation_date || ! $reservation->reservation_time) {
                    return false;
                }

                $reservationStart = Carbon::parse(
                    $reservation->reservation_date->toDateString().' '.$reservation->reservation_time
                );

                if (! $reservationStart->addMinutes((int) ($reservation->duration_minutes ?? 180))->gte(now())) {
                    return false;
                }

                if ($currentSession && $currentSession->reservation_date && $currentSession->reservation_time) {
                    $currentEnd = Carbon::parse(
                        $currentSession->reservation_date->toDateString().' '.$currentSession->reservation_time
                    )->addMinutes((int) ($currentSession->duration_minutes ?? 180) + $buffer);

                    if ($currentEnd->gt(now()) && $reservationStart->lt($currentEnd)) {
                        return false;
                    }
                }

                return true;
            })
            ->take(5)
            ->values();

        $nextReservation = $upcomingReservations->first();

        $items = $reservations->map(fn (Reservation $reservation) => $this->reservationContextPayload($reservation));

        $slots = [];
        for ($day = $startDate->copy(); $day->lte($endDate); $day->addDay()) {
            for ($minutes = 11 * 60; $minutes < 23 * 60; $minutes += 30) {
                $time = sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
                $start = Carbon::parse($day->toDateString().' '.$time);
                $conflict = $this->availability->tableHasConflict(
                    $table->id,
                    $start,
                    30,
                    null,
                    $buffer
                );

                $slots[] = [
                    'date' => $day->toDateString(),
                    'time' => $time,
                    'display_time' => $start->format('g:i A'),
                    'is_available' => ! $conflict,
                ];
            }
        }

        return $this->success([
            'table' => [
                'id' => $table->id,
                'number' => $table->number,
                'capacity' => $table->capacity,
                'status' => $table->status,
                'location' => $table->location,
                'location_description' => $table->location_description,
                'is_wheelchair_accessible' => (bool) $table->is_wheelchair_accessible,
            ],
            'date' => $startDate->toDateString(),
            'days' => $days,
            'buffer_minutes' => $buffer,
            'current_session' => $currentSession
                ? $this->reservationContextPayload($currentSession)
                : null,
            'next_reservation' => $nextReservation
                ? $this->reservationContextPayload($nextReservation)
                : null,
            'upcoming_reservations' => $upcomingReservations
                ->map(fn (Reservation $reservation) => $this->reservationContextPayload($reservation))
                ->all(),
            'reservations' => $items,
            'slots' => $slots,
        ]);
    }
}
