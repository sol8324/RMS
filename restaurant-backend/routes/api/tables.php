<?php

use App\Http\Controllers\Api\V1\Table\FloorPlanController;
use App\Http\Controllers\Api\V1\Table\TableController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum','active'])->group(function () {
    Route::prefix('floor-plans')->group(function () {
        Route::get('/', [FloorPlanController::class, 'index']);
        Route::post('/', [FloorPlanController::class, 'store'])->middleware('role:admin,manager');
        Route::get('/{id}', [FloorPlanController::class, 'show'])->whereUuid('id');
        Route::put('/{id}', [FloorPlanController::class, 'update'])->middleware('role:admin,manager')->whereUuid('id');
        Route::delete('/{id}', [FloorPlanController::class, 'destroy'])->middleware('role:admin,manager')->whereUuid('id');
    });

    Route::prefix('tables')->group(function () {
        Route::get('/', [TableController::class, 'index']);
        // Literal segment must be registered BEFORE /{id} so it is not shadowed.
        Route::get('/available', [TableController::class, 'available']);
        Route::get('/order-eligible', [TableController::class, 'orderEligible']);
        Route::post('/', [TableController::class, 'store'])->middleware('role:admin,manager,waiter');
        Route::get('/{id}/schedule', [TableController::class, 'schedule'])->whereUuid('id');
        Route::get('/{id}', [TableController::class, 'show'])->whereUuid('id');
        Route::put('/{id}', [TableController::class, 'update'])->middleware('role:admin,manager')->whereUuid('id');
        Route::patch('/{id}/status', [TableController::class, 'updateStatus'])->middleware('role:admin,manager,waiter')->whereUuid('id');
        // Archive (is_active=false) instead of destructive delete — historical
        // orders/reservations keep their table reference.
        Route::delete('/{id}/archive', [TableController::class, 'archive'])->middleware('role:admin,manager')->whereUuid('id');
        Route::patch('/{id}/restore', [TableController::class, 'unarchive'])->middleware('role:admin,manager')->whereUuid('id');
        Route::post('/merge', [TableController::class, 'merge'])->middleware('role:admin,manager');
        Route::post('/split', [TableController::class, 'split'])->middleware('role:admin,manager');
        Route::post('/transfer', [TableController::class, 'transfer'])->middleware('role:admin,manager,waiter');
    });
});
