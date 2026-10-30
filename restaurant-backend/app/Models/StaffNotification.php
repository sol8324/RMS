<?php

declare(strict_types=1);

namespace App\Models;

class StaffNotification extends BaseModel
{
    protected $fillable = [
        'user_id',
        'type',
        'icon',
        'title',
        'description',
        'action_label',
        'action_url',
        'related_type',
        'related_id',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function getTable(): string
    {
        return 'staff_notifications';
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
