<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Re-add floor_plans table (was removed in 2026_09_29_131933_remove_floor_plan_from_tables)
        if (!Schema::hasTable('floor_plans')) {
            Schema::create('floor_plans', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->text('description')->nullable();
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // Add floor_plan_id back to tables
        if (!Schema::hasColumn('tables', 'floor_plan_id')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->uuid('floor_plan_id')->nullable()->after('id');
                
                $table->foreign('floor_plan_id')
                    ->references('id')
                    ->on('floor_plans')
                    ->cascadeOnDelete();
            });
        }

        // Add is_wheelchair_accessible column to tables if not exists
        if (!Schema::hasColumn('tables', 'is_wheelchair_accessible')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->boolean('is_wheelchair_accessible')->default(false)->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tables', 'floor_plan_id')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->dropForeign(['floor_plan_id']);
                $table->dropColumn('floor_plan_id');
            });
        }

        if (Schema::hasColumn('tables', 'is_wheelchair_accessible')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->dropColumn('is_wheelchair_accessible');
            });
        }

        if (Schema::hasTable('floor_plans')) {
            Schema::dropIfExists('floor_plans');
        }
    }
};