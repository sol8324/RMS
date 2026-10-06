<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->boolean('card_required')->default(false)->after('event_type');
            $table->boolean('deposit_required')->default(false)->after('card_required');
            $table->decimal('deposit_amount', 10, 2)->nullable()->after('deposit_required');
            $table->boolean('deposit_paid')->default(false)->after('deposit_amount');
            $table->boolean('card_on_file')->default(false)->after('deposit_paid');
            $table->integer('reserved_party_size')->nullable()->after('party_size');
            $table->integer('actual_party_size')->nullable()->after('reserved_party_size');
            $table->integer('duration_minutes')->default(180)->after('reservation_time');
            $table->time('end_time')->nullable()->after('duration_minutes');
            $table->boolean('reminder_24h_sent')->default(false)->after('end_time');
            $table->boolean('reminder_2h_sent')->default(false)->after('reminder_24h_sent');
            $table->integer('no_show_counter')->default(0)->after('cancellation_reason');
            $table->integer('partial_show_counter')->default(0)->after('no_show_counter');
            $table->integer('guest_flag_level')->default(0)->after('partial_show_counter');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'card_required', 'deposit_required', 'deposit_amount', 'deposit_paid',
                'card_on_file', 'reserved_party_size', 'actual_party_size',
                'duration_minutes', 'end_time', 'reminder_24h_sent', 'reminder_2h_sent',
                'no_show_counter', 'partial_show_counter', 'guest_flag_level'
            ]);
        });
    }
};