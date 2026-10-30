<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('restaurant_settings', 'reservation_turnover_buffer_minutes')) {
            return;
        }

        Schema::table('restaurant_settings', function (Blueprint $table) {
            $table->integer('reservation_turnover_buffer_minutes')
                ->default(15)
                ->after('reservation_large_duration_minutes');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('restaurant_settings', 'reservation_turnover_buffer_minutes')) {
            Schema::table('restaurant_settings', function (Blueprint $table) {
                $table->dropColumn('reservation_turnover_buffer_minutes');
            });
        }
    }
};
