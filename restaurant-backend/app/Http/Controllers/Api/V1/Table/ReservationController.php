<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Table;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Customer;
use App\Models\Table;
use App\Services\AuditLogger;
use App\Services\ReservationAvailabilityService;
use App\Services\ReservationRequestService;
use App\Services\StaffNotificationService;
use App\Services\TableDiningPolicy;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationController extends Controller
{
    private const BLOCKING_STATUSES = ['pending', 'confirmed', 'seated'];

    public function __construct(
        private readonly ReservationAvailabilityService $availability,
        private readonly ReservationRequestService $requestService
    ) {
    }

    private function overlapsActiveReservation(
        string $tableId,
        string $date,
        string $time,
        int $durationMinutes = 90,
        ?string $excludeId = null
    ): bool {
        $date = Carbon::parse($date)->toDateString();

        return $this->availability->tableHasConflict(
            $tableId,
            Carbon::parse("{$date} {$time}"),
            $durationMinutes,
            $excludeId
        );
    }

    /**
     * Get reservation policy settings from restaurant settings.
     */
    private function getReservationPolicy(): array
    {
        return $this->availability->policy();
    }

    /**
     * Calculate duration based on party size.
     */
    private function calculateDuration(int $partySize, array $policy): int
    {
        return $this->availability->durationFor($partySize, $policy);
    }

    /**
     * Check if reservation requires card on file based on policy.
     */
    private function requiresCard(int $partySize, string $reservationDate, array $policy, ?int $guestFlagLevel = null): bool
    {
        // Check guest flag level first
        if ($guestFlagLevel !== null) {
            if ($guestFlagLevel >= 1) return true;
        }

        $dayOfWeek = Carbon::parse($reservationDate)->dayOfWeek; // 0=Sunday, 6=Saturday
        $isWeekend = in_array($dayOfWeek, $policy['weekend_days']);

        // Card required if: party size >= threshold OR weekend
        return $partySize >= $policy['card_threshold'] || $isWeekend;
    }

    /**
     * Check if reservation requires deposit based on policy.
     */
    private function requiresDeposit(int $partySize, array $policy, ?int $guestFlagLevel = null): bool
    {
        // Check guest flag level first
        if ($guestFlagLevel !== null && $guestFlagLevel >= 2) {
            return true;
        }

        // Deposit required for large parties (6+)
        return $partySize >= $policy['card_threshold'];
    }

    /**
     * Calculate deposit amount based on policy percentage.
     * This is a simplified calculation - in reality would be based on estimated bill.
     */
    private function calculateDepositAmount(int $partySize, array $policy): float
    {
        // Estimate: $30 per person average spend
        $estimatedBill = $partySize * 30;
        return round($estimatedBill * ($policy['deposit_percentage'] / 100), 2);
    }

    /**
     * Check table availability for the full duration of the reservation.
     */
    private function isTableAvailableForDuration(string $tableId, string $date, string $time, int $durationMinutes, ?string $excludeId = null): bool
    {
        return ! $this->overlapsActiveReservation($tableId, $date, $time, $durationMinutes, $excludeId);
    }

    /**
     * Find the best available table for a party size and time slot.
     */
    private function findBestAvailableTable(
        int $partySize,
        string $date,
        string $time,
        int $durationMinutes,
        array $requests = [],
        ?string $excludeId = null,
        bool $lock = false
    ): ?Table {
        $assignment = $this->availability->bestAssignment(
            $partySize,
            Carbon::parse($date)->toDateString(),
            $time,
            $requests,
            $excludeId,
            $lock
        );

        return $assignment['table'] ?? null;
    }

    /**
     * Get reservation policy for frontend.
     */
    public function policy(Request $request): JsonResponse
    {
        $policy = $this->getReservationPolicy();
        return $this->success($policy);
    }

    /**
     * Check availability for a specific date/time/party size.
     */
    public function checkAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|date_format:H:i',
            'party_size' => 'required|integer|min:1|max:50',
            'exclude_reservation_id' => 'sometimes|nullable|uuid',
            'requests' => 'sometimes|array|max:20',
            'requests.*.category' => 'required_with:requests|in:seating,accessibility,dietary,occasion,other',
            'requests.*.label' => 'required_with:requests|string|max:120',
            'requests.*.value' => 'nullable|string|max:120',
            'requests.*.details' => 'nullable|string|max:1000',
            'requests.*.priority' => 'sometimes|in:normal,high',
        ]);

        $policy = $this->getReservationPolicy();
        $date = Carbon::parse($validated['reservation_date'])->toDateString();
        $duration = $this->calculateDuration((int) $validated['party_size'], $policy);
        $assignment = $this->availability->bestAssignment(
            (int) $validated['party_size'],
            $date,
            $validated['reservation_time'],
            $validated['requests'] ?? [],
            $validated['exclude_reservation_id'] ?? null
        );
        $table = $assignment['table'] ?? null;

        $requiresCard = $this->requiresCard((int) $validated['party_size'], $date, $policy);
        $requiresDeposit = $this->requiresDeposit((int) $validated['party_size'], $policy);

        return $this->success([
            'available' => $table !== null,
            'table' => $table ? [
                'id' => $table->id,
                'number' => $table->number,
                'capacity' => $table->capacity,
                'shape' => $table->shape,
                'location' => $table->location,
                'location_description' => $table->location_description,
                'is_wheelchair_accessible' => (bool) $table->is_wheelchair_accessible,
            ] : null,
            'assignment' => $assignment ? [
                'matched_requests' => $assignment['matched_requests'],
                'unmet_requests' => $assignment['unmet_requests'],
                'score' => $assignment['score'],
                'buffer_minutes' => $assignment['buffer_minutes'],
            ] : null,
            'duration_minutes' => $duration,
            'end_time' => Carbon::parse("{$date} {$validated['reservation_time']}")->addMinutes($duration)->format('H:i'),
            'requires_card' => $requiresCard,
            'requires_deposit' => $requiresDeposit,
            'deposit_amount' => $requiresDeposit ? $this->calculateDepositAmount((int) $validated['party_size'], $policy) : 0,
            'policy' => [
                'card_threshold' => $policy['card_threshold'],
                'weekend_days' => $policy['weekend_days'],
                'turnover_buffer_minutes' => $policy['turnover_buffer'],
            ],
        ]);
    }

    /**
     * Get all occupied time slots for a specific date.
     * Returns time slots with table assignments for conflict visualization.
     */
    public function getOccupiedTimeSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reservation_date' => 'required|date|after_or_equal:today',
            'party_size' => 'sometimes|integer|min:1|max:50',
            'exclude_reservation_id' => 'sometimes|string',
        ]);

        $date = $validated['reservation_date'];
        $partySize = $validated['party_size'] ?? 1;
        $policy = $this->getReservationPolicy();
        $duration = $this->calculateDuration($partySize, $policy);
        $buffer = $this->availability->bufferMinutes($policy);

        // Get all active reservations for the date
        $reservations = Reservation::where('reservation_date', $date)
            ->whereIn('status', ['pending', 'confirmed', 'seated'])
            ->when($validated['exclude_reservation_id'], function ($q) use ($validated) {
                $q->where('id', '!=', $validated['exclude_reservation_id']);
            })
            ->with(['table'])
            ->get();

        // Build time slots (operating hours: 11:00-23:00 in 30-min increments)
        $timeSlots = [];
        $startHour = 11;
        $endHour = 23;
        $intervalMinutes = 30;

        for ($hour = $startHour; $hour < $endHour; $hour++) {
            for ($minute = 0; $minute < 60; $minute += $intervalMinutes) {
                $time = sprintf('%02d:%02d', $hour, $minute);
                $slotStart = Carbon::parse("{$date} {$time}");
                $slotEnd = $slotStart->copy()->addMinutes($duration);

                // Check each table for this time slot
                $tableOccupancy = [];
                $tables = Table::sortByNumber(
                    Table::where('is_active', true)
                        ->whereNotIn('status', ['needs_cleaning', 'maintenance'])
                        ->where('capacity', '>=', $partySize)
                        ->get()
                );

                foreach ($tables as $table) {
                    $isOccupied = false;
                    $occupyingReservation = null;

                    foreach ($reservations as $res) {
                        if ($res->table_id !== $table->id) continue;
                        $resStart = Carbon::parse($res->reservation_date->toDateString() . ' ' . $res->reservation_time);
                        $resEnd = $resStart->copy()
                            ->addMinutes($res->duration_minutes ?? $duration)
                            ->addMinutes($buffer);

                        if ($slotStart->lt($resEnd) && $resStart->lt($slotEnd)) {
                            $isOccupied = true;
                            $occupyingReservation = [
                                'id' => $res->id,
                                'guest_name' => $res->guest_name,
                                'party_size' => $res->party_size,
                                'reservation_time' => $res->reservation_time,
                                'duration_minutes' => $res->duration_minutes ?? $duration,
                                'status' => $res->status,
                            ];
                            break;
                        }
                    }

                    $tableOccupancy[] = [
                        'table_id' => $table->id,
                        'table_number' => $table->number,
                        'capacity' => $table->capacity,
                        'is_occupied' => $isOccupied,
                        'occupying_reservation' => $occupyingReservation,
                    ];
                }

                // Check if ANY table is available for this slot
                $hasAvailableTable = collect($tableOccupancy)->contains('is_occupied', false);

                $timeSlots[] = [
                    'time' => $time,
                    'display_time' => $slotStart->format('g:i A'),
                    'end_time' => $slotEnd->format('g:i A'),
                    'is_available' => $hasAvailableTable,
                    'table_occupancy' => $tableOccupancy,
                ];
            }
        }

        return $this->success([
            'date' => $date,
            'party_size' => $partySize,
            'duration_minutes' => $duration,
            'time_slots' => $timeSlots,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Reservation::with(['customer', 'table', 'requests']);

        // Archived reservations are hidden unless ?archived=1 (the frontend
        // "Archived" view scope sends this flag).
        if ($request->boolean('archived')) {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

        if ($date = $request->input('date')) {
            $query->whereDate('reservation_date', $date);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(guest_name) LIKE ?', ["%".strtolower($search)."%"])
                    ->orWhereRaw('LOWER(guest_phone) LIKE ?', ["%".strtolower($search)."%"])
                    ->orWhereRaw('LOWER(reservation_number) LIKE ?', ["%".strtolower($search)."%"]);
            });
        }

        $reservations = $query->orderBy('reservation_date', 'desc')
            ->orderBy('reservation_time', 'desc')
            ->paginate($request->integer('per_page', 15));

        $data = $reservations->getCollection()->map(fn (Reservation $r) => [
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'table_id' => $r->table_id,
            'reservation_number' => $r->reservation_number,
            'guest_name' => $r->guest_name,
            'guest_phone' => $r->guest_phone,
            'guest_email' => $r->guest_email,
            'party_size' => $r->party_size,
            'reservation_date' => $r->reservation_date?->toDateString(),
            'reservation_time' => $r->reservation_time,
            'end_time' => $r->end_time,
            'duration_minutes' => $r->duration_minutes,
            'status' => $r->status,
            'source' => $r->source,
            'special_requests' => $r->special_requests,
            'requests' => ReservationRequestService::serializeCollection($r->requests),
            'requests_count' => $r->requests->count(),
            'unmet_requests_count' => $r->requests->where('is_matched', false)->count(),
            'event_type' => $r->event_type,
            'booking_scope' => $r->booking_scope,
            'customer' => $r->customer ? [
                'id' => $r->customer->id,
                'name' => $r->customer->name,
            ] : null,
            'table' => $r->table ? [
                'id' => $r->table->id,
                'number' => $r->table->number,
            ] : null,
            'created_at' => $r->created_at?->toISOString(),
            'updated_at' => $r->updated_at?->toISOString(),
        ]);

        return $this->success([
            'items' => $data,
            'pagination' => [
                'current_page' => $reservations->currentPage(),
                'last_page' => $reservations->lastPage(),
                'per_page' => $reservations->perPage(),
                'total' => $reservations->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'table_id' => 'nullable|exists:tables,id',
            'guest_name' => 'nullable|required_without:customer_id|string|max:255',
            'guest_phone' => 'nullable|required_without:customer_id|string|max:50',
            'guest_email' => 'nullable|email|max:255',
            'party_size' => 'required|integer|min:1|max:50',
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|date_format:H:i',
            'source' => 'sometimes|string|in:phone,online,walk_in,app',
            'special_requests' => 'nullable|string|max:2000',
            'event_type' => 'nullable|string|in:Birthday,Anniversary,Corporate,Wedding,Holiday Party,Graduation,Baby Shower,Bridal Shower,Rehearsal Dinner,Other',
            'booking_scope' => 'sometimes|string|in:standard,half_day,whole_day',
            'card_on_file' => 'sometimes|boolean',
            'deposit_paid' => 'sometimes|boolean',
            'requests' => 'sometimes|array|max:20',
            'requests.*.category' => 'required_with:requests|in:seating,accessibility,dietary,occasion,other',
            'requests.*.label' => 'required_with:requests|string|max:120',
            'requests.*.value' => 'nullable|string|max:120',
            'requests.*.details' => 'nullable|string|max:1000',
            'requests.*.priority' => 'sometimes|in:normal,high',
        ]);

        $validated['booking_scope'] ??= 'standard';

        // Normalize to a pure date: clients may send an ISO datetime (date+T+time).
        $validated['reservation_date'] = Carbon::parse($validated['reservation_date'])->toDateString();

        // Get policy settings
        $policy = $this->getReservationPolicy();
        $partySize = (int) $validated['party_size'];

        // Determine duration based on party size
        $duration = $this->calculateDuration($partySize, $policy);
        $validated['duration_minutes'] = $duration;
        $validated['end_time'] = Carbon::parse("{$validated['reservation_date']} {$validated['reservation_time']}")->addMinutes($duration)->toDateTimeString();

        // Check if customer has flag level (if customer_id provided)
        $guestFlagLevel = 0;
        if (! empty($validated['customer_id'])) {
            $customer = Customer::where('is_active', true)->find($validated['customer_id']);
            if ($customer) {
                // Check customer's no-show counter for flag level
                $guestFlagLevel = $customer->no_show_counter >= $policy['flag_threshold'] ? 2 :
                    ($customer->no_show_counter >= 1 ? 1 : 0);
                $validated['guest_name'] = $customer->name;
                $validated['guest_phone'] = $customer->phone;
                $validated['guest_email'] = $customer->email;
            }
        }

        // Determine card/deposit requirements
        $requiresCard = $this->requiresCard($partySize, $validated['reservation_date'], $policy, $guestFlagLevel);
        $requiresDeposit = $this->requiresDeposit($partySize, $policy, $guestFlagLevel);

        $validated['card_required'] = $requiresCard;
        $validated['deposit_required'] = $requiresDeposit;
        $validated['card_on_file'] = $validated['card_on_file'] ?? false;
        $validated['deposit_paid'] = $validated['deposit_paid'] ?? false;

        if ($requiresDeposit) {
            $validated['deposit_amount'] = $this->calculateDepositAmount($partySize, $policy);
        }

        // Set reserved_party_size
        $validated['reserved_party_size'] = $partySize;

        $requests = $validated['requests'] ?? [];
        unset($validated['requests']);
        $assignment = null;

        // If card required but not on file, return info for frontend to handle
        if ($requiresCard && ! $validated['card_on_file']) {
            return $this->error('Card on file required for this reservation. Please provide payment details.', 422, [
                'requires_card' => true,
                'requires_deposit' => $requiresDeposit,
                'deposit_amount' => $validated['deposit_amount'] ?? 0,
                'policy' => [
                    'card_threshold' => $policy['card_threshold'],
                    'weekend_days' => $policy['weekend_days'],
                    'reason' => $partySize >= $policy['card_threshold'] ? 'Large party (6+ people)' : 'Weekend reservation (Friday/Saturday)',
                ],
            ]);
        }

        // If deposit required but not paid, return info
        if ($requiresDeposit && ! $validated['deposit_paid']) {
            return $this->error('Deposit required for this reservation.', 422, [
                'requires_card' => $requiresCard,
                'requires_deposit' => true,
                'deposit_amount' => $validated['deposit_amount'] ?? 0,
                'policy' => [
                    'deposit_percentage' => $policy['deposit_percentage'],
                    'reason' => 'Large party (6+ people)',
                ],
            ]);
        }

        $validated['reservation_number'] = 'RES-' . strtoupper(uniqid());
        $validated['status'] = 'pending';

        $result = DB::transaction(function () use (&$validated, &$assignment, $partySize, $duration, $requests) {
            if (! empty($validated['table_id'])) {
                $table = Table::where('id', $validated['table_id'])->lockForUpdate()->first();
                if (! $table || ! $table->is_active || in_array($table->status, ['needs_cleaning', 'maintenance'], true)) {
                    return ['error' => ['message' => 'The selected table is not available.', 'code' => 422]];
                }
                if ($partySize > (int) $table->capacity) {
                    return ['error' => ['message' => 'Party size exceeds the capacity of the selected table.', 'code' => 422]];
                }
                if ($this->availability->tableHasConflict(
                    $table->id,
                    Carbon::parse("{$validated['reservation_date']} {$validated['reservation_time']}"),
                    $duration
                )) {
                    return ['error' => ['message' => 'This table is already reserved for the selected time.', 'code' => 409]];
                }

                [$matched, $unmet] = $this->availability->matchRequests($table, $requests);
                $assignment = [
                    'table' => $table,
                    'matched_requests' => $matched,
                    'unmet_requests' => $unmet,
                    'score' => null,
                    'buffer_minutes' => $this->availability->bufferMinutes(),
                ];
            } else {
                $assignment = $this->availability->bestAssignment(
                    $partySize,
                    $validated['reservation_date'],
                    $validated['reservation_time'],
                    $requests,
                    null,
                    true
                );
                if ($assignment) {
                    $validated['table_id'] = $assignment['table']->id;
                }
            }

            $reservation = Reservation::create($validated);
            $this->requestService->createMany($reservation, $requests, $reservation->table);

            return ['reservation' => $reservation];
        });

        if (isset($result['error'])) {
            return $this->error($result['error']['message'], $result['error']['code']);
        }

        /** @var Reservation $reservation */
        $reservation = $result['reservation'];
        $reservation->load(['customer', 'table', 'requests']);

        \App\Services\AuditLogger::record('reservation_created', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} created for {$reservation->guest_name} (party of {$reservation->party_size})",
        ]);
        StaffNotificationService::notifyReservation($reservation, [
            'type' => 'reservation',
            'icon' => 'calendar',
            'title' => 'New reservation',
            'description' => "{$reservation->guest_name} · party of {$reservation->party_size} · {$reservation->reservation_date?->format('M j')} {$reservation->reservation_time}",
            'action_label' => 'View reservation',
            'action_url' => "/reservations/{$reservation->id}",
        ]);

        return $this->created([
            'id' => $reservation->id,
            'customer_id' => $reservation->customer_id,
            'table_id' => $reservation->table_id,
            'reservation_number' => $reservation->reservation_number,
            'guest_name' => $reservation->guest_name,
            'guest_phone' => $reservation->guest_phone,
            'guest_email' => $reservation->guest_email,
            'party_size' => $reservation->party_size,
            'reserved_party_size' => $reservation->reserved_party_size,
            'reservation_date' => $reservation->reservation_date?->toDateString(),
            'reservation_time' => $reservation->reservation_time,
            'end_time' => $reservation->end_time,
            'duration_minutes' => $reservation->duration_minutes,
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'requests' => ReservationRequestService::serializeCollection($reservation->requests),
            'assignment' => $assignment ? [
                'matched_requests' => $assignment['matched_requests'],
                'unmet_requests' => $assignment['unmet_requests'],
                'score' => $assignment['score'],
                'buffer_minutes' => $assignment['buffer_minutes'],
            ] : null,
            'event_type' => $reservation->event_type,
            'booking_scope' => $reservation->booking_scope,
            'card_required' => $reservation->card_required,
            'deposit_required' => $reservation->deposit_required,
            'deposit_amount' => $reservation->deposit_amount,
            'deposit_paid' => $reservation->deposit_paid,
            'card_on_file' => $reservation->card_on_file,
            'customer' => $reservation->customer ? [
                'id' => $reservation->customer->id,
                'name' => $reservation->customer->name,
            ] : null,
            'table' => $reservation->table ? [
                'id' => $reservation->table->id,
                'number' => $reservation->table->number,
            ] : null,
            'created_at' => $reservation->created_at?->toISOString(),
            'updated_at' => $reservation->updated_at?->toISOString(),
        ], 'Reservation created successfully.');
    }

    /**
     * Archive a reservation (soft-hide; never deleted).
     *
     * Workflow safety: reservations still pending/confirmed cannot be
     * archived — confirm, complete, cancel or mark no-show first.
     */
    public function archive(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        if (in_array($reservation->status, ['pending', 'confirmed'], true)) {
            return $this->error(
                'Active reservations cannot be archived. Complete, cancel or mark this reservation as no-show first.',
                409
            );
        }

        // Idempotent.
        if ($reservation->archived_at === null) {
            $reservation->update(['archived_at' => now()]);
        }

        \App\Services\AuditLogger::record('reservation_archived', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} archived",
        ]);

        return $this->success([
            'id' => $reservation->id,
            'customer_id' => $reservation->customer_id,
            'table_id' => $reservation->table_id,
            'reservation_number' => $reservation->reservation_number,
            'status' => $reservation->status,
            'archived_at' => $reservation->archived_at?->toISOString(),
        ], 'Reservation archived successfully.');
    }

    /**
     * Whether another reservation blocks the same table in the 90-minute
     * half-open overlap window. Pending, confirmed AND seated reservations
     * block; completed / cancelled / no-show never do.
     */
    public function unarchive(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        $reservation->update(['archived_at' => null]);

        \App\Services\AuditLogger::record('reservation_restored', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} restored",
        ]);

        return $this->success([
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'status' => $reservation->status,
            'archived_at' => null,
        ], 'Reservation restored successfully.');
    }

    public function calendar(Request $request): JsonResponse
    {
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', now()->endOfMonth()->toDateString());

        $reservations = Reservation::with(['customer', 'table', 'requests'])
            ->whereDate('reservation_date', '>=', $startDate)
            ->whereDate('reservation_date', '<=', $endDate)
            ->whereNotIn('status', ['cancelled'])
            ->orderBy('reservation_date')
            ->orderBy('reservation_time')
            ->get();

        // Get table occupancy for each date in range
        $tableOccupancy = $this->getTableOccupancy($startDate, $endDate);

        $data = $reservations->map(fn (Reservation $r) => [
            'id' => $r->id,
            'reservation_number' => $r->reservation_number,
            'guest_name' => $r->guest_name,
            'party_size' => $r->party_size,
            'reservation_date' => $r->reservation_date?->toDateString(),
            'reservation_time' => $r->reservation_time,
            'end_time' => $r->end_time,
            'duration_minutes' => $r->duration_minutes,
            'status' => $r->status,
            'event_type' => $r->event_type,
            'booking_scope' => $r->booking_scope,
            'requests' => ReservationRequestService::serializeCollection($r->requests),
            'requests_count' => $r->requests->count(),
            'unmet_requests_count' => $r->requests->where('is_matched', false)->count(),
            'table' => $r->table ? [
                'id' => $r->table->id,
                'number' => $r->table->number,
            ] : null,
            'customer' => $r->customer ? [
                'id' => $r->customer->id,
                'name' => $r->customer->name,
            ] : null,
        ]);

        return $this->success([
            'items' => $data,
            'table_occupancy' => $tableOccupancy,
        ]);
    }

    /**
     * Get table occupancy for a date range.
     * Returns tables with their reservation status for each date.
     */
    private function getTableOccupancy(string $startDate, string $endDate): array
    {
        $tables = Table::sortByNumber(
            Table::where('is_active', true)
                ->whereNotIn('status', ['maintenance', 'needs_cleaning'])
                ->get(['id', 'number', 'capacity', 'status'])
        );

        $reservations = Reservation::with('customer')
            ->whereDate('reservation_date', '>=', $startDate)
            ->whereDate('reservation_date', '<=', $endDate)
            ->whereIn('status', ['pending', 'confirmed', 'seated'])
            ->get([
                'id', 'table_id', 'customer_id', 'guest_name', 'party_size',
                'reservation_date', 'reservation_time', 'duration_minutes',
                'status', 'event_type', 'booking_scope',
            ]);

        $occupancy = [];
        $start = \Carbon\Carbon::parse($startDate);
        $end = \Carbon\Carbon::parse($endDate);

        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $dateStr = $date->toDateString();
            $dayReservations = $reservations->filter(
                fn (Reservation $reservation) => $reservation->reservation_date?->toDateString() === $dateStr
            );

            $dayOccupancy = $tables->map(function ($table) use ($dayReservations, $dateStr) {
                $tableReservations = $dayReservations->where('table_id', $table->id);
                $hasReservation = $tableReservations->isNotEmpty();

                return [
                    'id' => $table->id,
                    'number' => $table->number,
                    'capacity' => $table->capacity,
                    'status' => $table->status,
                    'has_reservation' => $hasReservation,
                    'reservations' => $tableReservations->map(function ($r) {
                        return [
                            'id' => $r->id,
                            'guest_name' => $r->customer?->name ?? $r->guest_name,
                            'party_size' => $r->party_size,
                            'reservation_time' => $r->reservation_time,
                            'end_time' => $r->end_time,
                            'duration_minutes' => $r->duration_minutes,
                            'status' => $r->status,
                            'event_type' => $r->event_type,
                            'booking_scope' => $r->booking_scope,
                        ];
                    })->values()->all(),
                ];
            })->values()->all();

            $occupancy[$dateStr] = $dayOccupancy;
        }

        return $occupancy;
    }

    public function show(string $id): JsonResponse
    {
        $reservation = Reservation::with(['customer', 'table', 'requests'])->find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        return $this->success([
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'guest_name' => $reservation->guest_name,
            'guest_phone' => $reservation->guest_phone,
            'guest_email' => $reservation->guest_email,
            'party_size' => $reservation->party_size,
            'reservation_date' => $reservation->reservation_date?->toDateString(),
            'reservation_time' => $reservation->reservation_time,
            'end_time' => $reservation->end_time,
            'duration_minutes' => $reservation->duration_minutes,
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'requests' => ReservationRequestService::serializeCollection($reservation->requests),
            'event_type' => $reservation->event_type,
            'booking_scope' => $reservation->booking_scope,
            'cancellation_reason' => $reservation->cancellation_reason,
            'customer' => $reservation->customer ? [
                'id' => $reservation->customer->id,
                'name' => $reservation->customer->name,
                'phone' => $reservation->customer->phone,
                'email' => $reservation->customer->email,
                'customer_type' => $reservation->customer->customer_type,
                'notes' => $reservation->customer->notes,
                'dietary_restrictions' => $reservation->customer->dietary_restrictions,
            ] : null,
            'table' => $reservation->table ? [
                'id' => $reservation->table->id,
                'number' => $reservation->table->number,
                'capacity' => $reservation->table->capacity,
            ] : null,
            'created_at' => $reservation->created_at?->toISOString(),
            'updated_at' => $reservation->updated_at?->toISOString(),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        if (in_array($reservation->status, ['completed', 'cancelled', 'no_show'])) {
            return $this->error('Cannot modify a reservation with status: ' . $reservation->status, 409);
        }

        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'table_id' => 'nullable|exists:tables,id',
            'guest_name' => 'nullable|string|max:255',
            'guest_phone' => 'nullable|string|max:50',
            'guest_email' => 'nullable|email|max:255',
            'party_size' => 'sometimes|integer|min:1|max:50',
            'reservation_date' => 'sometimes|date|after_or_equal:today',
            'reservation_time' => 'sometimes|date_format:H:i',
            'source' => 'sometimes|string|in:phone,online,walk_in,app',
            'special_requests' => 'nullable|string|max:2000',
            'event_type' => 'nullable|string|in:Birthday,Anniversary,Corporate,Wedding,Holiday Party,Graduation,Baby Shower,Bridal Shower,Rehearsal Dinner,Other',
            'booking_scope' => 'sometimes|string|in:standard,half_day,whole_day',
            'requests' => 'sometimes|array|max:20',
            'requests.*.category' => 'required_with:requests|in:seating,accessibility,dietary,occasion,other',
            'requests.*.label' => 'required_with:requests|string|max:120',
            'requests.*.value' => 'nullable|string|max:120',
            'requests.*.details' => 'nullable|string|max:1000',
            'requests.*.priority' => 'sometimes|in:normal,high',
        ]);

        $requests = $validated['requests'] ?? null;
        unset($validated['requests']);

        if (isset($validated['reservation_date'])) {
            $validated['reservation_date'] = Carbon::parse($validated['reservation_date'])->toDateString();
        }

        $customerId = array_key_exists('customer_id', $validated)
            ? $validated['customer_id']
            : $reservation->customer_id;

        if ($customerId) {
            $customer = Customer::where('is_active', true)->find($customerId);
            if (! $customer) {
                return $this->error('Select an active registered customer.', 422);
            }
            $validated['guest_name'] = $customer->name;
            $validated['guest_phone'] = $customer->phone;
            $validated['guest_email'] = $customer->email;
        } else {
            $guestName = $validated['guest_name'] ?? $reservation->guest_name;
            $guestPhone = $validated['guest_phone'] ?? $reservation->guest_phone;
            if (! is_string($guestName) || trim($guestName) === '') {
                return $this->error('Guest name is required for a guest reservation.', 422);
            }
            if (! is_string($guestPhone) || trim($guestPhone) === '') {
                return $this->error('Guest phone is required for a guest reservation.', 422);
            }
        }

        $tableId = array_key_exists('table_id', $validated)
            ? $validated['table_id']
            : $reservation->table_id;
        $date = $validated['reservation_date'] ?? $reservation->reservation_date->toDateString();
        $time = $validated['reservation_time'] ?? $reservation->reservation_time;
        $partySize = (int) ($validated['party_size'] ?? $reservation->party_size);
        $policy = $this->getReservationPolicy();
        $duration = $this->calculateDuration($partySize, $policy);
        $validated['duration_minutes'] = $duration;
        $validated['end_time'] = Carbon::parse("{$date} {$time}")
            ->addMinutes($duration)
            ->toDateTimeString();

        $result = DB::transaction(function () use (&$validated, $reservation, $tableId, $date, $time, $duration, $partySize, $requests) {
            $table = null;

            if (! empty($tableId)) {
                $table = Table::where('id', $tableId)->lockForUpdate()->first();
                if (! $table || ! $table->is_active || in_array($table->status, ['needs_cleaning', 'maintenance'], true)) {
                    return ['error' => ['message' => 'The selected table is not available.', 'code' => 422]];
                }
                if ($partySize > (int) $table->capacity) {
                    return ['error' => ['message' => 'Party size exceeds the capacity of the selected table.', 'code' => 422]];
                }
                if ($this->availability->tableHasConflict(
                    $tableId,
                    Carbon::parse("{$date} {$time}"),
                    $duration,
                    $reservation->id
                )) {
                    return ['error' => ['message' => 'This table is already reserved for the selected time.', 'code' => 409]];
                }
            }

            $reservation->update($validated);

            if ($requests !== null) {
                $this->requestService->syncPending($reservation, $requests, $table ?? $reservation->table);
            } elseif ($table) {
                // Re-evaluate seating/accessibility matches if the table changed.
                foreach ($reservation->requests()->whereIn('category', ['seating', 'accessibility'])->get() as $request) {
                    [$matched] = $this->availability->matchRequests($table, [$request->toArray()]);
                    $request->update(['is_matched' => $matched !== []]);
                }
            }

            return ['reservation' => $reservation];
        });

        if (isset($result['error'])) {
            return $this->error($result['error']['message'], $result['error']['code']);
        }

        /** @var Reservation $reservation */
        $reservation = $result['reservation'];
        $reservation->load(['customer', 'table', 'requests']);

        \App\Services\AuditLogger::record('reservation_updated', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} updated",
        ]);

        return $this->success([
            'id' => $reservation->id,
            'customer_id' => $reservation->customer_id,
            'table_id' => $reservation->table_id,
            'reservation_number' => $reservation->reservation_number,
            'guest_name' => $reservation->guest_name,
            'guest_phone' => $reservation->guest_phone,
            'guest_email' => $reservation->guest_email,
            'party_size' => $reservation->party_size,
            'reservation_date' => $reservation->reservation_date?->toDateString(),
            'reservation_time' => $reservation->reservation_time,
            'end_time' => $reservation->end_time,
            'duration_minutes' => $reservation->duration_minutes,
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'requests' => ReservationRequestService::serializeCollection($reservation->requests),
            'event_type' => $reservation->event_type,
            'booking_scope' => $reservation->booking_scope,
            'customer' => $reservation->customer ? [
                'id' => $reservation->customer->id,
                'name' => $reservation->customer->name,
            ] : null,
            'table' => $reservation->table ? [
                'id' => $reservation->table->id,
                'number' => $reservation->table->number,
            ] : null,
            'created_at' => $reservation->created_at?->toISOString(),
            'updated_at' => $reservation->updated_at?->toISOString(),
        ], 'Reservation updated successfully.');
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        $validated = $request->validate([
            'status' => 'required|string|in:pending,confirmed,seated,completed,cancelled,no_show',
            'cancellation_reason' => 'nullable|string|max:1000',
        ]);

        if ($validated['status'] === 'cancelled' && empty($validated['cancellation_reason'])) {
            return $this->error('Cancellation reason is required.', 422);
        }

        $previousStatus = $reservation->status;

        $result = DB::transaction(function () use ($reservation, $validated, $previousStatus) {
            $target = $validated['status'];

            // Auto-assign inside the transaction so concurrent confirmations
            // cannot claim the same table.
            if (in_array($target, ['confirmed', 'seated'], true) && empty($reservation->table_id)) {
                $partySize = (int) ($reservation->party_size ?? ($reservation->reserved_party_size ?? 1));
                $date = $reservation->reservation_date ? $reservation->reservation_date->toDateString() : now()->toDateString();
                $time = $reservation->reservation_time ?? '18:00';
                $assignment = $this->availability->bestAssignment(
                    $partySize,
                    $date,
                    $time,
                    $reservation->requests()->get()->all(),
                    $reservation->id,
                    true
                );
                if ($assignment) {
                    $validated['table_id'] = $assignment['table']->id;
                }
            }

            // Seat pre-check: the effective table must be operational. This
            // runs before any write so a dirty table can never be seated onto.
            if ($target === 'seated') {
                $seatTableId = $validated['table_id'] ?? $reservation->table_id;
                if ($seatTableId) {
                    $seatTable = Table::lockForUpdate()->find($seatTableId);
                    if (! $seatTable || ! $seatTable->is_active
                        || in_array($seatTable->status, ['maintenance', 'needs_cleaning'], true)
                    ) {
                        return ['error' => ['message' => 'The assigned table is not available for seating.', 'code' => 409]];
                    }
                }
            }

            $reservation->update($validated);
            $tableId = $reservation->table_id;

            // Seating physically occupies the assigned table (distinct
            // domain event from the reservation transition itself).
            if ($target === 'seated' && $tableId) {
                $table = Table::lockForUpdate()->find($tableId);
                if ($table && $table->is_active && $table->status !== 'occupied'
                    && !in_array($table->status, ['maintenance', 'needs_cleaning'], true)
                ) {
                    $from = $table->status;
                    $table->update(['status' => 'occupied']);
                    AuditLogger::record('table_status_changed', $table, [
                        'description' => "Table {$table->number} status changed from "
                            .AuditLogger::label($from).' to Occupied',
                        'from' => $from,
                        'to' => 'occupied',
                    ], null, ['status' => $from]);
                }
            }

            // Release after seating: the cover leaves dirty. Cancellations
            // and no-shows before seating leave the table untouched.
            if (in_array($target, ['completed', 'cancelled'], true)
                && $previousStatus === 'seated' && $tableId
            ) {
                $table = Table::lockForUpdate()->find($tableId);
                if ($table && $table->is_active && $table->status !== 'needs_cleaning'
                    && !in_array($table->status, ['maintenance'], true)
                ) {
                    $from = $table->status;
                    $table->update(['status' => 'needs_cleaning']);
                    AuditLogger::record('table_status_changed', $table, [
                        'description' => "Table {$table->number} status changed from "
                            .AuditLogger::label($from).' to Needs Cleaning',
                        'from' => $from,
                        'to' => 'needs_cleaning',
                    ], null, ['status' => $from]);
                }
            }

            return ['reservation' => $reservation];
        });

        if (isset($result['error'])) {
            return $this->error($result['error']['message'], $result['error']['code']);
        }

        if ($validated['status'] !== $previousStatus) {
            $statusActions = [
                'confirmed' => 'reservation_confirmed',
                'seated' => 'reservation_seated',
                'completed' => 'reservation_completed',
                'cancelled' => 'reservation_cancelled',
                'no_show' => 'reservation_no_show',
                'pending' => 'reservation_reopened',
            ];
            \App\Services\AuditLogger::record(
                $statusActions[$validated['status']] ?? 'reservation_updated',
                $reservation,
                [
                    'description' => "Reservation {$reservation->reservation_number} "
                        .\App\Services\AuditLogger::label($validated['status'])
                        .($validated['status'] === 'cancelled' && !empty($validated['cancellation_reason'])
                            ? ": {$validated['cancellation_reason']}" : ''),
                    'from' => $previousStatus,
                    'to' => $validated['status'],
                ],
                null,
                ['status' => $previousStatus]
            );
        }

        // Table release on completed/cancelled-after-seating is handled by
        // the lifecycle transition inside the transaction above; the legacy
        // status == reserved branch is removed (reservations never produce
        // that state).

        return $this->success([
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'status' => $reservation->status,
        ], 'Reservation status updated successfully.');
    }

    /**
     * Check in a reservation with actual party size.
     * Handles partial shows by releasing original table and finding a smaller one.
     */
    public function checkIn(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        if ($reservation->status !== 'pending' && $reservation->status !== 'confirmed') {
            return $this->error('Only pending or confirmed reservations can be checked in.', 409);
        }

        $validated = $request->validate([
            'actual_party_size' => 'required|integer|min:1|max:50',
            'table_id' => 'nullable|exists:tables,id',
        ]);

        $actualPartySize = (int) $validated['actual_party_size'];
        $reservedPartySize = $reservation->reserved_party_size ?? $reservation->party_size;

        DB::transaction(function () use ($reservation, $actualPartySize, $reservedPartySize, $validated) {
            $originalTableId = $reservation->table_id;

            // If fewer people show up than reserved
            if ($actualPartySize < $reservedPartySize) {
                // Release the original table
                if ($originalTableId) {
                    $originalTable = Table::lockForUpdate()->find($originalTableId);
                    if ($originalTable && $originalTable->is_active && $originalTable->status === 'occupied') {
                        $originalTable->update(['status' => 'needs_cleaning']);
                        AuditLogger::record('table_status_changed', $originalTable, [
                            'description' => "Table {$originalTable->number} released due to partial show (reserved: {$reservedPartySize}, actual: {$actualPartySize})",
                            'from' => 'occupied',
                            'to' => 'needs_cleaning',
                        ], null, ['status' => 'occupied']);
                    }
                }

                // Find smallest available table for actual party size
                $policy = $this->getReservationPolicy();
                $duration = $reservation->duration_minutes ?? $policy['regular_duration'];
                $newTable = $this->findBestAvailableTable(
                    $actualPartySize,
                    $reservation->reservation_date->toDateString(),
                    $reservation->reservation_time,
                    $duration,
                    $reservation->requests()->get()->all(),
                    $reservation->id,
                    true
                );

                if ($newTable) {
                    $reservation->update([
                        'table_id' => $newTable->id,
                        'actual_party_size' => $actualPartySize,
                        'status' => 'seated',
                    ]);
                    $newTable->update(['status' => 'occupied']);
                    AuditLogger::record('table_status_changed', $newTable, [
                        'description' => "Table {$newTable->number} assigned for partial show (actual: {$actualPartySize})",
                        'from' => 'available',
                        'to' => 'occupied',
                    ], null, ['status' => 'available']);
                } else {
                    // No suitable table found - keep original or mark as issue
                    $reservation->update([
                        'actual_party_size' => $actualPartySize,
                        'status' => 'seated',
                    ]);
                }
            } else {
                // Full party or more showed up
                $targetTableId = $validated['table_id'] ?? $originalTableId;
                if ($targetTableId) {
                    $targetTable = Table::lockForUpdate()->find($targetTableId);
                    if ($targetTable && $targetTable->is_active && $targetTable->status !== 'occupied'
                        && !in_array($targetTable->status, ['maintenance', 'needs_cleaning'], true)
                    ) {
                        $targetTable->update(['status' => 'occupied']);
                        AuditLogger::record('table_status_changed', $targetTable, [
                            'description' => "Table {$targetTable->number} status changed to Occupied for check-in",
                            'from' => $targetTable->status,
                            'to' => 'occupied',
                        ], null, ['status' => $targetTable->status]);
                    }
                }
                $reservation->update([
                    'table_id' => $targetTableId,
                    'actual_party_size' => $actualPartySize,
                    'status' => 'seated',
                ]);
            }

            // Increment partial show counter if applicable
            if ($actualPartySize < $reservedPartySize && $reservation->customer_id) {
                $customer = \App\Models\Customer::find($reservation->customer_id);
                if ($customer) {
                    $customer->increment('partial_show_counter');
                }
                $reservation->increment('partial_show_counter');
            }
        });

        $reservation->load(['customer', 'table']);

        \App\Services\AuditLogger::record('reservation_checked_in', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} checked in (reserved: {$reservedPartySize}, actual: {$actualPartySize})",
            'reserved_party_size' => $reservedPartySize,
            'actual_party_size' => $actualPartySize,
        ]);

        return $this->success([
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'status' => $reservation->status,
            'reserved_party_size' => $reservedPartySize,
            'actual_party_size' => $reservation->actual_party_size,
            'table' => $reservation->table ? [
                'id' => $reservation->table->id,
                'number' => $reservation->table->number,
            ] : null,
        ], 'Reservation checked in successfully.');
    }

    /**
     * Process a no-show reservation.
     * Charges fees, forfeits deposits, updates counters, applies flags.
     */
    public function processNoShow(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::find($id);

        if (!$reservation) {
            return $this->notFound('Reservation not found.');
        }

        if ($reservation->status !== 'pending' && $reservation->status !== 'confirmed') {
            return $this->error('Only pending or confirmed reservations can be marked as no-show.', 409);
        }

        $policy = $this->getReservationPolicy();

        DB::transaction(function () use ($reservation, $policy) {
            // Release table if assigned
            if ($reservation->table_id) {
                $table = Table::lockForUpdate()->find($reservation->table_id);
                if ($table && $table->is_active && $table->status === 'occupied') {
                    $table->update(['status' => 'needs_cleaning']);
                    AuditLogger::record('table_status_changed', $table, [
                        'description' => "Table {$table->number} released due to no-show",
                        'from' => 'occupied',
                        'to' => 'needs_cleaning',
                    ], null, ['status' => 'occupied']);
                }
            }

            // Update reservation status
            $reservation->update([
                'status' => 'no_show',
                'no_show_counter' => $reservation->no_show_counter + 1,
            ]);

            // Increment customer no-show counter
            if ($reservation->customer_id) {
                $customer = \App\Models\Customer::find($reservation->customer_id);
                if ($customer) {
                    $customer->increment('no_show_counter');

                    // Check if flag level should increase
                    $newCounter = $customer->no_show_counter;
                    if ($newCounter >= $policy['flag_threshold'] && $customer->guest_flag_level < 2) {
                        $customer->update(['guest_flag_level' => 2]); // Level 2: 50% deposit + card
                    } elseif ($newCounter >= 1 && $customer->guest_flag_level < 1) {
                        $customer->update(['guest_flag_level' => 1]); // Level 1: card required
                    }
                }
            }

            // Update reservation guest flag level
            $newReservationCounter = $reservation->no_show_counter;
            if ($newReservationCounter >= $policy['flag_threshold']) {
                $reservation->update(['guest_flag_level' => 2]);
            } elseif ($newReservationCounter >= 1) {
                $reservation->update(['guest_flag_level' => 1]);
            }

            // Process no-show fee if card on file
            $feeCharged = 0;
            $depositForfeited = 0;

            if ($reservation->card_on_file && $reservation->card_required) {
                $feeCharged = $reservation->reserved_party_size * $policy['no_show_fee'];
                // TODO: Integrate with payment processor to charge the card
                // For now, just record the fee
                AuditLogger::record('no_show_fee_charged', $reservation, [
                    'description' => "No-show fee charged: {$feeCharged} for {$reservation->reserved_party_size} people",
                    'amount' => $feeCharged,
                    'party_size' => $reservation->reserved_party_size,
                    'fee_per_person' => $policy['no_show_fee'],
                ]);
            }

            // Forfeit deposit if paid
            if ($reservation->deposit_paid && $reservation->deposit_amount > 0) {
                $depositForfeited = $reservation->deposit_amount;
                $reservation->update(['deposit_paid' => false, 'deposit_amount' => 0]);
                AuditLogger::record('deposit_forfeited', $reservation, [
                    'description' => "Deposit forfeited due to no-show: {$depositForfeited}",
                    'amount' => $depositForfeited,
                ]);
            }
        });

        $reservation->load(['customer', 'table']);

        \App\Services\AuditLogger::record('reservation_no_show', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} marked as no-show",
            'no_show_counter' => $reservation->no_show_counter,
            'guest_flag_level' => $reservation->guest_flag_level,
        ]);

        return $this->success([
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'status' => $reservation->status,
            'no_show_counter' => $reservation->no_show_counter,
            'guest_flag_level' => $reservation->guest_flag_level,
            'fee_charged' => $reservation->card_on_file && $reservation->card_required ? $reservation->reserved_party_size * $policy['no_show_fee'] : 0,
            'deposit_forfeited' => $reservation->deposit_paid ? $reservation->deposit_amount : 0,
        ], 'Reservation marked as no-show.');
    }

    public function storeRequest(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::with('table')->find($id);
        if (! $reservation) {
            return $this->notFound('Reservation not found.');
        }

        $validated = $request->validate([
            'category' => 'required|in:seating,accessibility,dietary,occasion,other',
            'label' => 'required|string|max:120',
            'value' => 'nullable|string|max:120',
            'details' => 'nullable|string|max:1000',
            'priority' => 'sometimes|in:normal,high',
        ]);

        [$matched] = $reservation->table
            ? $this->availability->matchRequests($reservation->table, [$validated])
            : [[], []];
        $validated['is_matched'] = in_array($validated['category'], ['seating', 'accessibility'], true) && $reservation->table
            ? $matched !== []
            : null;

        $item = $reservation->requests()->create($validated);
        $item->refresh();

        AuditLogger::record('reservation_request_added', $reservation, [
            'description' => "Request {$item->label} added to reservation {$reservation->reservation_number}",
        ]);

        StaffNotificationService::notifyReservation($reservation, [
            'type' => 'request',
            'icon' => 'request',
            'title' => 'Special request added',
            'description' => "{$reservation->guest_name} · {$item->label}",
            'action_label' => 'View request',
            'action_url' => "/reservations/{$reservation->id}",
        ]);

        return $this->created(ReservationRequestService::serialize($item), 'Request added successfully.');
    }

    public function updateRequest(Request $request, string $id, string $requestId): JsonResponse
    {
        $reservation = Reservation::with('table')->find($id);
        if (! $reservation) {
            return $this->notFound('Reservation not found.');
        }

        $item = $reservation->requests()->find($requestId);
        if (! $item) {
            return $this->notFound('Request not found.');
        }

        $validated = $request->validate([
            'category' => 'sometimes|in:seating,accessibility,dietary,occasion,other',
            'label' => 'sometimes|string|max:120',
            'value' => 'nullable|string|max:120',
            'details' => 'nullable|string|max:1000',
            'priority' => 'sometimes|in:normal,high',
            'status' => 'sometimes|in:pending,acknowledged,in_progress,completed,cancelled',
        ]);

        if (($validated['status'] ?? null) === 'acknowledged') {
            $validated['acknowledged_by'] = $request->user()?->id;
            $validated['acknowledged_at'] = now();
        }
        if (($validated['status'] ?? null) === 'completed') {
            $validated['completed_by'] = $request->user()?->id;
            $validated['completed_at'] = now();
        }

        $item->update($validated);

        if ($reservation->table && (
            array_key_exists('category', $validated)
            || array_key_exists('label', $validated)
            || array_key_exists('value', $validated)
        )) {
            [$matched] = $this->availability->matchRequests($reservation->table, [$item->refresh()->toArray()]);
            $item->update([
                'is_matched' => in_array($item->category, ['seating', 'accessibility'], true)
                    ? $matched !== []
                    : null,
            ]);
        }

        AuditLogger::record('reservation_request_updated', $reservation, [
            'description' => "Request {$item->label} updated on reservation {$reservation->reservation_number}",
            'status' => $item->status,
        ]);

        StaffNotificationService::notifyReservation($reservation, [
            'type' => 'request',
            'icon' => 'request',
            'title' => 'Special request updated',
            'description' => "{$reservation->guest_name} · {$item->label} is now {$item->status}",
            'action_label' => 'View request',
            'action_url' => "/reservations/{$reservation->id}",
        ]);

        return $this->success(ReservationRequestService::serialize($item), 'Request updated successfully.');
    }

    public function destroyRequest(Request $request, string $id, string $requestId): JsonResponse
    {
        $reservation = Reservation::find($id);
        if (! $reservation) {
            return $this->notFound('Reservation not found.');
        }

        $item = $reservation->requests()->find($requestId);
        if (! $item) {
            return $this->notFound('Request not found.');
        }

        $label = $item->label;
        $item->delete();

        AuditLogger::record('reservation_request_removed', $reservation, [
            'description' => "Request {$label} removed from reservation {$reservation->reservation_number}",
        ]);

        return $this->success(null, 'Request removed successfully.');
    }
}