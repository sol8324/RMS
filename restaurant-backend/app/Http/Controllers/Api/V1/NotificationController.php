<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StaffNotification;
use App\Traits\ApiResponder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponder;

    public function index(Request $request): JsonResponse
    {
        $query = StaffNotification::where('user_id', $request->user()->id)
            ->when($request->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('created_at');

        $notifications = $query->paginate($request->integer('per_page', 30));

        return $this->success([
            'items' => $notifications->getCollection()->map(fn (StaffNotification $item) => $this->serialize($item)),
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
            'unread_count' => StaffNotification::where('user_id', $request->user()->id)
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = StaffNotification::where('user_id', $request->user()->id)->find($id);

        if (! $notification) {
            return $this->notFound('Notification not found.');
        }

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return $this->success($this->serialize($notification), 'Notification marked as read.');
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $count = StaffNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->success(['updated' => $count], 'Notifications marked as read.');
    }

    private function serialize(StaffNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'icon' => $notification->icon,
            'title' => $notification->title,
            'description' => $notification->description,
            'action_label' => $notification->action_label,
            'action_url' => $notification->action_url,
            'related_type' => $notification->related_type,
            'related_id' => $notification->related_id,
            'read' => $notification->read_at !== null,
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at?->toISOString(),
        ];
    }
}
