"use client";

import { useState, useActionState } from "react";
import { createSale } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShoppingCart, Minus } from "lucide-react";
import type { Product, Brand, PhoneModel, Category } from "@/generated/prisma/client";

type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
};

type CartItem = {
  product: ProductWithRelations;
  quantity: number;
};

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

const gradeBadgeClass: Record<string, string> = {
  ORIGINAL: "border-emerald-700 text-emerald-400",
  COPY_A: "border-blue-700 text-blue-400",
  COPY_B: "border-amber-700 text-amber-400",
  OTHER: "border-slate-700 text-slate-400",
};

export function QuickSaleForm({ products }: { products: ProductWithRelations[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);
  const [state, formAction, pending] = useActionState(createSale, undefined);

  const productItems = products.map((p) => ({
    id: p.id,
    label: `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`,
    sublabel: `${gradeLabel[p.qualityGrade]}  ·  ${p.stockQty} in stock  ·  LKR ${Number(p.sellingPrice).toLocaleString("en-LK")}`,
  }));

  function addToCart() {
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;
    const existing = cart.find((c) => c.product.id === selectedId);
    if (existing) {
      setCart(cart.map((c) => c.product.id === selectedId ? { ...c, quantity: c.quantity + qty } : c));
    } else {
      setCart([...cart, { product, quantity: qty }]);
    }
    setSelectedId("");
    setQty(1);
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((c) => c.product.id !== productId));
  }

  function updateQty(productId: string, newQty: number) {
    if (newQty < 1) return;
    setCart(cart.map((c) => c.product.id === productId ? { ...c, quantity: newQty } : c));
  }

  const total = cart.reduce((sum, c) => sum + Number(c.product.sellingPrice) * c.quantity, 0);

  return (
    <div className="mt-4 space-y-5 max-w-2xl">

      {/* Product picker */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add Product</p>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Combobox
              name="_productPicker"
              items={productItems}
              value={selectedId}
              onChange={(id) => setSelectedId(id)}
              placeholder="Search by brand, model or part name…"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md h-9">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-2 h-full text-slate-400 hover:text-white transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-7 text-center text-sm text-white font-medium">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="px-2 h-full text-slate-400 hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <Button
            type="button"
            onClick={addToCart}
            disabled={!selectedId}
            className="bg-blue-600 hover:bg-blue-500 h-9 px-3 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cart</p>

          <div className="space-y-2">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {item.product.brand.name}
                    {item.product.model ? ` ${item.product.model.name}` : ""} — {item.product.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${gradeBadgeClass[item.product.qualityGrade] ?? "border-slate-700 text-slate-400"}`}
                    >
                      {gradeLabel[item.product.qualityGrade]}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      LKR {Number(item.product.sellingPrice).toLocaleString("en-LK")} each
                    </span>
                  </div>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md">
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.quantity - 1)}
                    className="px-2 py-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-7 text-center text-sm text-white font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stockQty}
                    className="px-2 py-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <p className="text-sm font-semibold text-white w-28 text-right shrink-0">
                  LKR {(Number(item.product.sellingPrice) * item.quantity).toLocaleString("en-LK")}
                </p>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Total + complete */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-sm">Total</p>
              <p className="text-white font-bold text-xl">LKR {total.toLocaleString("en-LK")}</p>
            </div>

            <form action={formAction} className="space-y-3">
              {cart.map((item, i) => (
                <div key={item.product.id}>
                  <input type="hidden" name={`productId_${i}`} value={item.product.id} />
                  <input type="hidden" name={`quantity_${i}`} value={item.quantity} />
                </div>
              ))}
              <Input
                name="note"
                placeholder="Note (optional)"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              {state?.error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
                  {state.error}
                </p>
              )}
              <Button
                type="submit"
                disabled={pending || cart.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold h-10"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {pending ? "Processing…" : `Complete Sale — LKR ${total.toLocaleString("en-LK")}`}
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-14 text-slate-600">
          <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Add products above to start a sale</p>
        </div>
      )}
    </div>
  );
}
