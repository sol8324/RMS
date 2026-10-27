<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;

class Table extends BaseModel
{
    protected $fillable = [
        'floor_plan_id', 'number', 'capacity', 'status', 'shape',
        'pos_x', 'pos_y', 'width', 'height', 'is_active',
        'is_wheelchair_accessible',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'pos_x' => 'decimal:2',
            'pos_y' => 'decimal:2',
            'width' => 'decimal:2',
            'height' => 'decimal:2',
            'is_active' => 'boolean',
            'is_wheelchair_accessible' => 'boolean',
        ];
    }

    /**
     * Sort tables by their human-readable number using natural ordering so
     * values such as 2 and 10 (or TBL-2 and TBL-10) are not ordered as text.
     */
    public static function sortByNumber(Collection $tables, bool $capacityFirst = false): Collection
    {
        return $tables->sort(static function (self $a, self $b) use ($capacityFirst): int {
            if ($capacityFirst && ($capacityOrder = $a->capacity <=> $b->capacity) !== 0) {
                return $capacityOrder;
            }

            $numberOrder = strnatcasecmp((string) $a->number, (string) $b->number);

            return $numberOrder !== 0
                ? $numberOrder
                : $a->capacity <=> $b->capacity;
        })->values();
    }

    public function getTable(): string
    {
        return 'tables';
    }

    public function floorPlan()
    {
        return $this->belongsTo(FloorPlan::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
