<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First, check for and resolve any duplicate order_id entries.
        // Keep the first invoice, soft-delete the rest.
        $duplicates = DB::table('invoices')
            ->select('order_id', DB::raw('count(*) as cnt'))
            ->groupBy('order_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('order_id');

        foreach ($duplicates as $orderId) {
            $invoices = DB::table('invoices')
                ->where('order_id', $orderId)
                ->orderBy('created_at')
                ->get();

            // Keep the first, soft-delete the rest.
            $deleteIds = $invoices->skip(1)->pluck('id');

            if ($deleteIds->isNotEmpty()) {
                DB::table('invoices')
                    ->whereIn('id', $deleteIds)
                    ->update(['deleted_at' => now()]);
            }
        }

        // Now add the unique constraint.
        Schema::table('invoices', function (Blueprint $table) {
            $table->unique('order_id');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_order_id_unique');
        });
    }
};