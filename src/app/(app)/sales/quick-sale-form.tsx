"use client";

import { useState, useActionState } from "react";
import { createSale } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
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

const gradeShort: Record<string, string> = {
  ORIGINAL: "Orig",
  COPY_A: "A",
  COPY_B: "B",
  OTHER: "Oth",
};

export function QuickSaleForm({
  products,
}: {
  products: ProductWithRelations[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);
  const [state, formAction, pending] = useActionState(createSale, undefined);

  function addToCart() {
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;
    const existing = cart.find((c) => c.product.id === selectedId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.product.id === selectedId
            ? { ...c, quantity: c.quantity + qty }
            : c
        )
      );
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
    setCart(cart.map((c) => (c.product.id === productId ? { ...c, quantity: newQty } : c)));
  }

  const total = cart.reduce(
    (sum, c) => sum + Number(c.product.sellingPrice) * c.quantity,
    0
  );

  return (
    <div className="mt-4 space-y-4 max-w-xl">
      {/* Product picker */}
      <div className="flex gap-2">
        <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? "")}>
          <SelectTrigger className="flex-1 bg-slate-900 border-slate-700 text-white">
            <SelectValue placeholder="Select a product…">
              {(v: string | null) => {
                const p = products.find((p) => p.id === v);
                return p ? `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}` : null;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 max-h-72">
            {products.map((p) => {
              const label = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`;
              return (
                <SelectItem key={p.id} value={p.id} label={label}>
                  <span className="flex items-center gap-2">
                    <span>{label}</span>
                    <span className="text-slate-500 text-xs">
                      ({gradeShort[p.qualityGrade]}) {p.stockQty} left
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          className="w-20 bg-slate-900 border-slate-700 text-white text-center"
        />
        <Button
          type="button"
          onClick={addToCart}
          disabled={!selectedId}
          className="bg-blue-600 hover:bg-blue-500 px-3"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Cart */}
      {cart.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-400 font-medium">Cart</p>
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {item.product.brand.name}
                  {item.product.model ? ` ${item.product.model.name}` : ""} —{" "}
                  {item.product.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {gradeShort[item.product.qualityGrade]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    LKR{" "}
                    {Number(item.product.sellingPrice).toLocaleString("en-LK")}{" "}
                    each
                  </span>
                </div>
              </div>
              <Input
                type="number"
                min={1}
                max={item.product.stockQty}
                value={item.quantity}
                onChange={(e) =>
                  updateQty(item.product.id, Number(e.target.value))
                }
                className="w-16 h-8 text-sm text-center bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-sm font-semibold text-white w-24 text-right">
                LKR{" "}
                {(
                  Number(item.product.sellingPrice) * item.quantity
                ).toLocaleString("en-LK")}
              </p>
              <button
                type="button"
                onClick={() => removeFromCart(item.product.id)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Total + submit */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <p className="text-slate-400 text-sm">Total</p>
              <p className="text-white font-bold text-lg">
                LKR {total.toLocaleString("en-LK")}
              </p>
            </div>
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
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />
            {state?.error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
                {state.error}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {pending ? "Processing…" : "Complete Sale"}
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 text-slate-500">
          <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Add products to start a sale</p>
        </div>
      )}
    </div>
  );
}
