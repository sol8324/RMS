<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Table;

use App\Http\Controllers\Controller;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableController extends Controller
{
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
            'floor_plan' => $t->floorPlan ? [
                'id' => $t->floorPlan->id,
                'name' => $t->floorPlan->name,
            ] : null,
            'created_at' => $t->created_at?->toISOString(),
            'updated_at' => $t->updated_at?->toISOString(),
        ]);

        return $this->success(['items' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Floor-plan geometry is optional on create — the simple Add Table
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
     * reservations keep their reference — tables are never hard-deleted.
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
     *   dine-in order (one cover → one active order)
     * ).
     * needs_cleaning / maintenance / reserved / inactive tables are never
     * listed. Same rule as OrderController::store — the backend remains
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
        ]);

        $date = $validated['reservation_date'];
        $time = strlen($validated['reservation_time']) > 5
            ? substr($validated['reservation_time'], 0, 5)
            : $validated['reservation_time'];
        $windowMinutes = (int) config('app.reservation_window_minutes', 90);

        // Tables blocked by overlapping reservations on this date.
        // Pending, confirmed AND seated reservations block; completed /
        // cancelled / no-show never do.
        $blockingStatuses = ['pending', 'confirmed', 'seated'];
        $blockedTableIds = [];

        $sameDay = \App\Models\Reservation::whereIn('status', $blockingStatuses)
            ->whereDate('reservation_date', $date)
            ->get(['table_id', 'reservation_date', 'reservation_time']);

        $slotStart = Carbon::parse("{$date} {$time}");
        $slotEnd = $slotStart->copy()->addMinutes($windowMinutes);

        foreach ($sameDay as $reservation) {
            if (! $reservation->table_id || ! $reservation->reservation_time) {
                continue;
            }

            $resStart = Carbon::parse($reservation->reservation_date->toDateString().' '.$reservation->reservation_time);
            $resEnd = $resStart->copy()->addMinutes($windowMinutes);

            if ($slotStart < $resEnd && $resStart < $slotEnd) {
                $blockedTableIds[] = $reservation->table_id;
            }
        }

        $query = Table::query()
            ->where('is_active', true)
            // Operationally unusable tables are never assignable,
            // regardless of time-slot availability.
            ->whereNotIn('status', ['needs_cleaning', 'maintenance'])
            ->whereNotIn('id', array_unique($blockedTableIds));

        if ($floorPlanId = $request->input('floor_plan_id')) {
            $query->where('floor_plan_id', $floorPlanId);
        }

        if ($partySize = (int) ($validated['party_size'] ?? 0)) {
            $query->where('capacity', '>=', $partySize);
        }

        // For walk-in / today slots, physically occupied tables are not free.
        if ($date === now()->toDateString()) {
            $now = now();
            if ($now->between($slotStart, $slotEnd)) {
                $query->whereNot('status', 'occupied');
            }
        }

        $tables = Table::sortByNumber($query->get(), capacityFirst: true);

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
            'floor_plan' => $t->floorPlan ? [
                'id' => $t->floorPlan->id,
                'name' => $t->floorPlan->name,
            ] : null,
        ]);

        return $this->success(['items' => $data]);
    }
}
