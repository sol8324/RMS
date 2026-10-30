<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\RestaurantSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SettingController extends Controller
{
    private function actorIsAdmin(): bool
    {
        $actor = Auth::user();
        if (! $actor) return false;
        $actor->loadMissing('roles');
        return $actor->roles->pluck('name')->contains('admin');
    }
    public function index(Request $request): JsonResponse
    {
        $settings = RestaurantSetting::first();

        if (!$settings) {
            return $this->success([
                'restaurant' => null,
                'message' => 'No restaurant settings configured yet.',
            ]);
        }

        return $this->success([
            'restaurant' => [
                'id' => $settings->id,
                'name' => $settings->name,
                'description' => $settings->description,
                'address' => $settings->address,
                'city' => $settings->city,
                'state' => $settings->state,
                'postal_code' => $settings->postal_code,
                'country' => $settings->country,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'website' => $settings->website,
                'logo_url' => $settings->logo_url,
                'timezone' => $settings->timezone,
                'currency' => $settings->currency,
                'currency_symbol' => $settings->currency_symbol,
                'tax_id' => $settings->tax_id,
                'branch_code' => $settings->branch_code,
                'business_registration' => $settings->business_registration,
                'opening_hours' => $settings->opening_hours,
                'default_tax_rate' => (float) $settings->default_tax_rate,
                'vat_enabled' => $settings->vat_enabled,
                'vat_registered' => $settings->vat_registered,
                'vat_inclusive' => $settings->vat_inclusive,
                'default_service_charge' => (float) $settings->default_service_charge,
                'service_charge_enabled' => $settings->service_charge_enabled,
                'receipt_header' => $settings->receipt_header,
                'receipt_footer' => $settings->receipt_footer,
                'order_prefix' => $settings->order_prefix,
                'invoice_prefix' => $settings->invoice_prefix,
                'table_reservation_timeout' => $settings->table_reservation_timeout,
                'kitchen_display_timeout' => $settings->kitchen_display_timeout,
                'auto_cancel_timeout' => $settings->auto_cancel_timeout,
                'allow_negative_inventory' => $settings->allow_negative_inventory,
                'low_stock_threshold' => $settings->low_stock_threshold,
                'reservation_turnover_buffer_minutes' => (int) ($settings->reservation_turnover_buffer_minutes ?? 15),
                'created_at' => $settings->created_at?->toISOString(),
                'updated_at' => $settings->updated_at?->toISOString(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if (! $this->actorIsAdmin()) {
            return $this->error('Forbidden: Insufficient permissions', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'address' => 'nullable|string|max:1000',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:50',
            'country' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email',
            'website' => 'nullable|url|max:500',
            'logo_url' => 'nullable|string|max:500',
            'timezone' => 'nullable|string|max:100',
            'currency' => 'nullable|string|max:10',
            'currency_symbol' => 'nullable|string|max:10',
            'tax_id' => 'nullable|string|max:100',
            'branch_code' => 'nullable|string|max:10',
            'business_registration' => 'nullable|string|max:255',
            'opening_hours' => 'nullable|array',
            'default_tax_rate' => 'nullable|numeric|min:0|max:100',
            'vat_enabled' => 'sometimes|boolean',
            'vat_registered' => 'sometimes|boolean',
            'vat_inclusive' => 'sometimes|boolean',
            'default_service_charge' => 'nullable|numeric|min:0|max:100',
            'service_charge_enabled' => 'sometimes|boolean',
            'receipt_header' => 'nullable|string|max:500',
            'receipt_footer' => 'nullable|string|max:500',
            'order_prefix' => 'nullable|string|max:20',
            'invoice_prefix' => 'nullable|string|max:20',
            'table_reservation_timeout' => 'nullable|integer|min:1',
            'kitchen_display_timeout' => 'nullable|integer|min:1',
            'auto_cancel_timeout' => 'nullable|integer|min:1',
            'allow_negative_inventory' => 'sometimes|boolean',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'reservation_turnover_buffer_minutes' => 'nullable|integer|min:0|max:120',
        ]);

        $settings = RestaurantSetting::first();

        if (!$settings) {
            $settings = RestaurantSetting::create($validated);
        } else {
            $settings->update($validated);
        }

        \App\Services\AuditLogger::record('settings_updated', $settings, [
            'description' => 'Restaurant settings updated',
            'changed' => array_keys($validated),
        ]);

        return $this->success([
            'restaurant' => [
                'id' => $settings->id,
                'name' => $settings->name,
                'description' => $settings->description,
                'address' => $settings->address,
                'city' => $settings->city,
                'state' => $settings->state,
                'postal_code' => $settings->postal_code,
                'country' => $settings->country,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'website' => $settings->website,
                'logo_url' => $settings->logo_url,
                'timezone' => $settings->timezone,
                'currency' => $settings->currency,
                'currency_symbol' => $settings->currency_symbol,
                'tax_id' => $settings->tax_id,
                'branch_code' => $settings->branch_code,
                'business_registration' => $settings->business_registration,
                'opening_hours' => $settings->opening_hours,
                'default_tax_rate' => (float) $settings->default_tax_rate,
                'vat_enabled' => $settings->vat_enabled,
                'vat_registered' => $settings->vat_registered,
                'vat_inclusive' => $settings->vat_inclusive,
                'default_service_charge' => (float) $settings->default_service_charge,
                'service_charge_enabled' => $settings->service_charge_enabled,
                'receipt_header' => $settings->receipt_header,
                'receipt_footer' => $settings->receipt_footer,
                'order_prefix' => $settings->order_prefix,
                'invoice_prefix' => $settings->invoice_prefix,
                'table_reservation_timeout' => $settings->table_reservation_timeout,
                'kitchen_display_timeout' => $settings->kitchen_display_timeout,
                'auto_cancel_timeout' => $settings->auto_cancel_timeout,
                'allow_negative_inventory' => $settings->allow_negative_inventory,
                'low_stock_threshold' => $settings->low_stock_threshold,
                'reservation_turnover_buffer_minutes' => (int) ($settings->reservation_turnover_buffer_minutes ?? 15),
                'created_at' => $settings->created_at?->toISOString(),
                'updated_at' => $settings->updated_at?->toISOString(),
            ],
        ], 'Settings updated successfully.');
    }
}
