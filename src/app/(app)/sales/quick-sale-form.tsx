"use client";

import { useState, useActionState } from "react";
import { createSale } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Minus,
  Tag,
  ShieldCheck,
  Store,
  AlertTriangle,
} from "lucide-react";
import type { Product, Brand, PhoneModel, PartBrand, Category } from "@/generated/prisma/client";

export type CustomerOption = {
  id: string;
  shopName: string;
  balance: number;
  creditLimit: number | null;
};

type ProductWithRelations = Omit<Product, "costPrice" | "sellingPrice"> & {
  costPrice: number;
  sellingPrice: number;
  brand: Brand;
  model: PhoneModel | null;
  partBrand: PartBrand | null;
  category: Category;
};

type CartItem = {
  product: ProductWithRelations;
  quantity: number;
  customPrice: number;
};

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

export function QuickSaleForm({
  products,
  customers,
}: {
  products: ProductWithRelations[];
  customers: CustomerOption[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [totalInput, setTotalInput] = useState("");
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [warrantyInput, setWarrantyInput] = useState("200");
  const [customerId, setCustomerId] = useState("");
  const [paidInput, setPaidInput] = useState("");
  const [state, formAction, pending] = useActionState(createSale, undefined);

  const productItems = products.map((p) => ({
    id: p.id,
    label: `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}${p.partBrand ? ` (${p.partBrand.name})` : ""}`,
    sublabel: `${gradeLabel[p.qualityGrade]}  ·  ${p.stockQty} in stock  ·  LKR ${Number(p.sellingPrice).toLocaleString("en-LK")}`,
  }));

  function addToCart() {
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;
    const existing = cart.find((c) => c.product.id === selectedId);
    if (existing) {
      setCart(cart.map((c) => c.product.id === selectedId ? { ...c, quantity: c.quantity + qty } : c));
    } else {
      const price = Number(product.sellingPrice);
      setCart([...cart, { product, quantity: qty, customPrice: price }]);
      setPriceInputs((prev) => ({ ...prev, [product.id]: String(price) }));
    }
    setSelectedId("");
    setQty(1);
    setTotalInput("");
  }

  function removeFromCart(id: string) {
    setCart(cart.filter((c) => c.product.id !== id));
    setPriceInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTotalInput("");
  }

  function updateQty(id: string, n: number) {
    if (n < 1) return;
    setCart(cart.map((c) => c.product.id === id ? { ...c, quantity: n } : c));
  }

  function updatePrice(id: string, price: number) {
    setCart(cart.map((c) => c.product.id === id ? { ...c, customPrice: price } : c));
  }

  const subtotal = cart.reduce((s, c) => {
    const live = Number(priceInputs[c.product.id]);
    return s + (live >= 1 ? live : c.customPrice) * c.quantity;
  }, 0);
  const overrideVal = Number(totalInput);
  const productsTotal = totalInput !== "" && overrideVal >= 1 && overrideVal < subtotal ? overrideVal : subtotal;
  const warrantyFee = warrantyEnabled ? Math.max(0, Number(warrantyInput) || 0) : 0;
  const finalTotal = productsTotal + warrantyFee;
  const discount = subtotal - productsTotal;
  const scale = subtotal > 0 ? productsTotal / subtotal : 1;
  const selectedProduct = products.find((p) => p.id === selectedId);

  // ── Credit ──────────────────────────────────────────────────────────
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  // An empty box means "paying the whole thing", which is the common case.
  const amountPaid = selectedCustomer
    ? paidInput === ""
      ? finalTotal
      : Math.min(Math.max(0, Number(paidInput) || 0), finalTotal)
    : finalTotal;
  const goesOnTab = selectedCustomer ? Math.max(0, finalTotal - amountPaid) : 0;
  const newBalance = selectedCustomer ? selectedCustomer.balance + goesOnTab : 0;
  const overLimitBy =
    selectedCustomer && selectedCustomer.creditLimit !== null
      ? newBalance - selectedCustomer.creditLimit
      : 0;

  const customerItems = customers.map((c) => ({
    id: c.id,
    label: c.shopName,
    sublabel:
      c.balance > 0
        ? `Owes LKR ${c.balance.toLocaleString("en-LK")}`
        : c.balance < 0
          ? `LKR ${Math.abs(c.balance).toLocaleString("en-LK")} in advance`
          : "Settled up",
  }));

  return (
    <div className="mt-4 space-y-4">

      {/* ── Customer ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Customer
        </p>
        <Combobox
          name="_customerPicker"
          items={customerItems}
          value={customerId}
          onChange={(id) => {
            setCustomerId(id);
            setPaidInput("");
          }}
          placeholder="Walk-in customer (cash)"
        />
        {selectedCustomer && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-800 rounded-xl">
            <Store className="h-4 w-4 text-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {selectedCustomer.shopName}
              </p>
              <p className="text-xs text-slate-400">
                {selectedCustomer.balance > 0
                  ? `Already owes LKR ${selectedCustomer.balance.toLocaleString("en-LK")}`
                  : selectedCustomer.balance < 0
                    ? `LKR ${Math.abs(selectedCustomer.balance).toLocaleString("en-LK")} in advance`
                    : "Settled up"}
                {selectedCustomer.creditLimit !== null &&
                  ` · limit ${selectedCustomer.creditLimit.toLocaleString("en-LK")}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Product picker ───────────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Add Product</p>

        <Combobox
          name="_productPicker"
          items={productItems}
          value={selectedId}
          onChange={(id) => setSelectedId(id)}
          placeholder="Search by brand, model or part name…"
        />

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
                {selectedProduct.brand.name}{selectedProduct.model ? ` ${selectedProduct.model.name}` : ""} — {selectedProduct.name}{selectedProduct.partBrand ? ` (${selectedProduct.partBrand.name})` : ""}
              </p>
              <p className="text-xs text-slate-400">
                LKR {Number(selectedProduct.sellingPrice).toLocaleString("en-LK")} · {selectedProduct.stockQty} in stock
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden h-11">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-4 h-full text-slate-300 hover:text-white active:bg-slate-700 transition-colors">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-base text-white font-semibold select-none">{qty}</span>
            <button type="button" onClick={() => setQty(qty + 1)}
              disabled={!!(selectedProduct && qty >= selectedProduct.stockQty)}
              className="px-4 h-full text-slate-300 hover:text-white active:bg-slate-700 disabled:opacity-30 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button type="button" onClick={addToCart} disabled={!selectedId}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-sm font-semibold">
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

          {cart.map((item) => {
            const livePrice = Number(priceInputs[item.product.id] ?? "");
            const effectiveUnitPrice = livePrice >= 1 ? livePrice : item.customPrice;
            const originalPrice = Number(item.product.sellingPrice);
            const isDiscounted = effectiveUnitPrice < originalPrice;
            const discountAmt = originalPrice - effectiveUnitPrice;

            return (
              <div key={item.product.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                {/* Row 1: image + name + delete */}
                <div className="flex items-center gap-2.5">
                  {item.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.imageUrl} alt={item.product.name}
                      className="h-11 w-11 rounded-xl object-cover shrink-0 ring-1 ring-slate-700" />
                  ) : (
                    <div className="h-11 w-11 rounded-xl bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                      <span className="text-slate-300 text-sm font-bold">{item.product.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug truncate">
                      {item.product.brand.name}{item.product.model ? ` ${item.product.model.name}` : ""} — {item.product.name}{item.product.partBrand ? ` (${item.product.partBrand.name})` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gradeBadge[item.product.qualityGrade]}`}>
                        {gradeLabel[item.product.qualityGrade]}
                      </span>
                      {isDiscounted && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                          <Tag className="h-3 w-3" />
                          −LKR {discountAmt.toLocaleString("en-LK")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.product.id)}
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Row 2: editable price + qty stepper + subtotal */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  {/* Editable unit price */}
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 h-9 min-w-0 flex-1">
                    <span className="text-xs text-slate-400 shrink-0">LKR</span>
                    <input
                      type="number"
                      min={1}
                      value={priceInputs[item.product.id] ?? String(item.customPrice)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setPriceInputs((prev) => ({ ...prev, [item.product.id]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1) {
                          updatePrice(item.product.id, v);
                          setPriceInputs((prev) => ({ ...prev, [item.product.id]: String(v) }));
                        } else {
                          setPriceInputs((prev) => ({ ...prev, [item.product.id]: String(item.customPrice) }));
                        }
                      }}
                      className="flex-1 bg-transparent text-sm text-white font-medium outline-none min-w-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {isDiscounted && (
                      <span className="text-xs text-slate-500 line-through shrink-0">
                        {originalPrice.toLocaleString("en-LK")}
                      </span>
                    )}
                  </div>

                  {/* Qty stepper */}
                  <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shrink-0">
                    <button type="button" onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      className="px-2.5 py-2 text-slate-400 hover:text-white active:bg-slate-700 transition-colors">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm text-white font-semibold select-none">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stockQty}
                      className="px-2.5 py-2 text-slate-400 hover:text-white active:bg-slate-700 disabled:opacity-30 transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-sm font-bold text-white tabular-nums shrink-0 min-w-[72px] text-right">
                    LKR {(effectiveUnitPrice * item.quantity).toLocaleString("en-LK")}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Total + submit */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            {discount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-500">Subtotal</p>
                <p className="text-slate-500 line-through tabular-nums">LKR {subtotal.toLocaleString("en-LK")}</p>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <Tag className="h-3.5 w-3.5" /> Discount
                </span>
                <span className="text-amber-400 tabular-nums">−LKR {discount.toLocaleString("en-LK")}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm font-medium">Products</p>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-sm">LKR</span>
                <input
                  type="number"
                  value={totalInput !== "" ? totalInput : String(subtotal)}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTotalInput(e.target.value)}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 1 && v < subtotal) {
                      setTotalInput(String(v));
                    } else {
                      setTotalInput("");
                    }
                  }}
                  className="text-white font-bold text-2xl tabular-nums bg-transparent outline-none text-right w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Warranty row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setWarrantyEnabled((v) => !v)}
              onKeyDown={(e) => e.key === " " && setWarrantyEnabled((v) => !v)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-3 cursor-pointer transition-colors select-none ${
                warrantyEnabled
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "hover:bg-slate-800 border border-transparent"
              }`}
            >
              {/* Radio circle */}
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                warrantyEnabled ? "border-emerald-400" : "border-slate-600"
              }`}>
                {warrantyEnabled && <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />}
              </div>

              <ShieldCheck className={`h-4 w-4 shrink-0 ${warrantyEnabled ? "text-emerald-400" : "text-slate-500"}`} />
              <span className={`text-sm font-medium flex-1 ${warrantyEnabled ? "text-emerald-300" : "text-slate-400"}`}>
                Warranty
              </span>

              {warrantyEnabled ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-xl px-2.5 h-9"
                >
                  <span className="text-xs text-slate-400 shrink-0">LKR</span>
                  <input
                    type="number"
                    min={1}
                    value={warrantyInput}
                    onChange={(e) => setWarrantyInput(e.target.value)}
                    className="bg-transparent text-sm text-white font-medium outline-none w-20 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-600">LKR 200</span>
              )}
            </div>

            {warrantyEnabled && warrantyFee > 0 && (
              <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-2">
                <p className="text-white font-semibold">Grand Total</p>
                <p className="text-white font-bold text-xl tabular-nums">LKR {finalTotal.toLocaleString("en-LK")}</p>
              </div>
            )}

            {/* ── Payment (credit customers only) ──────────────────── */}
            {selectedCustomer && (
              <div className="border-t border-slate-800 pt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-400 font-medium shrink-0">Paid now</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-sm">LKR</span>
                    <input
                      type="number"
                      min={0}
                      max={finalTotal}
                      value={paidInput !== "" ? paidInput : String(finalTotal)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setPaidInput(e.target.value)}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v >= finalTotal) setPaidInput("");
                        else setPaidInput(String(Math.max(0, v)));
                      }}
                      className="text-white font-bold text-xl tabular-nums bg-transparent outline-none text-right w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaidInput("")}
                    className={`flex-1 h-9 rounded-xl text-xs font-medium transition-colors ${
                      goesOnTab === 0
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Paid in full
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidInput("0")}
                    className={`flex-1 h-9 rounded-xl text-xs font-medium transition-colors ${
                      amountPaid === 0
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Nothing yet
                  </button>
                </div>

                {goesOnTab > 0 && (
                  <div className="space-y-1 rounded-xl bg-blue-950/40 border border-blue-900 px-3 py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-300">Goes on his tab</span>
                      <span className="text-blue-200 font-bold tabular-nums">
                        LKR {goesOnTab.toLocaleString("en-LK")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">New balance</span>
                      <span className="text-slate-300 font-semibold tabular-nums">
                        LKR {newBalance.toLocaleString("en-LK")}
                      </span>
                    </div>
                  </div>
                )}

                {overLimitBy > 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-950/50 border border-amber-800 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      Over credit limit by{" "}
                      <span className="font-semibold">
                        LKR {overLimitBy.toLocaleString("en-LK")}
                      </span>
                      . You can still continue.
                    </p>
                  </div>
                )}
              </div>
            )}

            <form action={formAction} className="space-y-3">
              <input type="hidden" name="customerId" value={customerId} />
              {/*
                Send the INTENT, not just the number. The server recomputes the total
                from the scaled per-line prices, which can land a cent away from the
                figure shown here. Without this flag, "paid in full" could leave a
                stray LKR 0.01 sitting on the customer's tab forever.
              */}
              <input type="hidden" name="payInFull" value={paidInput === "" ? "1" : "0"} />
              <input type="hidden" name="amountPaid" value={amountPaid} />
              {cart.map((item, i) => {
                const livePrice = Number(priceInputs[item.product.id] ?? "");
                const effectivePrice = livePrice >= 1 ? livePrice : item.customPrice;
                return (
                  <div key={item.product.id}>
                    <input type="hidden" name={`productId_${i}`} value={item.product.id} />
                    <input type="hidden" name={`quantity_${i}`} value={item.quantity} />
                    <input type="hidden" name={`price_${i}`} value={Number((effectivePrice * scale).toFixed(2))} />
                  </div>
                );
              })}
              <input type="hidden" name="warrantyFee" value={warrantyFee} />
              <Input name="note" placeholder="Note (optional)"
                className="h-11 rounded-xl bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              {state?.error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending || cart.length === 0}
                className={`w-full h-12 rounded-xl font-bold text-base ${
                  goesOnTab > 0
                    ? "bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
                    : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
                }`}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                {pending
                  ? "Processing…"
                  : goesOnTab > 0
                    ? `Complete Sale — LKR ${goesOnTab.toLocaleString("en-LK")} on credit`
                    : `Complete Sale — LKR ${finalTotal.toLocaleString("en-LK")}`}
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
