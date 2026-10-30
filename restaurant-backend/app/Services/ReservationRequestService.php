<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationRequest;
use App\Models\Table;

class ReservationRequestService
{
    public const CATEGORIES = ['seating', 'accessibility', 'dietary', 'occasion', 'other'];

    public const STATUSES = ['pending', 'acknowledged', 'in_progress', 'completed', 'cancelled'];

    public const PRIORITIES = ['normal', 'high'];

    /**
     * @param  array<int, array<string, mixed>>  $requests
     */
    public function createMany(Reservation $reservation, array $requests, ?Table $table = null): void
    {
        if ($requests === []) {
            return;
        }

        $availability = app(ReservationAvailabilityService::class);

        foreach ($requests as $request) {
            $category = strtolower((string) ($request['category'] ?? 'other'));
            $label = trim((string) ($request['label'] ?? ''));
            $value = isset($request['value']) ? trim((string) $request['value']) : null;

            if ($label === '') {
                $label = ucwords(str_replace('_', ' ', $value ?: $category));
            }

            $isMatched = null;
            if ($table && in_array($category, ['seating', 'accessibility'], true)) {
                [$matched] = $availability->matchRequests($table, [[
                    'category' => $category,
                    'label' => $label,
                    'value' => $value,
                ]]);
                $isMatched = $matched !== [];
            }

            $reservation->requests()->create([
                'category' => $category,
                'label' => $label,
                'value' => $value,
                'details' => $request['details'] ?? null,
                'priority' => $request['priority'] ?? 'normal',
                'status' => 'pending',
                'is_matched' => $isMatched,
            ]);
        }
    }

    /**
     * Keep completed/acknowledged request history. Only pending rows are
     * replaced when the reservation form is edited.
     *
     * @param  array<int, array<string, mixed>>  $requests
     */
    public function syncPending(Reservation $reservation, array $requests, ?Table $table = null): void
    {
        $reservation->requests()->where('status', 'pending')->delete();
        $this->createMany($reservation, $requests, $table);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function serializeCollection(iterable $requests): array
    {
        $items = [];

        foreach ($requests as $request) {
            $items[] = [
                'id' => $request->id,
                'category' => $request->category,
                'label' => $request->label,
                'value' => $request->value,
                'details' => $request->details,
                'status' => $request->status,
                'priority' => $request->priority,
                'is_matched' => $request->is_matched,
                'acknowledged_by' => $request->acknowledged_by,
                'acknowledged_at' => $request->acknowledged_at?->toISOString(),
                'completed_by' => $request->completed_by,
                'completed_at' => $request->completed_at?->toISOString(),
                'created_at' => $request->created_at?->toISOString(),
                'updated_at' => $request->updated_at?->toISOString(),
            ];
        }

        return $items;
    }

    public static function serialize(?ReservationRequest $request): ?array
    {
        return $request ? self::serializeCollection([$request])[0] : null;
    }
}
