"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Edit2, PlusCircle, AlertTriangle, Trash2, Package } from "lucide-react";
import { deleteProduct } from "@/app/actions/stock";
import { toast } from "sonner";
import type { Product, Brand, Category, PhoneModel, PartBrand } from "@/generated/prisma/client";

type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
  partBrand: PartBrand | null;
};

type Props = {
  products: ProductWithRelations[];
  brands: Brand[];
  categories: Category[];
  canEdit: boolean;
  showCosts: boolean;
};

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

const gradeBadge: Record<string, string> = {
  ORIGINAL: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  COPY_A: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  COPY_B: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  OTHER: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30",
};

function ProductImage({ imageUrl, name, size }: { imageUrl: string | null; name: string; size: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9" : "h-14 w-14";
  const text = size === "sm" ? "text-xs" : "text-base";
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={name} className={`${dim} rounded-xl object-cover flex-shrink-0 bg-slate-800`} />
    );
  }
  return (
    <div className={`${dim} rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0`}>
      <span className={`${text} font-semibold text-slate-400`}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function StockList({ products, brands, categories, canEdit, showCosts }: Props) {
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const confirmProduct = confirmId ? products.find((p) => p.id === confirmId) : null;

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.name.toLowerCase().includes(q) ||
      (p.model?.name?.toLowerCase().includes(q) ?? false) ||
      p.category.name.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      (p.description?.toLowerCase().includes(q) ?? false)
    );
  });

  function onFilterChange(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function handleDelete() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    startDelete(async () => {
      const result = await deleteProduct(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Product moved to trash. You have 3 days to recover it."); router.refresh(); }
    });
  }

  return (
    <div className="space-y-3">
      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <DialogContent showCloseButton={false} className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete product?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {confirmProduct
                ? `${confirmProduct.brand.name}${confirmProduct.model ? ` ${confirmProduct.model.name}` : ""} — ${confirmProduct.name}`
                : ""}
            </span>{" "}
            will be moved to trash. You can recover it within 3 days.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-500 text-white" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, brand, model, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-10"
          />
        </div>
        <Select
          defaultValue="all"
          onValueChange={(v) => onFilterChange("brand", v as string)}
          items={{ all: "All Brands", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
        >
          <SelectTrigger className="w-full sm:w-36 bg-slate-900 border-slate-700 text-slate-300 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          defaultValue="all"
          onValueChange={(v) => onFilterChange("category", v as string)}
          items={{ all: "All Categories", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }}
        >
          <SelectTrigger className="w-full sm:w-36 bg-slate-900 border-slate-700 text-slate-300 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select defaultValue="all" onValueChange={(v) => onFilterChange("grade", v as string)}>
          <SelectTrigger className="w-full sm:w-32 bg-slate-900 border-slate-700 text-slate-300 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Grades</SelectItem>
            <SelectItem value="ORIGINAL">Original</SelectItem>
            <SelectItem value="COPY_A">Copy A</SelectItem>
            <SelectItem value="COPY_B">Copy B</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Product</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Grade</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Stock</th>
              {showCosts && (
                <>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Cost</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Profit</th>
                </>
              )}
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Price</th>
              {canEdit && (
                <th className="text-right px-4 py-3 text-slate-400 font-medium w-28">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => {
              const isLow = p.stockQty <= p.lowStockThreshold;
              const profit = p.sellingPrice - p.costPrice;
              const profitPct = p.costPrice > 0 ? (profit / p.costPrice) * 100 : null;
              const profitColor = profit >= 0 ? "text-emerald-400" : "text-red-400";
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${isLow ? "bg-amber-950/10 hover:bg-amber-950/20" : "bg-slate-950 hover:bg-slate-900/80"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {isLow && <div className="w-1 h-8 rounded-full bg-amber-500 -ml-1 shrink-0" />}
                      <ProductImage imageUrl={p.imageUrl} name={p.brand.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {p.brand.name}{p.model ? ` ${p.model.name}` : ""} — {p.name}
                        </p>
                        {p.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {p.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gradeBadge[p.qualityGrade]}`}>
                      {gradeLabel[p.qualityGrade]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-300 text-sm">{p.category.name}</p>
                    {p.partBrand && (
                      <p className="text-xs text-slate-500 mt-0.5">{p.partBrand.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      <span className={`font-semibold ${isLow ? "text-amber-400" : "text-white"}`}>{p.stockQty}</span>
                    </div>
                  </td>
                  {showCosts && (
                    <>
                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-400 text-xs">LKR</span>{" "}
                        <span className="text-slate-300">{Number(p.costPrice).toLocaleString("en-LK")}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${profitColor}`}>
                          {profit.toLocaleString("en-LK")}
                        </span>
                        {profitPct !== null && (
                          <span className={`text-xs ml-1.5 ${profitColor} opacity-80`}>
                            {profitPct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-slate-500">LKR</span>{" "}
                    <span className="text-white font-semibold">{Number(p.sellingPrice).toLocaleString("en-LK")}</span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/stock/${p.id}`}
                          className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800")}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/stock/${p.id}?tab=stock-in`}
                          className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 w-7 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30")}
                          title="Add stock"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setConfirmId(p.id)}
                          className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-950/30")}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-slate-500 bg-slate-950">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No products found</p>
          </div>
        )}
      </div>

      {/* ── Mobile cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {filtered.map((p) => {
          const isLow = p.stockQty <= p.lowStockThreshold;
          const profit = p.sellingPrice - p.costPrice;
          const profitPct = p.costPrice > 0 ? (profit / p.costPrice) * 100 : null;
          const profitColor = profit >= 0 ? "text-emerald-400" : "text-red-400";
          return (
            <div
              key={p.id}
              className={`border rounded-2xl overflow-hidden ${isLow ? "border-amber-800/50 bg-amber-950/10" : "border-slate-800 bg-slate-900"}`}
            >
              {isLow && <div className="h-0.5 bg-amber-500/60" />}
              <div className="p-3">
                {/* Main row: image + info + stock/price */}
                <div className="flex items-start gap-3">
                  <ProductImage imageUrl={p.imageUrl} name={p.brand.name} size="md" />

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-tight">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.brand.name}{p.model ? ` ${p.model.name}` : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${gradeBadge[p.qualityGrade]}`}>
                        {gradeLabel[p.qualityGrade]}
                      </span>
                      <span className="text-xs text-slate-500">{p.category.name}</span>
                      {p.partBrand && (
                        <span className="text-xs text-slate-600">· {p.partBrand.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`flex items-center justify-end gap-1 ${isLow ? "text-amber-400" : "text-white"}`}>
                      {isLow && <AlertTriangle className="h-3 w-3" />}
                      <span className="text-base font-bold">{p.stockQty}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-none">pcs</p>
                    <p className="text-sm font-semibold text-blue-300 mt-1">
                      {Number(p.sellingPrice).toLocaleString("en-LK")}
                    </p>
                    {showCosts && (
                      <>
                        <p className="text-xs text-slate-500">
                          Cost {Number(p.costPrice).toLocaleString("en-LK")}
                        </p>
                        <p className={`text-xs font-medium ${profitColor}`}>
                          {profit >= 0 ? "+" : ""}{profit.toLocaleString("en-LK")}
                          {profitPct !== null && (
                            <span className="opacity-80"> ({profitPct.toFixed(0)}%)</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {p.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-2.5 border-t border-slate-800/60">
                    <Link
                      href={`/stock/${p.id}`}
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 h-8 text-xs border-slate-700 text-slate-300 hover:text-white rounded-xl")}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                    <Link
                      href={`/stock/${p.id}?tab=stock-in`}
                      className={cn(buttonVariants({ size: "sm" }), "flex-1 h-8 text-xs bg-emerald-700 hover:bg-emerald-600 rounded-xl")}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Stock In
                    </Link>
                    <button
                      onClick={() => setConfirmId(p.id)}
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 w-8 p-0 border-red-900/40 text-red-400 hover:bg-red-950/40 rounded-xl shrink-0")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <Package className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
}
