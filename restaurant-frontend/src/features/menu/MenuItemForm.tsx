"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner, MenuItemImage } from "@/components/shared";
import { MENU_ITEM_IMAGES } from "@/lib/config/menu-item-images";
import type { MenuItem, MenuItemFormData, MenuCategory } from "@/lib/types";

interface MenuItemFormProps {
  initialData?: MenuItem;
  categories: MenuCategory[];
  isCategoriesLoading?: boolean;
  onSubmit: (data: MenuItemFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

interface FormErrors {
  name?: string;
  category_id?: string;
  price?: string;
}

export function MenuItemForm({
  initialData,
  categories,
  isCategoriesLoading = false,
  onSubmit,
  isLoading,
  submitLabel = "Save Item",
}: MenuItemFormProps) {
  const [formData, setFormData] = useState<MenuItemFormData>({
    category_id: initialData?.category_id ?? "",
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    price: initialData?.price ?? 0,
    cost_price: initialData?.cost_price ?? 0,
    image_url: initialData?.image_url ?? "",
    image_data: initialData?.image_data ?? "",
    image_mime_type: initialData?.image_mime_type ?? "",
    is_available: initialData?.is_available ?? true,
    is_featured: initialData?.is_featured ?? false,
    prep_time_minutes: initialData?.prep_time_minutes ?? 0,
    tags: initialData?.tags ?? [],
    sku: initialData?.sku ?? "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!formData.name.trim()) errs.name = "Item name is required";
    if (!formData.category_id) errs.category_id = "Category is required";
    if (formData.price <= 0) errs.price = "Price must be greater than 0";
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please select a valid image file (JPEG, PNG, or WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        image_data: base64.split(",")[1], // Remove data:image/...;base64, prefix
        image_mime_type: file.type,
        image_url: "", // Clear URL when using base64
      }));
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setFormData((prev) => ({
      ...prev,
      image_data: "",
      image_mime_type: "",
      image_url: "",
    }));
    setImagePreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({ name: true, category_id: true, price: true });
    if (Object.keys(errs).length === 0) {
      onSubmit({
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        cost_price: formData.cost_price || undefined,
        image_data: formData.image_data || undefined,
        image_mime_type: formData.image_mime_type || undefined,
        image_url: formData.image_url?.trim() || undefined,
        is_featured: formData.is_featured,
        prep_time_minutes: formData.prep_time_minutes || undefined,
        tags: formData.tags?.length ? formData.tags : undefined,
        sku: formData.sku?.trim() || undefined,
      });
    }
  }

  const activeCategories = categories.filter((c) => c.is_active);
  const selectedCategory = categories.find((c) => c.id === formData.category_id);
  // Resolve the visible trigger label explicitly so the raw category UUID is
  // never user-facing: while categories load (or the referenced category is
  // missing) the Base UI Select would otherwise fall back to the raw value.
  const categoryTriggerLabel = isCategoriesLoading
    ? "Loading categories..."
    : (selectedCategory?.name ?? (formData.category_id ? "Unknown Category" : undefined));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-name">Name *</Label>
          <Input
            id="item-name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            onBlur={() => handleBlur("name")}
            placeholder="e.g. Sisig, Adobo Rice Bowl"
            aria-invalid={touched.name && !!errors.name}
          />
          {touched.name && errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Category *</Label>
          <Select
            value={formData.category_id}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, category_id: val ?? "" }))
            }
            disabled={isCategoriesLoading}
          >
            <SelectTrigger
              className="w-full"
              aria-invalid={touched.category_id && !!errors.category_id}
            >
              <SelectValue placeholder="Select category">
                {categoryTriggerLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {isCategoriesLoading ? (
                formData.category_id ? (
                  <SelectItem value={formData.category_id} disabled className="truncate">
                    Loading categories...
                  </SelectItem>
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading categories...
                  </SelectItem>
                )
              ) : (
                <>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="truncate">
                      {c.name}
                    </SelectItem>
                  ))}
                  {formData.category_id && !selectedCategory && (
                    <SelectItem value={formData.category_id} disabled className="truncate">
                      Unknown Category
                    </SelectItem>
                  )}
                  {activeCategories.length === 0 && !formData.category_id && (
                    <SelectItem value="none" disabled>
                      No categories
                    </SelectItem>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
          {touched.category_id && errors.category_id && (
            <p className="text-xs text-destructive">{errors.category_id}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-desc">Description (optional)</Label>
        <Textarea
          id="item-desc"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Brief description of the dish"
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="item-price">Price (PHP) *</Label>
          <Input
            id="item-price"
            type="number"
            min={0.01}
            step={0.01}
            value={formData.price}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                price: parseFloat(e.target.value) || 0,
              }))
            }
            onBlur={() => handleBlur("price")}
            aria-invalid={touched.price && !!errors.price}
          />
          {touched.price && errors.price && (
            <p className="text-xs text-destructive">{errors.price}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-cost">Cost Price (PHP)</Label>
          <Input
            id="item-cost"
            type="number"
            min={0}
            step={0.01}
            value={formData.cost_price || 0}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cost_price: parseFloat(e.target.value) || 0,
              }))
            }
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-prep-time">Prep Time (minutes)</Label>
          <Input
            id="item-prep-time"
            type="number"
            min={0}
            step={1}
            value={formData.prep_time_minutes || 0}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                prep_time_minutes: parseInt(e.target.value) || 0,
              }))
            }
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-sku">SKU (optional)</Label>
          <Input
            id="item-sku"
            type="text"
            value={formData.sku || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                sku: e.target.value,
              }))
            }
            placeholder="e.g. MENU-001"
            maxLength={100}
          />
        </div>

        <div className="flex items-end pb-1 sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={formData.is_available}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_available: !!checked }))
              }
            />
            <span className="text-sm">Available for order</span>
          </label>
        </div>

        <div className="flex items-end pb-1 sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={formData.is_featured}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_featured: !!checked }))
              }
            />
            <span className="text-sm">Featured item</span>
          </label>
        </div>
      </div>

      {/* Tags input */}
      <div className="space-y-2">
        <Label htmlFor="item-tags">Tags (comma-separated)</Label>
        <Input
          id="item-tags"
          type="text"
          value={formData.tags?.join(", ") || ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
            }))
          }
          placeholder="e.g. vegetarian, spicy, best-seller"
        />
        <p className="text-xs text-muted-foreground">Separate tags with commas</p>
      </div>

      {/* MENU IMAGE — file upload with base64 (works across devices) */}
      <div className="space-y-2">
        <Label>Menu Image (optional)</Label>
        <div className="flex items-start gap-3">
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt={formData.name || "Menu item preview"}
                className="h-full w-full object-cover"
              />
            ) : formData.image_url ? (
              <MenuItemImage src={formData.image_url} alt={formData.name || "Menu item preview"} sizes="112px" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <span className="text-xs">No image</span>
              </div>
            )}
            {(imagePreview || formData.image_url) && (
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                aria-label="Remove image"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              className="w-full text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              aria-label="Upload menu image"
            />
            <p className="text-xs text-muted-foreground">
              Upload an image (JPEG, PNG, WebP - max 5MB). Image is stored as base64 and works across all devices.
            </p>
            {/* Fallback: static image picker */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Or choose from preset images:</p>
              <Select
                value={formData.image_url || "none"}
                onValueChange={(val) => {
                  const path = typeof val === "string" && val !== "none" ? val : "";
                  setFormData((prev) => ({ ...prev, image_url: path, image_data: "", image_mime_type: "" }));
                  setImagePreview(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose preset image" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">No image (placeholder)</SelectItem>
                  {MENU_ITEM_IMAGES.map((img) => (
                    <SelectItem key={img.path} value={img.path}>
                      {img.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
