<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Table;

use App\Http\Controllers\Controller;
use App\Models\FloorPlan;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FloorPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FloorPlan::withCount('tables');

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $floorPlans = $query->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        $data = $floorPlans->map(fn (FloorPlan $fp) => [
            'id' => $fp->id,
            'name' => $fp->name,
            'description' => $fp->description,
            'sort_order' => $fp->sort_order,
            'is_active' => $fp->is_active,
            'tables_count' => $fp->tables_count,
            'created_at' => $fp->created_at?->toISOString(),
            'updated_at' => $fp->updated_at?->toISOString(),
        ]);

        return $this->success(['items' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'sort_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $floorPlan = FloorPlan::create($validated);

        return $this->created([
            'id' => $floorPlan->id,
            'name' => $floorPlan->name,
            'description' => $floorPlan->description,
            'sort_order' => $floorPlan->sort_order,
            'is_active' => $floorPlan->is_active,
            'tables_count' => 0,
            'created_at' => $floorPlan->created_at?->toISOString(),
            'updated_at' => $floorPlan->updated_at?->toISOString(),
        ], 'Floor plan created successfully.');
    }

    public function show(string $id): JsonResponse
    {
        $floorPlan = FloorPlan::with('tables')->withCount('tables')->find($id);

        if (!$floorPlan) {
            return $this->notFound('Floor plan not found.');
        }

        $floorPlan->setRelation('tables', Table::sortByNumber($floorPlan->tables));

        return $this->success([
            'id' => $floorPlan->id,
            'name' => $floorPlan->name,
            'description' => $floorPlan->description,
            'sort_order' => $floorPlan->sort_order,
            'is_active' => $floorPlan->is_active,
            'tables_count' => $floorPlan->tables_count,
            'tables' => $floorPlan->tables->map(fn ($t) => [
                'id' => $t->id,
                'number' => $t->number,
                'capacity' => $t->capacity,
                'status' => $t->status,
                'shape' => $t->shape,
                'pos_x' => (float) $t->pos_x,
                'pos_y' => (float) $t->pos_y,
                'width' => (float) $t->width,
                'height' => (float) $t->height,
                'is_active' => $t->is_active,
            ]),
            'created_at' => $floorPlan->created_at?->toISOString(),
            'updated_at' => $floorPlan->updated_at?->toISOString(),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $floorPlan = FloorPlan::find($id);

        if (!$floorPlan) {
            return $this->notFound('Floor plan not found.');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'sort_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $floorPlan->update($validated);

        return $this->success([
            'id' => $floorPlan->id,
            'name' => $floorPlan->name,
            'description' => $floorPlan->description,
            'sort_order' => $floorPlan->sort_order,
            'is_active' => $floorPlan->is_active,
            'created_at' => $floorPlan->created_at?->toISOString(),
            'updated_at' => $floorPlan->updated_at?->toISOString(),
        ], 'Floor plan updated successfully.');
    }

    public function destroy(string $id): JsonResponse
    {
        $floorPlan = FloorPlan::find($id);

        if (!$floorPlan) {
            return $this->notFound('Floor plan not found.');
        }

        if ($floorPlan->tables()->count() > 0) {
            return $this->error('Cannot delete floor plan with tables. Move or delete tables first.', 409);
        }

        $floorPlan->delete();

        return $this->noContent('Floor plan deleted successfully.');
    }
}
