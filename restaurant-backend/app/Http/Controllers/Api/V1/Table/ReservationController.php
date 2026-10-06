<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Table;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Customer;
use App\Models\Table;
use App\Services\AuditLogger;
use App\Services\TableDiningPolicy;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationController extends Controller
{
    private const BLOCKING_STATUSES = ['pending', 'confirmed', 'seated'];

    private function overlapsActiveReservation(
        string $tableId,
        string $date,
        string $time,
        int $durationMinutes = 90,
        ?string $excludeId = null
    ): bool {
        // Normalize: callers may pass a full ISO datetime; only the date part is relevant here.
        $date = Carbon::parse($date)->toDateString();
        $slotStart = Carbon::parse("{$date} {$time}");
        $slotEnd = $slotStart->copy()->addMinutes($durationMinutes);

        $query = Reservation::where('table_id', $tableId)
            ->whereIn('status', self::BLOCKING_STATUSES)
            ->whereDate('reservation_date', $date);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        foreach ($query->get() as $reservation) {
            if (! $reservation->reservation_time) {
                continue;
            }
            $resStart = Carbon::parse(
                $reservation->reservation_date->toDateString().' '.$reservation->reservation_time
            );
            $resDuration = $reservation->duration_minutes ?? 90;
            $resEnd = $resStart->copy()->addMinutes($resDuration);

            if ($slotStart->lt($resEnd) && $resStart->lt($slotEnd)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get reservation policy settings from restaurant settings.
     */
    private function getReservationPolicy(): array
    {
        $settings = \App\Models\RestaurantSetting::first();
        return [
            'card_threshold' => $settings->reservation_card_threshold ?? 6,
            'no_show_fee' => $settings->reservation_no_show_fee ?? 15.00,
            'flag_threshold' => $settings->reservation_no_show_flag_threshold ?? 2,
            'deposit_percentage' => $settings->reservation_deposit_percentage ?? 50.00,
            'cancellation_window' => $settings->reservation_cancellation_window_minutes ?? 15,
            'regular_duration' => $settings->reservation_regular_duration_minutes ?? 180,
            'large_duration' => $settings->reservation_large_duration_minutes ?? 240,
            'weekend_days' => $settings->reservation_weekend_days ?? [5, 6], // Friday=5, Saturday=6
        ];
    }

    /**
     * Calculate duration based on party size.
     */
    private function calculateDuration(int $partySize, array $policy): int
    {
        return $partySize <= 4 ? $policy['regular_duration'] : $policy['large_duration'];
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
    private function findBestAvailableTable(int $partySize, string $date, string $time, int $durationMinutes): ?Table
    {
        $tables = Table::where('is_active', true)
            ->whereNotIn('status', ['needs_cleaning', 'maintenance'])
            ->where('capacity', '>=', $partySize)
            ->orderBy('capacity')
            ->orderBy('number')
            ->get();

        foreach ($tables as $table) {
            if ($this->isTableAvailableForDuration($table->id, $date, $time, $durationMinutes)) {
                return $table;
            }
        }

        return null;
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
        ]);

        $policy = $this->getReservationPolicy();
        $duration = $this->calculateDuration($validated['party_size'], $policy);
        $table = $this->findBestAvailableTable($validated['party_size'], $validated['reservation_date'], $validated['reservation_time'], $duration);

        $requiresCard = $this->requiresCard($validated['party_size'], $validated['reservation_date'], $policy);
        $requiresDeposit = $this->requiresDeposit($validated['party_size'], $policy);

        return $this->success([
            'available' => $table !== null,
            'table' => $table ? [
                'id' => $table->id,
                'number' => $table->number,
                'capacity' => $table->capacity,
            ] : null,
            'duration_minutes' => $duration,
            'end_time' => Carbon::parse("{$validated['reservation_date']} {$validated['reservation_time']}")->addMinutes($duration)->format('H:i'),
            'requires_card' => $requiresCard,
            'requires_deposit' => $requiresDeposit,
            'deposit_amount' => $requiresDeposit ? $this->calculateDepositAmount($validated['party_size'], $policy) : 0,
            'policy' => [
                'card_threshold' => $policy['card_threshold'],
                'weekend_days' => $policy['weekend_days'],
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
                $tables = Table::where('is_active', true)
                    ->whereNotIn('status', ['needs_cleaning', 'maintenance'])
                    ->where('capacity', '>=', $partySize)
                    ->orderBy('number')
                    ->get();

                foreach ($tables as $table) {
                    $isOccupied = false;
                    $occupyingReservation = null;

                    foreach ($reservations as $res) {
                        if ($res->table_id !== $table->id) continue;
                        $resStart = Carbon::parse($res->reservation_date->toDateString() . ' ' . $res->reservation_time);
                        $resEnd = $resStart->copy()->addMinutes($res->duration_minutes ?? $duration);

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
        $query = Reservation::with(['customer', 'table']);

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
            'status' => $r->status,
            'source' => $r->source,
            'special_requests' => $r->special_requests,
            'event_type' => $r->event_type,
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
            'card_on_file' => 'sometimes|boolean',
            'deposit_paid' => 'sometimes|boolean',
        ]);

        // Normalize to a pure date: clients may send an ISO datetime (date+T+time).
        $validated['reservation_date'] = Carbon::parse($validated['reservation_date'])->toDateString();

        // Get policy settings
        $policy = $this->getReservationPolicy();
        $partySize = (int) $validated['party_size'];

        // Determine duration based on party size
        $duration = $this->calculateDuration($partySize, $policy);
        $validated['duration_minutes'] = $duration;
        $validated['end_time'] = Carbon::parse("{$validated['reservation_date']} {$validated['reservation_time']}")->addMinutes($duration)->format('H:i');

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

        // Validate table availability for the full duration
        if (! empty($validated['table_id'])) {
            $table = Table::where('id', $validated['table_id'])->first();
            if (! $table || ! $table->is_active || in_array($table->status, ['needs_cleaning', 'maintenance'], true)) {
                return $this->error('The selected table is not available.', 422);
            }
            if ($partySize > (int) $table->capacity) {
                return $this->error(
                    'Party size exceeds the capacity of the selected table.',
                    422
                );
            }
            if ($this->overlapsActiveReservation($validated['table_id'], $validated['reservation_date'], $validated['reservation_time'], $duration)) {
                return $this->error(
                    'This table is already reserved for the selected time.',
                    409
                );
            }
        } else {
            // Auto-assign best available table
            $bestTable = $this->findBestAvailableTable($partySize, $validated['reservation_date'], $validated['reservation_time'], $duration);
            if ($bestTable) {
                $validated['table_id'] = $bestTable->id;
            }
        }

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

        $reservation = Reservation::create($validated);
        $reservation->load(['customer', 'table']);

        \App\Services\AuditLogger::record('reservation_created', $reservation, [
            'description' => "Reservation {$reservation->reservation_number} created for {$reservation->guest_name} (party of {$reservation->party_size})",
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
            'event_type' => $reservation->event_type,
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

        $reservations = Reservation::with(['customer', 'table'])
            ->whereBetween('reservation_date', [$startDate, $endDate])
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
            'status' => $r->status,
            'event_type' => $r->event_type,
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
        $tables = \App\Models\Table::where('is_active', true)
            ->whereNotIn('status', ['maintenance', 'needs_cleaning'])
            ->orderBy('number')
            ->get(['id', 'number', 'capacity', 'status']);

        $reservations = Reservation::whereBetween('reservation_date', [$startDate, $endDate])
            ->whereIn('status', ['pending', 'confirmed', 'seated'])
            ->get(['table_id', 'reservation_date', 'reservation_time', 'status']);

        $occupancy = [];
        $start = \Carbon\Carbon::parse($startDate);
        $end = \Carbon\Carbon::parse($endDate);

        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $dateStr = $date->toDateString();
            $dayReservations = $reservations->where('reservation_date', $dateStr);

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
                            'reservation_time' => $r->reservation_time,
                            'status' => $r->status,
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
        $reservation = Reservation::with(['customer', 'table'])->find($id);

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
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'event_type' => $reservation->event_type,
            'cancellation_reason' => $reservation->cancellation_reason,
            'customer' => $reservation->customer ? [
                'id' => $reservation->customer->id,
                'name' => $reservation->customer->name,
                'phone' => $reservation->customer->phone,
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
        ]);

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

        $tableId = $validated['table_id'] ?? $reservation->table_id;
        $date = $validated['reservation_date'] ?? $reservation->reservation_date->toDateString();
        $time = $validated['reservation_time'] ?? $reservation->reservation_time;

        if (! empty($tableId)) {
            $table = Table::where('id', $tableId)->first();
            if (! $table || ! $table->is_active || in_array($table->status, ['needs_cleaning', 'maintenance'], true)) {
                return $this->error('The selected table is not available.', 422);
            }
            if (isset($validated['party_size']) && (int) $validated['party_size'] > (int) $table->capacity) {
                return $this->error('Party size exceeds the capacity of the selected table.', 422);
            }
            $durationMinutes = $reservation->duration_minutes ?? 90;
            if ($this->overlapsActiveReservation($tableId, $date, $time, $durationMinutes, $reservation->id)) {
                return $this->error('This table is already reserved for the selected time.', 409);
            }
        } elseif (isset($validated['party_size']) && $reservation->table_id) {
            $table = $reservation->table;
            if ((int) $validated['party_size'] > (int) $table->capacity) {
                return $this->error('Party size exceeds the capacity of the selected table.', 422);
            }
        }

        $reservation->update($validated);
        $reservation->load(['customer', 'table']);

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
            'status' => $reservation->status,
            'source' => $reservation->source,
            'special_requests' => $reservation->special_requests,
            'event_type' => $reservation->event_type,
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

        // Seat pre-check: the effective table must be operational. This runs
        // before any write so a dirty table can never be seated onto.
        if ($validated['status'] === 'seated') {
            $seatTableId = $validated['table_id'] ?? $reservation->table_id;
            if ($seatTableId) {
                $seatTable = Table::find($seatTableId);
                if (!$seatTable || !$seatTable->is_active
                    || in_array($seatTable->status, ['maintenance', 'needs_cleaning'], true)
                ) {
                    return $this->error('The assigned table is not available for seating.', 409);
                }
            }
        }

        DB::transaction(function () use ($reservation, $validated, $previousStatus) {
            $reservation->update($validated);

            $target = $validated['status'];
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
        });

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
                $newTable = $this->findBestAvailableTable($actualPartySize, $reservation->reservation_date->toDateString(), $reservation->reservation_time, $duration);

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
}
