<?php

declare(strict_types=1);

namespace App\Models;

class Customer extends BaseModel
{
    protected $fillable = [
        'name', 'email', 'phone', 'address', 'birthday', 'dietary_restrictions', 'customer_type',
        'loyalty_points', 'total_spent', 'visit_count', 'notes', 'is_active',
        'no_show_counter', 'partial_show_counter', 'guest_flag_level',
    ];

    protected function casts(): array
    {
        return [
            'loyalty_points' => 'integer',
            'total_spent' => 'decimal:2',
            'visit_count' => 'integer',
            'is_active' => 'boolean',
            'no_show_counter' => 'integer',
            'partial_show_counter' => 'integer',
            'guest_flag_level' => 'integer',
        ];
    }

    public function getTable(): string
    {
        return 'customers';
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }

    /**
     * Loyalty tier derived STRICTLY from visit_count (never stored, never
     * manually editable):
     *   0–4 Member · 5–9 Bronze · 10–19 Silver · 20–29 Gold · 30+ Platinum
     */
    public function loyaltyTier(): string
    {
        return match (true) {
            $this->visit_count >= 30 => 'Platinum',
            $this->visit_count >= 20 => 'Gold',
            $this->visit_count >= 10 => 'Silver',
            $this->visit_count >= 5 => 'Bronze',
            default => 'Member',
        };
    }

    /**
     * Records one completed dining visit for a REGISTERED customer and keeps
     * running totals fresh.
     *
     * Called exactly once per order transition INTO "completed" with paid
     * status — never on customer/reservation/order creation or seating.
     */
    public function recordCompletedVisit(float $orderTotal): void
    {
        $previousTier = $this->loyaltyTier();

        $this->increment('visit_count');
        $this->increment('total_spent', $orderTotal);

        $newTier = $this->loyaltyTier();

        if ($previousTier !== $newTier) {
            \App\Services\AuditLogger::record('customer_loyalty_tier_changed', $this, [
                'description' => "Customer {$this->name} loyalty tier changed from {$previousTier} to {$newTier}.",
                'from' => $previousTier,
                'to' => $newTier,
            ]);
        }
    }
}
