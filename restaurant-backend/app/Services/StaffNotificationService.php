<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\StaffNotification;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class StaffNotificationService
{
    /**
     * @param  array<int, string>  $roles
     * @param  array<string, mixed>  $payload
     */
    public static function notifyRoles(
        array $roles,
        array $payload,
        ?string $excludeUserId = null
    ): void {
        $excludeUserId ??= Auth::id();

        $deliver = static function () use ($roles, $payload, $excludeUserId): void {
            self::deliver($roles, $payload, $excludeUserId);
        };

        if (DB::transactionLevel() > 0) {
            DB::afterCommit($deliver);

            return;
        }

        $deliver();
    }

    /**
     * @param  array<int, string>  $roles
     * @param  array<string, mixed>  $payload
     */
    private static function deliver(array $roles, array $payload, ?string $excludeUserId): void
    {
        try {
            $users = User::query()
                ->where('is_active', true)
                ->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))
                ->when($excludeUserId, fn ($query) => $query->where('id', '!=', $excludeUserId))
                ->get(['id']);

            $type = $payload['type'] ?? 'info';
            $title = $payload['title'] ?? 'Notification';
            $description = $payload['description'] ?? '';
            $relatedType = $payload['related_type'] ?? null;
            $relatedId = $payload['related_id'] ?? null;

            foreach ($users as $user) {
                $duplicate = StaffNotification::query()
                    ->where('user_id', $user->id)
                    ->where('type', $type)
                    ->where('title', $title)
                    ->where('description', $description)
                    ->when($relatedType !== null, fn ($query) => $query->where('related_type', $relatedType))
                    ->when($relatedId !== null, fn ($query) => $query->where('related_id', $relatedId))
                    ->exists();

                if ($duplicate) {
                    continue;
                }

                StaffNotification::create([
                    'user_id' => $user->id,
                    'type' => $type,
                    'icon' => $payload['icon'] ?? 'info',
                    'title' => $title,
                    'description' => $description,
                    'action_label' => $payload['action_label'] ?? null,
                    'action_url' => $payload['action_url'] ?? null,
                    'related_type' => $relatedType,
                    'related_id' => $relatedId,
                ]);
            }
        } catch (\Throwable) {
            // Notifications must never break a reservation transaction.
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function notifyReservation(Model $reservation, array $payload): void
    {
        $payload['related_type'] = $payload['related_type'] ?? $reservation->getMorphClass();
        $payload['related_id'] = $payload['related_id'] ?? $reservation->getKey();

        self::notifyRoles(['admin', 'manager', 'waiter'], $payload);
    }
}
