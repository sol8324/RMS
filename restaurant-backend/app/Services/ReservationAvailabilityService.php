<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Reservation;
use App\Models\RestaurantSetting;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReservationAvailabilityService
{
    public const BLOCKING_STATUSES = ['pending', 'confirmed', 'seated'];

    public function policy(): array
    {
        $settings = RestaurantSetting::first();

        return [
            'card_threshold' => $settings?->reservation_card_threshold ?? 6,
            'no_show_fee' => (float) ($settings?->reservation_no_show_fee ?? 15.00),
            'flag_threshold' => $settings?->reservation_no_show_flag_threshold ?? 2,
            'deposit_percentage' => (float) ($settings?->reservation_deposit_percentage ?? 50.00),
            'cancellation_window' => $settings?->reservation_cancellation_window_minutes ?? 15,
            'regular_duration' => $settings?->reservation_regular_duration_minutes ?? 180,
            'large_duration' => $settings?->reservation_large_duration_minutes ?? 240,
            'turnover_buffer' => $settings?->reservation_turnover_buffer_minutes ?? 15,
            'weekend_days' => $settings?->reservation_weekend_days ?? [5, 6],
        ];
    }

    public function durationFor(int $partySize, ?array $policy = null): int
    {
        $policy ??= $this->policy();
        $duration = $partySize <= 4 ? $policy['regular_duration'] : $policy['large_duration'];

        return max(30, (int) $duration);
    }

    public function bufferMinutes(?array $policy = null): int
    {
        $policy ??= $this->policy();

        return max(0, (int) ($policy['turnover_buffer'] ?? 0));
    }

    /**
     * A prior reservation blocks until its end time plus the cleaning buffer.
     */
    public function tableHasConflict(
        string $tableId,
        Carbon $start,
        int $durationMinutes,
        ?string $excludeId = null,
        ?int $bufferMinutes = null
    ): bool {
        $end = $start->copy()->addMinutes($durationMinutes);
        $buffer = $bufferMinutes ?? $this->bufferMinutes();

        $query = Reservation::where('table_id', $tableId)
            ->whereIn('status', self::BLOCKING_STATUSES)
            ->whereDate('reservation_date', '>=', $start->copy()->subDay()->toDateString())
            ->whereDate('reservation_date', '<=', $end->copy()->addDay()->toDateString());

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        foreach ($query->get(['id', 'reservation_date', 'reservation_time', 'duration_minutes']) as $reservation) {
            if (! $reservation->reservation_time) {
                continue;
            }

            $reservationStart = Carbon::parse(
                $reservation->reservation_date->toDateString().' '.$reservation->reservation_time
            );
            $reservationEnd = $reservationStart->copy()->addMinutes(
                (int) ($reservation->duration_minutes ?? 90)
            );
            $blockedUntil = $reservationEnd->copy()->addMinutes($buffer);

            if ($start->lt($blockedUntil) && $reservationStart->lt($end)) {
                return true;
            }
        }

        return false;
    }

    public function isTableOperational(Table $table): bool
    {
        return (bool) $table->is_active
            && ! in_array($table->status, ['maintenance', 'needs_cleaning'], true);
    }

    /**
     * @return Collection<int, Table>
     */
    public function candidateTables(int $partySize, bool $lock = false): Collection
    {
        $query = Table::query()
            ->where('is_active', true)
            ->whereNotIn('status', ['maintenance', 'needs_cleaning'])
            ->where('capacity', '>=', $partySize)
            ->orderBy('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->get();
    }

    /**
     * @param  array<int, array<string, mixed>|\App\Models\ReservationRequest>  $requests
     * @return Collection<int, Table>
     */
    public function availableTables(
        string $date,
        string $time,
        int $partySize,
        array $requests = [],
        ?string $excludeReservationId = null,
        bool $lock = false
    ): Collection {
        $start = Carbon::parse("{$date} {$time}");
        $policy = $this->policy();
        $duration = $this->durationFor($partySize, $policy);
        $buffer = $this->bufferMinutes($policy);
        $now = now();
        $slotIsNow = $start->lte($now) && $now->lt($start->copy()->addMinutes($duration));

        return $this->candidateTables($partySize, $lock)
            ->filter(function (Table $table) use ($start, $duration, $buffer, $excludeReservationId, $slotIsNow) {
                if ($slotIsNow && $table->status === 'occupied') {
                    return false;
                }

                return ! $this->tableHasConflict(
                    $table->id,
                    $start,
                    $duration,
                    $excludeReservationId,
                    $buffer
                );
            })
            ->values();
    }

    /**
     * @param  array<int, array<string, mixed>|\App\Models\ReservationRequest>  $requests
     * @return array<string, mixed>|null
     */
    public function bestAssignment(
        int $partySize,
        string $date,
        string $time,
        array $requests = [],
        ?string $excludeReservationId = null,
        bool $lock = false
    ): ?array {
        $start = Carbon::parse("{$date} {$time}");
        $policy = $this->policy();
        $duration = $this->durationFor($partySize, $policy);
        $buffer = $this->bufferMinutes($policy);

        $candidates = $this->availableTables(
            $date,
            $time,
            $partySize,
            $requests,
            $excludeReservationId,
            $lock
        );

        $scored = $candidates->map(function (Table $table) use ($partySize, $requests) {
            [$matched, $unmet] = $this->matchRequests($table, $requests);
            $waste = max(0, (int) $table->capacity - $partySize);

            return [
                'table' => $table,
                'score' => (count($matched) * 1000) - ($waste * 10) - (int) $table->capacity,
                'matched_requests' => $matched,
                'unmet_requests' => $unmet,
                'capacity_waste' => $waste,
            ];
        })->sort(function (array $a, array $b) {
            if ($a['score'] !== $b['score']) {
                return $b['score'] <=> $a['score'];
            }
            if ($a['capacity_waste'] !== $b['capacity_waste']) {
                return $a['capacity_waste'] <=> $b['capacity_waste'];
            }

            return strnatcasecmp((string) $a['table']->number, (string) $b['table']->number);
        })->values();

        $best = $scored->first();
        if (! $best) {
            return null;
        }

        return [
            'table' => $best['table'],
            'score' => $best['score'],
            'matched_requests' => $best['matched_requests'],
            'unmet_requests' => $best['unmet_requests'],
            'duration_minutes' => $duration,
            'end_time' => $start->copy()->addMinutes($duration)->format('H:i'),
            'buffer_minutes' => $buffer,
        ];
    }

    /**
     * Resolve which structured requests a table satisfies. Dietary/occasion
     * requests are staff-facing notes, not table attributes.
     *
     * @param  array<int, array<string, mixed>|\App\Models\ReservationRequest>  $requests
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    public function matchRequests(Table $table, array $requests): array
    {
        $matched = [];
        $unmet = [];

        foreach ($requests as $request) {
            $item = is_array($request) ? $request : $request->toArray();
            $category = strtolower((string) ($item['category'] ?? 'other'));

            if (! in_array($category, ['seating', 'accessibility'], true)) {
                continue;
            }

            $result = $category === 'accessibility'
                ? (bool) $table->is_wheelchair_accessible
                : $this->locationMatches($table, $item);

            if ($result) {
                $matched[] = $item;
            } else {
                $unmet[] = $item;
            }
        }

        return [$matched, $unmet];
    }

    /**
     * @param  array<string, mixed>  $request
     */
    public function locationMatches(Table $table, array $request): bool
    {
        $needle = strtolower(trim((string) ($request['value'] ?? $request['label'] ?? '')));
        if ($needle === '') {
            return false;
        }

        $needle = str_replace(['_', '-'], ' ', $needle);
        $haystack = strtolower(trim(implode(' ', array_filter([
            $table->location,
            $table->location_description,
        ]))));

        if ($haystack === '') {
            return false;
        }

        $aliases = [
            'window' => ['window'],
            'center' => ['center', 'middle'],
            'entrance' => ['entrance', 'exit', 'door'],
            'kitchen' => ['kitchen'],
            'cashier' => ['cashier', 'counter'],
            'private' => ['private'],
            'outdoor' => ['outdoor', 'patio', 'outside'],
        ];

        foreach ($aliases as $keyword => $terms) {
            if (str_contains($needle, $keyword)) {
                foreach ($terms as $term) {
                    if (str_contains($haystack, $term)) {
                        return true;
                    }
                }

                return false;
            }
        }

        return str_contains($haystack, $needle);
    }
}
