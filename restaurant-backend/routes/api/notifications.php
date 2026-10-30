<?php

use App\Http\Controllers\Api\V1\NotificationController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->prefix('notifications')->group(function () {
    Route::get('/', [NotificationController::class, 'index']);
    Route::patch('/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/{id}/read', [NotificationController::class, 'markRead']);
});
