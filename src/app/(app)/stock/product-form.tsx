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
import { Combobox } from "@/components/ui/combobox";
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

export function ProductForm({ brands, categories, product, showCosts = true }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState(product?.brandId ?? "");

  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction, pending] = useActionState(action, undefined);

  const brandItems = brands.map((b) => ({ id: b.id, label: b.name }));
  const modelItems =
    brands.find((b) => b.id === selectedBrandId)?.models.map((m) => ({ id: m.id, label: m.name })) ?? [];
  const categoryItems = categories.map((c) => ({ id: c.id, label: c.name }));

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
          <Label className="text-slate-300 text-sm font-medium">Model <span className="text-slate-500 font-normal">(optional)</span></Label>
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
            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="ORIGINAL" className="text-slate-100 focus:bg-slate-700 focus:text-white">Original</SelectItem>
              <SelectItem value="COPY_A" className="text-slate-100 focus:bg-slate-700 focus:text-white">Copy A</SelectItem>
              <SelectItem value="COPY_B" className="text-slate-100 focus:bg-slate-700 focus:text-white">Copy B</SelectItem>
              <SelectItem value="OTHER" className="text-slate-100 focus:bg-slate-700 focus:text-white">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Part Name */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">Part Name <span className="text-red-400">*</span></Label>
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
        <Label className="text-slate-300 text-sm font-medium">
          Description <span className="text-slate-500 font-normal">(optional)</span>
        </Label>
        <Input
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Short description"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">
          Tags <span className="text-slate-500 font-normal">(optional)</span>
        </Label>
        <Input
          name="tags"
          defaultValue={product?.tags?.join(", ")}
          placeholder="amoled, oled, flex — comma separated"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
        <p className="text-xs text-slate-500">Separate multiple tags with commas</p>
      </div>

      {/* Prices */}
      {showCosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Cost Price (LKR) <span className="text-red-400">*</span></Label>
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
              <p className="text-xs text-red-400">{state.errors.costPrice[0]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Selling Price (LKR) <span className="text-red-400">*</span></Label>
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
              <p className="text-xs text-red-400">{state.errors.sellingPrice[0]}</p>
            )}
          </div>
        </div>
      )}

      {/* Stock + Threshold */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!product && (
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">Initial Stock Qty <span className="text-red-400">*</span></Label>
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
          <Label className="text-slate-300 text-sm font-medium">Low Stock Threshold <span className="text-red-400">*</span></Label>
          <Input
            name="lowStockThreshold"
            type="number"
            min="0"
            defaultValue={product?.lowStockThreshold ?? 5}
            required
            className="bg-slate-900 border-slate-700 text-white"
          />
          <p className="text-xs text-slate-500">Alert when stock falls to this level</p>
        </div>
      </div>

      {/* Image */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm font-medium">
          Product Image <span className="text-slate-500 font-normal">(optional)</span>
        </Label>
        {product?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt="Current"
            className="h-20 w-20 rounded-lg object-cover bg-slate-800 mb-2 ring-1 ring-slate-700"
          />
        )}
        <Input
          name="image"
          type="file"
          accept="image/*"
          className="bg-slate-900 border-slate-700 text-white file:bg-slate-700 file:text-slate-200 file:border-0 file:rounded file:mr-3 file:px-2 file:py-1 file:text-xs"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="pt-1">
        <Button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-500 w-full sm:w-auto min-w-32"
        >
          {pending
            ? product ? "Saving…" : "Creating…"
            : product ? "Save Changes" : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
