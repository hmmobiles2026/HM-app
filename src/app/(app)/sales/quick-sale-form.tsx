"use client";

import { useState, useActionState } from "react";
import { createSale } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, ShoppingCart, Minus } from "lucide-react";
import type { Product, Brand, PhoneModel, Category } from "@/generated/prisma/client";

type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
};

type CartItem = { product: ProductWithRelations; quantity: number };

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

  function removeFromCart(id: string) { setCart(cart.filter((c) => c.product.id !== id)); }

  function updateQty(id: string, n: number) {
    if (n < 1) return;
    setCart(cart.map((c) => c.product.id === id ? { ...c, quantity: n } : c));
  }

  const total = cart.reduce((s, c) => s + Number(c.product.sellingPrice) * c.quantity, 0);
  const selectedProduct = products.find((p) => p.id === selectedId);

  return (
    <div className="mt-4 space-y-4">

      {/* ── Product picker ───────────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Add Product</p>

        {/* Combobox — full width on all screen sizes */}
        <Combobox
          name="_productPicker"
          items={productItems}
          value={selectedId}
          onChange={(id) => setSelectedId(id)}
          placeholder="Search by brand, model or part name…"
        />

        {/* Selected product preview */}
        {selectedProduct && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl">
            {selectedProduct.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedProduct.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-slate-300">{selectedProduct.brand.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {selectedProduct.brand.name}{selectedProduct.model ? ` ${selectedProduct.model.name}` : ""} — {selectedProduct.name}
              </p>
              <p className="text-xs text-slate-400">
                LKR {Number(selectedProduct.sellingPrice).toLocaleString("en-LK")} · {selectedProduct.stockQty} in stock
              </p>
            </div>
          </div>
        )}

        {/* Qty + Add — always on own row so combobox gets full width */}
        <div className="flex items-center gap-3">
          {/* Qty stepper */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden h-11">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-4 h-full text-slate-300 hover:text-white active:bg-slate-700 transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-base text-white font-semibold select-none">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              disabled={!!(selectedProduct && qty >= selectedProduct.stockQty)}
              className="px-4 h-full text-slate-300 hover:text-white active:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Add button */}
          <Button
            type="button"
            onClick={addToCart}
            disabled={!selectedId}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-sm font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add to Cart
          </Button>
        </div>
      </div>

      {/* ── Cart ─────────────────────────────────────────────────────── */}
      {cart.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
            Cart ({cart.length} item{cart.length > 1 ? "s" : ""})
          </p>

          {cart.map((item) => (
            <div key={item.product.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
              {/* Row 1: image + name + delete */}
              <div className="flex items-center gap-2.5">
                {item.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="h-11 w-11 rounded-xl object-cover shrink-0 ring-1 ring-slate-700"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                    <span className="text-slate-300 text-sm font-bold">{item.product.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug truncate">
                    {item.product.brand.name}{item.product.model ? ` ${item.product.model.name}` : ""} — {item.product.name}
                  </p>
                  <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${gradeBadge[item.product.qualityGrade]}`}>
                    {gradeLabel[item.product.qualityGrade]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Row 2: qty stepper + subtotal */}
              <div className="flex items-center gap-3 pt-1 border-t border-slate-800">
                <span className="text-xs text-slate-400">LKR {Number(item.product.sellingPrice).toLocaleString("en-LK")} each</span>
                <div className="flex-1" />
                {/* Qty stepper */}
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.quantity - 1)}
                    className="px-3 py-2 text-slate-400 hover:text-white active:bg-slate-700 transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm text-white font-semibold select-none">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stockQty}
                    className="px-3 py-2 text-slate-400 hover:text-white active:bg-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-bold text-white tabular-nums min-w-[80px] text-right">
                  LKR {(Number(item.product.sellingPrice) * item.quantity).toLocaleString("en-LK")}
                </p>
              </div>
            </div>
          ))}

          {/* Total + complete */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm font-medium">Total</p>
              <p className="text-white font-bold text-2xl tabular-nums">LKR {total.toLocaleString("en-LK")}</p>
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
                className="h-11 rounded-xl bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              {state?.error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
                  {state.error}
                </p>
              )}
              <Button
                type="submit"
                disabled={pending || cart.length === 0}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl font-bold text-base"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {pending ? "Processing…" : `Complete Sale — LKR ${total.toLocaleString("en-LK")}`}
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 text-slate-500">
          <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Add products to start a sale</p>
        </div>
      )}
    </div>
  );
}
