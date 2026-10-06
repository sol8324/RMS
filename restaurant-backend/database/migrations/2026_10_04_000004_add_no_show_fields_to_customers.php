<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->integer('no_show_counter')->default(0)->after('notes');
            $table->integer('partial_show_counter')->default(0)->after('no_show_counter');
            $table->integer('guest_flag_level')->default(0)->after('partial_show_counter');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['no_show_counter', 'partial_show_counter', 'guest_flag_level']);
        });
    }
};