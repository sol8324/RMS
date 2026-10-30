<?php

require 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Table;

$tables = Table::where('is_active', true)->whereIn('status', ['available', 'occupied'])->orderBy('number')->get();
echo "API Response:\n";
echo json_encode($tables->toArray(), JSON_PRETTY_PRINT) . "\n";