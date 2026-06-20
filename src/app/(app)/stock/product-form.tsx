"use client";

import { useActionState, useState, useRef } from "react";
import { createProduct, updateProduct } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ImagePlus, X } from "lucide-react";
import type {
  Brand,
  Category,
  PhoneModel,
  PartBrand,
  Supplier,
  Product,
  QualityGrade,
} from "@/generated/prisma/client";

type BrandWithModels = Brand & { models: PhoneModel[] };
type CategoryWithPartBrands = Category & { partBrands: PartBrand[] };
type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
  partBrand: PartBrand | null;
  supplier: Supplier | null;
};

type Props = {
  brands: BrandWithModels[];
  categories: CategoryWithPartBrands[];
  suppliers: Supplier[];
  product?: ProductWithRelations;
  showCosts?: boolean;
};

export function ProductForm({ brands, categories, suppliers, product, showCosts = true }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState(product?.brandId ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(product?.categoryId ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction, pending] = useActionState(action, undefined);

  const brandItems = brands.map((b) => ({ id: b.id, label: b.name }));
  const modelItems =
    brands.find((b) => b.id === selectedBrandId)?.models.map((m) => ({ id: m.id, label: m.name })) ?? [];
  const categoryItems = categories.map((c) => ({ id: c.id, label: c.name }));
  const partBrandItems =
    categories.find((c) => c.id === selectedCategoryId)?.partBrands.map((pb) => ({ id: pb.id, label: pb.name })) ?? [];

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setPreviewUrl(null); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displayImage = previewUrl ?? product?.imageUrl ?? null;

  return (
    <form action={formAction} className="mt-4 space-y-5">

      {/* Brand + Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">Brand <span className="text-red-400">*</span></Label>
          <Combobox
            name="brandId"
            items={brandItems}
            defaultValue={product?.brandId ?? ""}
            onChange={(id) => setSelectedBrandId(id)}
            placeholder="Search brand…"
          />
          {state?.errors?.brandId && (
            <p className="text-xs text-red-400">{state.errors.brandId[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">Model <span className="text-slate-400 font-normal">(optional)</span></Label>
          <Combobox
            key={selectedBrandId}
            name="modelId"
            items={modelItems}
            defaultValue={product?.modelId ?? ""}
            placeholder={selectedBrandId ? "Search model…" : "Select brand first"}
            disabled={!selectedBrandId}
          />
        </div>
      </div>

      {/* Category + Grade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">Category <span className="text-red-400">*</span></Label>
          <Combobox
            name="categoryId"
            items={categoryItems}
            defaultValue={product?.categoryId ?? ""}
            onChange={(id) => setSelectedCategoryId(id)}
            placeholder="Search category…"
          />
          {state?.errors?.categoryId && (
            <p className="text-xs text-red-400">{state.errors.categoryId[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">Quality Grade <span className="text-red-400">*</span></Label>
          <Select
            name="qualityGrade"
            defaultValue={(product?.qualityGrade as QualityGrade) ?? "ORIGINAL"}
          >
            <SelectTrigger className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 rounded-xl">
              <SelectItem value="ORIGINAL" className="text-slate-100 focus:bg-slate-700 focus:text-white">Original</SelectItem>
              <SelectItem value="COPY_A" className="text-slate-100 focus:bg-slate-700 focus:text-white">Copy A</SelectItem>
              <SelectItem value="COPY_B" className="text-slate-100 focus:bg-slate-700 focus:text-white">Copy B</SelectItem>
              <SelectItem value="OTHER" className="text-slate-100 focus:bg-slate-700 focus:text-white">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Part Brand */}
      {partBrandItems.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">
            Part Brand <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Combobox
            key={selectedCategoryId}
            name="partBrandId"
            items={partBrandItems}
            defaultValue={product?.partBrandId ?? ""}
            placeholder="Search part brand…"
          />
        </div>
      )}

      {/* Supplier */}
      {suppliers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm font-medium">
            Supplier <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <select
            name="supplierId"
            defaultValue={product?.supplierId ?? ""}
            className="w-full h-11 bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-3"
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Part Name */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Part Name <span className="text-red-400">*</span></Label>
        <Input
          name="name"
          defaultValue={product?.name}
          placeholder="e.g. Display, Battery, Power Flex…"
          required
          className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <Input
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Short description"
          className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">
          Tags <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <Input
          name="tags"
          defaultValue={product?.tags?.join(", ")}
          placeholder="amoled, oled, flex — comma separated"
          className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
        />
        <p className="text-xs text-slate-400">Separate multiple tags with commas</p>
      </div>

      {/* Prices */}
      {showCosts && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Cost Price <span className="text-slate-400 font-normal text-xs">(LKR)</span> <span className="text-red-400">*</span></Label>
            <Input
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product ? Number(product.costPrice) : ""}
              placeholder="0"
              required
              className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
            />
            {state?.errors?.costPrice && (
              <p className="text-xs text-red-400">{state.errors.costPrice[0]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Selling Price <span className="text-slate-400 font-normal text-xs">(LKR)</span> <span className="text-red-400">*</span></Label>
            <Input
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product ? Number(product.sellingPrice) : ""}
              placeholder="0"
              required
              className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
            />
            {state?.errors?.sellingPrice && (
              <p className="text-xs text-red-400">{state.errors.sellingPrice[0]}</p>
            )}
          </div>
        </div>
      )}

      {/* Stock + Threshold */}
      <div className="grid grid-cols-2 gap-4">
        {!product && (
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Initial Stock <span className="text-red-400">*</span></Label>
            <Input
              name="stockQty"
              type="number"
              min="0"
              defaultValue="0"
              required
              className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl"
            />
          </div>
        )}
        <div className={`space-y-1.5 ${!product ? "" : "col-span-2 sm:col-span-1"}`}>
          <Label className="text-slate-300 text-sm font-medium">Low Stock Alert <span className="text-red-400">*</span></Label>
          <Input
            name="lowStockThreshold"
            type="number"
            min="0"
            defaultValue={product?.lowStockThreshold ?? 5}
            required
            className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl"
          />
          <p className="text-xs text-slate-400">Alert when stock falls to this level</p>
        </div>
      </div>

      {/* Image upload */}
      <div className="space-y-2">
        <Label className="text-slate-300 text-sm font-medium">
          Product Image <span className="text-slate-400 font-normal">(optional)</span>
        </Label>

        <input
          ref={fileInputRef}
          name="image"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
          onChange={onFileChange}
          className="sr-only"
          id="product-image-input"
        />

        {displayImage ? (
          /* Image preview */
          <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImage}
              alt="Product"
              className="w-full max-h-52 object-contain bg-slate-950"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 bg-slate-800/90 backdrop-blur text-xs text-white rounded-lg border border-slate-600 hover:bg-slate-700 active:bg-slate-600 transition-colors"
              >
                Change
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="h-8 w-8 flex items-center justify-center bg-slate-800/90 backdrop-blur rounded-lg border border-slate-600 text-slate-300 hover:text-red-400 hover:bg-red-950/80 active:bg-red-950 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {previewUrl && (
              <div className="absolute bottom-2 left-2">
                <span className="text-xs bg-blue-600/90 backdrop-blur text-white px-2 py-1 rounded-lg font-medium">
                  New image selected
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Upload zone — large touch target */
          <label
            htmlFor="product-image-input"
            className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 cursor-pointer hover:border-slate-500 active:border-blue-500 active:bg-slate-800 transition-colors"
          >
            <ImagePlus className="h-8 w-8 text-slate-500 mb-2" />
            <span className="text-sm font-medium text-slate-400">Tap to add photo</span>
            <span className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP, AVIF · max 5 MB</span>
          </label>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      <div className="pt-1 pb-4">
        <Button
          type="submit"
          disabled={pending}
          className="h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 w-full sm:w-auto min-w-32 rounded-xl font-semibold text-base"
        >
          {pending
            ? product ? "Saving…" : "Creating…"
            : product ? "Save Changes" : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
