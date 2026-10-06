<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reservations:send-reminders', function () {
    $this->call('reservations:send-reminders');
})->purpose('Send 24h and 2h reservation reminders');

Artisan::command('reservations:process-no-shows', function () {
    $this->call('reservations:process-no-shows');
})->purpose('Process no-show reservations after cancellation window');
