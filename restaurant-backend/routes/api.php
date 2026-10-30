<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    require __DIR__ . '/api/auth.php';
    require __DIR__ . '/api/dashboard.php';
    require __DIR__ . '/api/customers.php';
    require __DIR__ . '/api/tables.php';
    require __DIR__ . '/api/reservations.php';
    require __DIR__ . '/api/notifications.php';
    require __DIR__ . '/api/menu.php';
    require __DIR__ . '/api/orders.php';
    require __DIR__ . '/api/kot.php';
    require __DIR__ . '/api/pos.php';
    require __DIR__ . '/api/inventory.php';
    require __DIR__ . '/api/staff.php';
    require __DIR__ . '/api/admin.php';
    require __DIR__ . '/api/reports.php';
    require __DIR__ . '/api/analytics.php';
    require __DIR__ . '/api/integration.php';
});
