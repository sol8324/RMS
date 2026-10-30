<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            if (!Schema::hasColumn('tables', 'location')) {
                $table->string('location', 100)->nullable();
            }
            if (!Schema::hasColumn('tables', 'location_description')) {
                $table->string('location_description', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            if (Schema::hasColumn('tables', 'location_description')) {
                $table->dropColumn('location_description');
            }
            if (Schema::hasColumn('tables', 'location')) {
                $table->dropColumn('location');
            }
        });
    }
};
