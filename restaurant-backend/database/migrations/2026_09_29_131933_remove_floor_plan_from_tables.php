<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            $table->dropForeign(['floor_plan_id']);
            $table->dropColumn('floor_plan_id');
        });

        Schema::dropIfExists('floor_plans');
    }

    public function down(): void
    {
        Schema::create('floor_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('tables', function (Blueprint $table) {
            $table->uuid('floor_plan_id')->nullable();

            $table->foreign('floor_plan_id')
                ->references('id')
                ->on('floor_plans')
                ->cascadeOnDelete();
        });
    }
};
