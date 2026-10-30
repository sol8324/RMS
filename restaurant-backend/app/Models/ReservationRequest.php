<?php

declare(strict_types=1);

namespace App\Models;

class ReservationRequest extends BaseModel
{
    protected $fillable = [
        'reservation_id',
        'category',
        'label',
        'value',
        'details',
        'status',
        'priority',
        'is_matched',
        'acknowledged_by',
        'acknowledged_at',
        'completed_by',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'is_matched' => 'boolean',
            'acknowledged_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function getTable(): string
    {
        return 'reservation_requests';
    }

    public function reservation()
    {
        return $this->belongsTo(Reservation::class);
    }

    public function acknowledgedBy()
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
