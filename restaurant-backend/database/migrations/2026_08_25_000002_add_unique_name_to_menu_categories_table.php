<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Enforces unique menu category names.
 *
 * Safety notes:
 * - Never deletes rows. If duplicate names exist (possible on production
 *   data), newer duplicates are renamed with a numeric suffix first so the
 *   unique index creation cannot fail and no referenced category is lost.
 * - Idempotent: skips when the index already exists.
 * - Compatible with SQLite (dev/tests) and PostgreSQL (production).
 */
return new class extends Migration
{
    private const INDEX = 'menu_categories_name_unique';

    public function up(): void
    {
        if (! Schema::hasTable('menu_categories') || Schema::hasIndex('menu_categories', self::INDEX)) {
            return;
        }

        // Defensively de-duplicate names WITHOUT deleting anything.
        // We do not use MIN(id) because PostgreSQL does not support MIN()
        // directly on UUID columns.
        $duplicates = DB::table('menu_categories')
            ->select('name')
            ->groupBy('name')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $rows = DB::table('menu_categories')
                ->where('name', $duplicate->name)
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id']);

            // Keep the first row unchanged; rename the remaining duplicates.
            foreach ($rows->skip(1)->values() as $index => $row) {
                DB::table('menu_categories')
                    ->where('id', $row->id)
                    ->update([
                        'name' => $duplicate->name . ' (' . ($index + 2) . ')',
                    ]);
            }
        }

        Schema::table('menu_categories', function (Blueprint $table) {
            $table->unique('name', self::INDEX);
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('menu_categories') && Schema::hasIndex('menu_categories', self::INDEX)) {
            Schema::table('menu_categories', function (Blueprint $table) {
                $table->dropUnique(self::INDEX);
            });
        }
    }
};