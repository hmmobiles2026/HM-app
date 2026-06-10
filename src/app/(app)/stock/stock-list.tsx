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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Edit2, PlusCircle, AlertTriangle } from "lucide-react";
import type { Product, Brand, Category, PhoneModel } from "@/generated/prisma/client";

type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
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
  ORIGINAL:
    "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30 ring-1",
  COPY_A: "bg-blue-500/20 text-blue-300 ring-blue-500/30 ring-1",
  COPY_B: "bg-amber-500/20 text-amber-300 ring-amber-500/30 ring-1",
  OTHER: "bg-slate-500/20 text-slate-300 ring-slate-500/30 ring-1",
};

export function StockList({
  products,
  brands,
  categories,
  canEdit,
  showCosts,
}: Props) {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

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

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <Input
            placeholder="Search by name, brand, model, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <Select onValueChange={(v) => onFilterChange("brand", v as string)}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All Brands">
              {(v: string | null) => (v === "all" || !v) ? null : brands.find((b) => b.id === v)?.name ?? null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id} label={b.name}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => onFilterChange("category", v as string)}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All Categories">
              {(v: string | null) => (v === "all" || !v) ? null : categories.find((c) => c.id === v)?.name ?? null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} label={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => onFilterChange("grade", v as string)}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All Grades" />
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

      {/* Table — desktop */}
      <div className="hidden md:block rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-300 font-medium">
                Product
              </th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium">
                Grade
              </th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium">
                Category
              </th>
              <th className="text-right px-4 py-3 text-slate-300 font-medium">
                Stock
              </th>
              {showCosts && (
                <th className="text-right px-4 py-3 text-slate-300 font-medium">
                  Cost
                </th>
              )}
              <th className="text-right px-4 py-3 text-slate-300 font-medium">
                Price
              </th>
              <th className="text-right px-4 py-3 text-slate-300 font-medium w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((p) => {
              const isLow = p.stockQty <= p.lowStockThreshold;
              return (
                <tr
                  key={p.id}
                  className="bg-slate-950 hover:bg-slate-900 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-9 w-9 rounded-lg object-cover flex-shrink-0 bg-slate-800"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-slate-300 text-xs">
                            {p.brand.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">
                          {p.brand.name}
                          {p.model ? ` ${p.model.name}` : ""} — {p.name}
                        </p>
                        {p.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${gradeBadge[p.qualityGrade]}`}
                    >
                      {gradeLabel[p.qualityGrade]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.category.name}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isLow && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      <span
                        className={isLow ? "text-amber-400 font-semibold" : "text-white"}
                      >
                        {p.stockQty}
                      </span>
                    </div>
                  </td>
                  {showCosts && (
                    <td className="px-4 py-3 text-right text-slate-400">
                      {Number(p.costPrice).toLocaleString("en-LK")}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {Number(p.sellingPrice).toLocaleString("en-LK")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <Link
                            href={`/stock/${p.id}`}
                            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 w-7 p-0 text-slate-400 hover:text-white")}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/stock/${p.id}?tab=stock-in`}
                            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 w-7 p-0 text-slate-400 hover:text-emerald-400")}
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-slate-300 bg-slate-950">
            No products found
          </div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-2">
        {filtered.map((p) => {
          const isLow = p.stockQty <= p.lowStockThreshold;
          return (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {p.brand.name}
                    {p.model ? ` ${p.model.name}` : ""} — {p.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${gradeBadge[p.qualityGrade]}`}
                    >
                      {gradeLabel[p.qualityGrade]}
                    </span>
                    <span className="text-xs text-slate-300">
                      {p.category.name}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-sm font-bold ${isLow ? "text-amber-400" : "text-white"}`}
                  >
                    {p.stockQty} pcs
                  </p>
                  <p className="text-xs text-blue-400">
                    LKR {Number(p.sellingPrice).toLocaleString("en-LK")}
                  </p>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-800">
                  <Link
                    href={`/stock/${p.id}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 h-7 text-xs border-slate-700 text-slate-300")}
                  >Edit</Link>
                  <Link
                    href={`/stock/${p.id}?tab=stock-in`}
                    className={cn(buttonVariants({ size: "sm" }), "flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-500")}
                  >+ Stock</Link>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-300 py-12">No products found</p>
        )}
      </div>
    </div>
  );
}
