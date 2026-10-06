<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\Carbon;

class Reservation extends BaseModel
{
    protected $fillable = [
        'customer_id', 'table_id', 'reservation_number', 'guest_name',
        'guest_phone', 'guest_email', 'party_size', 'reservation_date',
        'reservation_time', 'status', 'source', 'special_requests',
        'event_type', 'card_required', 'deposit_required', 'deposit_amount',
        'deposit_paid', 'card_on_file', 'reserved_party_size', 'actual_party_size',
        'duration_minutes', 'end_time', 'reminder_24h_sent', 'reminder_2h_sent',
        'cancellation_reason', 'no_show_counter', 'partial_show_counter', 'guest_flag_level', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'party_size' => 'integer',
            'reserved_party_size' => 'integer',
            'actual_party_size' => 'integer',
            'duration_minutes' => 'integer',
            'reservation_date' => 'datetime',
            'end_time' => 'datetime',
            'card_required' => 'boolean',
            'deposit_required' => 'boolean',
            'deposit_paid' => 'boolean',
            'card_on_file' => 'boolean',
            'reminder_24h_sent' => 'boolean',
            'reminder_2h_sent' => 'boolean',
            'no_show_counter' => 'integer',
            'partial_show_counter' => 'integer',
            'guest_flag_level' => 'integer',
            'archived_at' => 'datetime',
            'deposit_amount' => 'decimal:2',
        ];
    }

    public function getTable(): string
    {
        return 'reservations';
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function table()
    {
        return $this->belongsTo(Table::class);
    }

    /**
     * Calculate end time based on start time and duration.
     */
    public function getEndTimeAttribute(): ?string
    {
        if ($this->reservation_time && $this->duration_minutes) {
            $start = Carbon::parse($this->reservation_time);
            return $start->addMinutes($this->duration_minutes)->format('H:i');
        }
        return $this->attributes['end_time'] ?? null;
    }

    /**
     * Check if reservation requires a card on file.
     */
    public function requiresCard(): bool
    {
        return $this->card_required;
    }

    /**
     * Check if reservation requires a deposit.
     */
    public function requiresDeposit(): bool
    {
        return $this->deposit_required;
    }

    /**
     * Get the effective party size (actual if checked in, reserved otherwise).
     */
    public function getEffectivePartySize(): int
    {
        return $this->actual_party_size ?? $this->reserved_party_size ?? $this->party_size;
    }

    /**
     * Check if guest is flagged for card requirement.
     */
    public function isFlaggedForCard(): bool
    {
        return $this->guest_flag_level >= 1;
    }

    /**
     * Check if guest is flagged for deposit requirement.
     */
    public function isFlaggedForDeposit(): bool
    {
        return $this->guest_flag_level >= 2;
    }
}
