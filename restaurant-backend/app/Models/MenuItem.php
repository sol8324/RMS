<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends BaseModel
{
    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'description',
        'price',
        'cost_price',
        'image_url',
        'image_data',
        'image_mime_type',
        'sku',
        'is_available',
        'is_featured',
        'prep_time_minutes',
        'tags',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'prep_time_minutes' => 'integer',
        'tags' => 'array',
    ];

    public function getTable(): string
    {
        return 'menu_items';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MenuCategory::class);
    }

    public function modifiers(): BelongsToMany
    {
        return $this->belongsToMany(MenuModifier::class, 'menu_item_modifiers', 'menu_item_id', 'modifier_id');
    }

    public function recipes(): HasMany
    {
        return $this->hasMany(Recipe::class);
    }

    /**
     * Get the image as a base64 data URI for display.
     */
    public function getImageDataUriAttribute(): ?string
    {
        if ($this->image_data && $this->image_mime_type) {
            return "data:{$this->image_mime_type};base64,{$this->image_data}";
        }
        return null;
    }

    /**
     * Get the effective image URL (base64 data URI takes priority over image_url).
     */
    public function getEffectiveImageUrlAttribute(): ?string
    {
        return $this->image_data_uri ?? $this->image_url;
    }
}