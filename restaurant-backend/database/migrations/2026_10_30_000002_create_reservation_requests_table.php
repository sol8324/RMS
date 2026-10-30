<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('reservation_requests')) {
            return;
        }

        Schema::create('reservation_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reservation_id');
            $table->string('category', 30)->default('other');
            $table->string('label', 120);
            $table->string('value', 120)->nullable();
            $table->text('details')->nullable();
            $table->string('status', 30)->default('pending');
            $table->string('priority', 20)->default('normal');
            $table->boolean('is_matched')->nullable();
            $table->uuid('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->uuid('completed_by')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('reservation_id')->references('id')->on('reservations')->cascadeOnDelete();
            $table->foreign('acknowledged_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('completed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['reservation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_requests');
    }
};
