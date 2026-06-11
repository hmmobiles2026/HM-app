"use client";

import { useState, useActionState } from "react";
import { addStockBulk } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, PackagePlus, Minus } from "lucide-react";
import type { Product, Brand, PhoneModel } from "@/generated/prisma/client";

type ProductRow = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
};

type RestockItem = { product: ProductRow; quantity: number };

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

const gradeBadge: Record<string, string> = {
  ORIGINAL: "bg-emerald-500/20 text-emerald-300",
  COPY_A: "bg-blue-500/20 text-blue-300",
  COPY_B: "bg-amber-500/20 text-amber-300",
  OTHER: "bg-slate-500/20 text-slate-300",
};

export function BulkStockInForm({ products }: { products: ProductRow[] }) {
  const [list, setList] = useState<RestockItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, formAction, pending] = useActionState(addStockBulk, undefined);

  const productItems = products.map((p) => ({
    id: p.id,
    label: `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`,
    sublabel: `${gradeLabel[p.qualityGrade]}  ·  ${p.stockQty} in stock`,
  }));

  function addToList() {
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;
    const existing = list.find((r) => r.product.id === selectedId);
    if (existing) {
      setList(list.map((r) =>
        r.product.id === selectedId ? { ...r, quantity: r.quantity + 1 } : r
      ));
    } else {
      setList([...list, { product, quantity: 1 }]);
    }
    setSelectedId("");
  }

  function remove(id: string) {
    setList(list.filter((r) => r.product.id !== id));
  }

  function updateQty(id: string, n: number) {
    if (n < 1) return;
    setList(list.map((r) => r.product.id === id ? { ...r, quantity: n } : r));
  }

  const totalUnits = list.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="mt-4 space-y-4">
      {/* Product picker */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="text-slate-300 text-sm">Product</Label>
          <Combobox
            name="_product_select"
            items={productItems}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Search product…"
          />
        </div>
        <Button
          type="button"
          onClick={addToList}
          disabled={!selectedId}
          className="h-11 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Restock list */}
      {list.length > 0 ? (
        <form action={formAction} className="space-y-4">
          {list.map((item, i) => (
            <div
              key={item.product.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              {/* Hidden inputs */}
              <input type="hidden" name={`product_${i}`} value={item.product.id} />
              <input type="hidden" name={`qty_${i}`} value={item.quantity} />

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {item.product.brand.name}
                  {item.product.model ? ` ${item.product.model.name}` : ""} — {item.product.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${gradeBadge[item.product.qualityGrade]}`}>
                    {gradeLabel[item.product.qualityGrade]}
                  </span>
                  <span className="text-xs text-slate-500">{item.product.stockQty} in stock now</span>
                </div>
              </div>

              {/* Qty stepper */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => updateQty(item.product.id, item.quantity - 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                  className="h-8 w-16 text-center bg-slate-800 border-slate-700 text-white rounded-lg text-sm tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => updateQty(item.product.id, item.quantity + 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => remove(item.product.id)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Note + submit */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Note (optional)</Label>
            <Input
              name="note"
              placeholder="e.g. Restocked from supplier ABC"
              className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-slate-400">
              {list.length} product{list.length > 1 ? "s" : ""} · {totalUnits} unit{totalUnits > 1 ? "s" : ""} total
            </p>
            <Button
              type="submit"
              disabled={pending}
              className="h-12 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl font-semibold text-base"
            >
              <PackagePlus className="h-5 w-5 mr-2" />
              {pending ? "Adding…" : "Confirm Stock In"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center py-16 text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl border-dashed">
          <PackagePlus className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Search and add products above</p>
        </div>
      )}
    </div>
  );
}
