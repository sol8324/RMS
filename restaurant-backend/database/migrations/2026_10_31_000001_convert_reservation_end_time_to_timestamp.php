<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            $column = DB::selectOne(
                "SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'reservations' AND column_name = 'end_time'"
            );

            if ($column && $column->data_type === 'time without time zone') {
                DB::statement("ALTER TABLE reservations ALTER COLUMN end_time TYPE timestamp USING CASE WHEN end_time < reservation_time THEN reservation_date + interval '1 day' + end_time ELSE reservation_date + end_time END");
            }

            DB::statement("UPDATE reservations SET end_time = (reservation_date + reservation_time::time) + (COALESCE(duration_minutes, 180) || ' minutes')::interval");
        } elseif ($driver === 'sqlite') {
            $columns = DB::select("PRAGMA table_info(reservations)");
            $endTimeColumn = null;
            foreach ($columns as $column) {
                if ($column->name === 'end_time') {
                    $endTimeColumn = $column;
                    break;
                }
            }

            if ($endTimeColumn && stripos($endTimeColumn->type, 'timestamp') === false) {
                DB::statement('ALTER TABLE reservations RENAME COLUMN end_time TO end_time_old');
                Schema::table('reservations', function (Blueprint $table) {
                    $table->timestamp('end_time')->nullable();
                });
                DB::statement("UPDATE reservations SET end_time = datetime(reservation_date || ' ' || end_time_old, '+' || COALESCE(duration_minutes, 180) || ' minutes')");
                DB::statement('ALTER TABLE reservations DROP COLUMN end_time_old');
            } else {
                DB::statement("UPDATE reservations SET end_time = datetime(reservation_date || ' ' || reservation_time, '+' || COALESCE(duration_minutes, 180) || ' minutes')");
            }
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            $column = DB::selectOne(
                "SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'reservations' AND column_name = 'end_time'"
            );

            if ($column && $column->data_type === 'timestamp without time zone') {
                DB::statement("ALTER TABLE reservations ALTER COLUMN end_time TYPE time USING end_time::time");
            }
        } elseif ($driver === 'sqlite') {
            $columns = DB::select("PRAGMA table_info(reservations)");
            $endTimeColumn = null;
            foreach ($columns as $column) {
                if ($column->name === 'end_time') {
                    $endTimeColumn = $column;
                    break;
                }
            }

            if ($endTimeColumn && stripos($endTimeColumn->type, 'timestamp') !== false) {
                DB::statement('ALTER TABLE reservations RENAME COLUMN end_time TO end_time_old');
                Schema::table('reservations', function (Blueprint $table) {
                    $table->time('end_time')->nullable();
                });
                DB::statement("UPDATE reservations SET end_time = time(end_time_old)");
                DB::statement('ALTER TABLE reservations DROP COLUMN end_time_old');
            }
        }
    }
};

