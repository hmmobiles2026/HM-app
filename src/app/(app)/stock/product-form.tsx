"use client";

import { useActionState, useState } from "react";
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
import type {
  Brand,
  Category,
  PhoneModel,
  Product,
  QualityGrade,
} from "@/generated/prisma/client";

type BrandWithModels = Brand & { models: PhoneModel[] };
type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
};

type Props = {
  brands: BrandWithModels[];
  categories: Category[];
  product?: ProductWithRelations;
  showCosts?: boolean;
};

export function ProductForm({
  brands,
  categories,
  product,
  showCosts = true,
}: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState(
    product?.brandId ?? ""
  );

  const action = product
    ? updateProduct.bind(null, product.id)
    : createProduct;

  const [state, formAction, pending] = useActionState(action, undefined);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  return (
    <form action={formAction} className="space-y-4 mt-4">
      {/* Brand + Model row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-300">Brand *</Label>
          <Select
            name="brandId"
            defaultValue={product?.brandId}
            onValueChange={(v) => setSelectedBrandId(v ?? "")}
          >
            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
              <SelectValue placeholder="Select brand">
                {(v: string | null) => brands.find((b) => b.id === v)?.name ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id} label={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.errors?.brandId && (
            <p className="text-xs text-red-400">{state.errors.brandId[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300">Model (optional)</Label>
          <Select
            name="modelId"
            defaultValue={product?.modelId ?? undefined}
            disabled={!selectedBrand}
          >
            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
              <SelectValue placeholder="Select model">
                {(v: string | null) => selectedBrand?.models.find((m) => m.id === v)?.name ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {selectedBrand?.models.map((m) => (
                <SelectItem key={m.id} value={m.id} label={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category + Grade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-300">Category *</Label>
          <Select name="categoryId" defaultValue={product?.categoryId}>
            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
              <SelectValue placeholder="Select category">
                {(v: string | null) => categories.find((c) => c.id === v)?.name ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.errors?.categoryId && (
            <p className="text-xs text-red-400">
              {state.errors.categoryId[0]}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300">Quality Grade *</Label>
          <Select
            name="qualityGrade"
            defaultValue={(product?.qualityGrade as QualityGrade) ?? "ORIGINAL"}
          >
            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="ORIGINAL">Original</SelectItem>
              <SelectItem value="COPY_A">Copy A</SelectItem>
              <SelectItem value="COPY_B">Copy B</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">Part Name *</Label>
        <Input
          name="name"
          defaultValue={product?.name}
          placeholder="e.g. Display, Battery, Power Flex…"
          required
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">Description (optional)</Label>
        <Input
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Short description"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">Tags (optional)</Label>
        <Input
          name="tags"
          defaultValue={product?.tags?.join(", ")}
          placeholder="e.g. amoled, oled, flex — comma separated"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
        <p className="text-xs text-slate-500">Separate with commas</p>
      </div>

      {/* Prices */}
      {showCosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Cost Price (LKR) *</Label>
            <Input
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product ? Number(product.costPrice) : ""}
              placeholder="0.00"
              required
              className="bg-slate-900 border-slate-700 text-white"
            />
            {state?.errors?.costPrice && (
              <p className="text-xs text-red-400">
                {state.errors.costPrice[0]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Selling Price (LKR) *</Label>
            <Input
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product ? Number(product.sellingPrice) : ""}
              placeholder="0.00"
              required
              className="bg-slate-900 border-slate-700 text-white"
            />
            {state?.errors?.sellingPrice && (
              <p className="text-xs text-red-400">
                {state.errors.sellingPrice[0]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stock + Threshold */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!product && (
          <div className="space-y-1.5">
            <Label className="text-slate-300">Initial Stock Qty *</Label>
            <Input
              name="stockQty"
              type="number"
              min="0"
              defaultValue="0"
              required
              className="bg-slate-900 border-slate-700 text-white"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-slate-300">Low Stock Alert Threshold *</Label>
          <Input
            name="lowStockThreshold"
            type="number"
            min="0"
            defaultValue={product?.lowStockThreshold ?? 5}
            required
            className="bg-slate-900 border-slate-700 text-white"
          />
          <p className="text-xs text-slate-500">
            Alert when stock drops at or below this number
          </p>
        </div>
      </div>

      {/* Image */}
      <div className="space-y-1.5">
        <Label className="text-slate-300">Product Image (optional)</Label>
        {product?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt="Current"
            className="h-20 w-20 rounded-lg object-cover bg-slate-800 mb-2"
          />
        )}
        <Input
          name="image"
          type="file"
          accept="image/*"
          className="bg-slate-900 border-slate-700 text-white file:bg-slate-800 file:text-slate-300 file:border-0 file:rounded file:mr-2"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="bg-blue-600 hover:bg-blue-500 w-full sm:w-auto"
      >
        {pending
          ? product
            ? "Saving…"
            : "Creating…"
          : product
            ? "Save Changes"
            : "Create Product"}
      </Button>
    </form>
  );
}
