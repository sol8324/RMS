<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_settings', function (Blueprint $table) {
            // Reservation policy settings
            $table->integer('reservation_card_threshold')->default(6)->after('low_stock_threshold');
            $table->decimal('reservation_no_show_fee', 10, 2)->default(15.00)->after('reservation_card_threshold');
            $table->integer('reservation_no_show_flag_threshold')->default(2)->after('reservation_no_show_fee');
            $table->decimal('reservation_deposit_percentage', 5, 2)->default(50.00)->after('reservation_no_show_flag_threshold');
            $table->integer('reservation_cancellation_window_minutes')->default(15)->after('reservation_deposit_percentage');
            $table->integer('reservation_regular_duration_minutes')->default(180)->after('reservation_cancellation_window_minutes');
            $table->integer('reservation_large_duration_minutes')->default(240)->after('reservation_regular_duration_minutes');
            $table->json('reservation_weekend_days')->nullable()->after('reservation_large_duration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_settings', function (Blueprint $table) {
            $table->dropColumn([
                'reservation_card_threshold',
                'reservation_no_show_fee',
                'reservation_no_show_flag_threshold',
                'reservation_deposit_percentage',
                'reservation_cancellation_window_minutes',
                'reservation_regular_duration_minutes',
                'reservation_large_duration_minutes',
                'reservation_weekend_days',
            ]);
        });
    }
};