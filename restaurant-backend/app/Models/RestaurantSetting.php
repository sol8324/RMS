<?php

declare(strict_types=1);

namespace App\Models;

class RestaurantSetting extends BaseModel
{
    protected $fillable = [
        'name',
        'description',
        'address',
        'city',
        'state',
        'postal_code',
        'country',
        'phone',
        'email',
        'website',
        'logo_url',
        'timezone',
        'currency',
        'currency_symbol',
        'tax_id',
        'branch_code',
        'business_registration',
        'opening_hours',
        'default_tax_rate',
        'vat_enabled',
        'vat_registered',
        'vat_inclusive',
        'default_service_charge',
        'service_charge_enabled',
        'receipt_header',
        'receipt_footer',
        'order_prefix',
        'invoice_prefix',
        'table_reservation_timeout',
        'kitchen_display_timeout',
        'auto_cancel_timeout',
        'allow_negative_inventory',
        'low_stock_threshold',
        // Reservation policy settings
        'reservation_card_threshold',
        'reservation_no_show_fee',
        'reservation_no_show_flag_threshold',
        'reservation_deposit_percentage',
        'reservation_cancellation_window_minutes',
        'reservation_regular_duration_minutes',
        'reservation_large_duration_minutes',
        'reservation_weekend_days',
    ];

    protected $casts = [
        'opening_hours' => 'array',
        'default_tax_rate' => 'decimal:2',
        'vat_enabled' => 'boolean',
        'vat_registered' => 'boolean',
        'vat_inclusive' => 'boolean',
        'default_service_charge' => 'decimal:2',
        'service_charge_enabled' => 'boolean',
        'allow_negative_inventory' => 'boolean',
        'reservation_card_threshold' => 'integer',
        'reservation_no_show_fee' => 'decimal:2',
        'reservation_no_show_flag_threshold' => 'integer',
        'reservation_deposit_percentage' => 'decimal:2',
        'reservation_cancellation_window_minutes' => 'integer',
        'reservation_regular_duration_minutes' => 'integer',
        'reservation_large_duration_minutes' => 'integer',
        'reservation_weekend_days' => 'array',
    ];

    public function getTable(): string
    {
        return 'restaurant_settings';
    }
}
