<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('staff_notifications')) {
            return;
        }

        Schema::create('staff_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('type', 30)->default('info');
            $table->string('icon', 30)->default('info');
            $table->string('title', 180);
            $table->text('description');
            $table->string('action_label', 80)->nullable();
            $table->string('action_url', 500)->nullable();
            $table->string('related_type', 120)->nullable();
            $table->uuid('related_id')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'read_at']);
            $table->index(['related_type', 'related_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_notifications');
    }
};
