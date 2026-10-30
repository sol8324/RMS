<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('booking_scope', 20)->default('standard')->after('event_type');
        });

        DB::table('reservations')
            ->whereNotNull('event_type')
            ->where('duration_minutes', '>=', 480)
            ->update(['booking_scope' => 'whole_day']);

        DB::table('reservations')
            ->whereNotNull('event_type')
            ->where('duration_minutes', '>=', 240)
            ->where('duration_minutes', '<', 480)
            ->update(['booking_scope' => 'half_day']);
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('booking_scope');
        });
    }
};
