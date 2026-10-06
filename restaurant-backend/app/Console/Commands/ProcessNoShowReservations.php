<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use App\Models\Customer;
use App\Models\Table;
use App\Models\RestaurantSetting;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ProcessNoShowReservations extends Command
{
    protected $signature = 'reservations:process-no-shows';
    protected $description = 'Process no-show reservations after cancellation window';

    public function handle(): int
    {
        $settings = RestaurantSetting::first();
        if (!$settings) {
            $this->error('No restaurant settings found.');
            return 1;
        }

        $timezone = $settings->timezone ?? 'UTC';
        $cancellationWindow = $settings->reservation_cancellation_window_minutes ?? 15;
        $noShowFee = $settings->reservation_no_show_fee ?? 15.00;
        $flagThreshold = $settings->reservation_no_show_flag_threshold ?? 2;
        $depositPercentage = $settings->reservation_deposit_percentage ?? 50.00;

        $now = Carbon::now($timezone);
        $cutoffTime = $now->copy()->subMinutes($cancellationWindow);

        // Find reservations that are past their time + cancellation window and still pending/confirmed
        $noShowReservations = Reservation::whereIn('status', ['pending', 'confirmed'])
            ->where(function ($query) use ($cutoffTime) {
                $query->where(function ($q) use ($cutoffTime) {
                    $q->whereDate('reservation_date', '<', $cutoffTime->toDateString());
                })->orWhere(function ($q) use ($cutoffTime) {
                    $q->whereDate('reservation_date', $cutoffTime->toDateString())
                        ->whereTime('reservation_time', '<=', $cutoffTime->format('H:i'));
                });
            })
            ->get();

        $processed = 0;

        foreach ($noShowReservations as $reservation) {
            DB::transaction(function () use ($reservation, $noShowFee, $flagThreshold, $depositPercentage, &$processed) {
                // Release table if assigned
                if ($reservation->table_id) {
                    $table = Table::lockForUpdate()->find($reservation->table_id);
                    if ($table && $table->is_active && $table->status === 'occupied') {
                        $table->update(['status' => 'needs_cleaning']);
                        AuditLogger::record('table_status_changed', $table, [
                            'description' => "Table {$table->number} released due to no-show",
                            'from' => 'occupied',
                            'to' => 'needs_cleaning',
                        ], null, ['status' => 'occupied']);
                    }
                }

                // Update reservation status
                $reservation->update([
                    'status' => 'no_show',
                    'no_show_counter' => $reservation->no_show_counter + 1,
                ]);

                // Increment customer no-show counter
                if ($reservation->customer_id) {
                    $customer = Customer::find($reservation->customer_id);
                    if ($customer) {
                        $customer->increment('no_show_counter');

                        // Check if flag level should increase
                        $newCounter = $customer->no_show_counter;
                        if ($newCounter >= $flagThreshold && $customer->guest_flag_level < 2) {
                            $customer->update(['guest_flag_level' => 2]); // Level 2: 50% deposit + card
                        } elseif ($newCounter >= 1 && $customer->guest_flag_level < 1) {
                            $customer->update(['guest_flag_level' => 1]); // Level 1: card required
                        }
                    }
                }

                // Update reservation guest flag level
                $newReservationCounter = $reservation->no_show_counter;
                if ($newReservationCounter >= $flagThreshold) {
                    $reservation->update(['guest_flag_level' => 2]);
                } elseif ($newReservationCounter >= 1) {
                    $reservation->update(['guest_flag_level' => 1]);
                }

                // Process no-show fee if card on file
                $feeCharged = 0;
                $depositForfeited = 0;

                if ($reservation->card_on_file && $reservation->card_required) {
                    $feeCharged = $reservation->reserved_party_size * $noShowFee;
                    // TODO: Integrate with payment processor to charge the card
                    AuditLogger::record('no_show_fee_charged', $reservation, [
                        'description' => "No-show fee charged: {$feeCharged} for {$reservation->reserved_party_size} people",
                        'amount' => $feeCharged,
                        'party_size' => $reservation->reserved_party_size,
                        'fee_per_person' => $noShowFee,
                    ]);
                }

                // Forfeit deposit if paid
                if ($reservation->deposit_paid && $reservation->deposit_amount > 0) {
                    $depositForfeited = $reservation->deposit_amount;
                    $reservation->update(['deposit_paid' => false, 'deposit_amount' => 0]);
                    AuditLogger::record('deposit_forfeited', $reservation, [
                        'description' => "Deposit forfeited due to no-show: {$depositForfeited}",
                        'amount' => $depositForfeited,
                    ]);
                }

                $processed++;
            });
        }

        $this->info("Processed {$processed} no-show reservations.");
        return 0;
    }
}