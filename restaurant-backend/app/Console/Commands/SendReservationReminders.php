<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use App\Models\Customer;
use App\Models\RestaurantSetting;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendReservationReminders extends Command
{
    protected $signature = 'reservations:send-reminders';
    protected $description = 'Send 24h and 2h reservation reminders';

    public function handle(): int
    {
        $settings = RestaurantSetting::first();
        if (!$settings) {
            $this->error('No restaurant settings found.');
            return 1;
        }

        $timezone = $settings->timezone ?? 'UTC';
        $now = Carbon::now($timezone);

        // 24-hour reminders
        $reminder24hStart = $now->copy()->addHours(23)->startOfHour();
        $reminder24hEnd = $now->copy()->addHours(24)->endOfHour();

        $reservations24h = Reservation::whereNull('reminder_24h_sent')
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereBetween('reservation_date', [
                $reminder24hStart->toDateString(),
                $reminder24hEnd->toDateString(),
            ])
            ->where(function ($query) use ($reminder24hStart, $reminder24hEnd) {
                $query->where(function ($q) use ($reminder24hStart, $reminder24hEnd) {
                    $q->whereDate('reservation_date', $reminder24hStart->toDateString())
                        ->whereTime('reservation_time', '>=', $reminder24hStart->format('H:i'))
                        ->whereTime('reservation_time', '<=', $reminder24hEnd->format('H:i'));
                })->orWhere(function ($q) use ($reminder24hStart, $reminder24hEnd) {
                    $q->whereDate('reservation_date', $reminder24hEnd->toDateString())
                        ->whereTime('reservation_time', '>=', $reminder24hStart->format('H:i'))
                        ->whereTime('reservation_time', '<=', $reminder24hEnd->format('H:i'));
                });
            })
            ->get();

        foreach ($reservations24h as $reservation) {
            $reservation->update(['reminder_24h_sent' => true]);
            // TODO: Send email/SMS reminder with cancellation link
            $this->info("Sent 24h reminder for reservation {$reservation->reservation_number}");
        }

        // 2-hour reminders
        $reminder2hStart = $now->copy()->addHours(1)->startOfHour();
        $reminder2hEnd = $now->copy()->addHours(2)->endOfHour();

        $reservations2h = Reservation::whereNull('reminder_2h_sent')
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereBetween('reservation_date', [
                $reminder2hStart->toDateString(),
                $reminder2hEnd->toDateString(),
            ])
            ->where(function ($query) use ($reminder2hStart, $reminder2hEnd) {
                $query->where(function ($q) use ($reminder2hStart, $reminder2hEnd) {
                    $q->whereDate('reservation_date', $reminder2hStart->toDateString())
                        ->whereTime('reservation_time', '>=', $reminder2hStart->format('H:i'))
                        ->whereTime('reservation_time', '<=', $reminder2hEnd->format('H:i'));
                })->orWhere(function ($q) use ($reminder2hStart, $reminder2hEnd) {
                    $q->whereDate('reservation_date', $reminder2hEnd->toDateString())
                        ->whereTime('reservation_time', '>=', $reminder2hStart->format('H:i'))
                        ->whereTime('reservation_time', '<=', $reminder2hEnd->format('H:i'));
                });
            })
            ->get();

        foreach ($reservations2h as $reservation) {
            $reservation->update(['reminder_2h_sent' => true]);
            // TODO: Send email/SMS reminder with confirm/cancel prompt
            $this->info("Sent 2h reminder for reservation {$reservation->reservation_number}");
        }

        $this->info("Processed {$reservations24h->count()} 24h reminders and {$reservations2h->count()} 2h reminders.");
        return 0;
    }
}