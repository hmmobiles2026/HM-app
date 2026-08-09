"use client";

import { useActionState, useState } from "react";
import { createReturn } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Undo2, CheckCircle2, Package, Truck, ShieldCheck } from "lucide-react";

type Supplier = { id: string; name: string };

export function ReturnButton({
  saleItemId,
  maxQty,
  productName,
  suppliers,
  saleWarrantyFee,
  itemWarrantyPerUnit,
  saleUsesPerItemWarranty = false,
}: {
  saleItemId: string;
  maxQty: number;
  productName: string;
  suppliers: Supplier[];
  saleWarrantyFee?: number | null;
  /** Per-unit warranty on this line. Null on sales made before per-item warranty. */
  itemWarrantyPerUnit?: number | null;
  /** True when ANY line on this sale carries per-item cover. */
  saleUsesPerItemWarranty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [returnType, setReturnType] = useState<"STOCK_BACK" | "SUPPLIER_RETURN">("STOCK_BACK");
  const [refundWarranty, setRefundWarranty] = useState(false);
  const [qty, setQty] = useState(1);
  const action = createReturn.bind(null, saleItemId);
  const [state, formAction, pending] = useActionState(action, undefined);

  // Per-item cover refunds only the units coming back. Older sales carry a single
  // whole-bill figure and still refund all of it, exactly as they used to.
  //
  // Must mirror planWarrantyRefund exactly: on a per-item sale, a line with no cover
  // offers nothing — the sale's warranty total belongs to the other lines.
  const perUnit = itemWarrantyPerUnit ?? 0;
  const isLegacySale = !saleUsesPerItemWarranty;
  const warrantyAmount =
    perUnit > 0 ? perUnit * qty : isLegacySale ? (saleWarrantyFee ?? 0) : 0;
  const hasWarranty = warrantyAmount > 0;

  if (maxQty <= 0) return null;

  if (state?.success) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Returned
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 active:text-amber-300 transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Return
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Return — {productName}</DialogTitle>
          </DialogHeader>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReturnType("STOCK_BACK")}
              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium border transition-colors ${
                returnType === "STOCK_BACK"
                  ? "bg-blue-600/20 border-blue-500 text-blue-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              <Package className="h-4 w-4" />
              Back to Stock
            </button>
            <button
              type="button"
              onClick={() => setReturnType("SUPPLIER_RETURN")}
              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium border transition-colors ${
                returnType === "SUPPLIER_RETURN"
                  ? "bg-amber-600/20 border-amber-500 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              <Truck className="h-4 w-4" />
              Defective → Supplier
            </button>
          </div>

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="returnType" value={returnType} />
            <input type="hidden" name="refundWarranty" value={refundWarranty ? "true" : "false"} />

            <div className="space-y-2">
              <div className="flex gap-2 items-start">
                <div className="space-y-1 shrink-0">
                  <label className="text-xs text-slate-400">Qty</label>
                  <Input
                    name="quantity"
                    type="number"
                    min={1}
                    max={maxQty}
                    value={qty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setQty(Number.isFinite(v) ? Math.min(maxQty, Math.max(1, v)) : 1);
                    }}
                    className="h-10 w-20 bg-slate-800 border-slate-700 text-white text-sm rounded-xl"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs text-slate-400">Reason <span className="text-red-400">*</span></label>
                  <Input
                    name="reason"
                    placeholder="e.g. Screen cracked"
                    required
                    className="h-10 bg-slate-800 border-slate-700 text-white text-sm placeholder:text-slate-500 rounded-xl"
                  />
                </div>
              </div>

              {returnType === "SUPPLIER_RETURN" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Supplier <span className="text-red-400">*</span></label>
                    <select
                      name="supplierId"
                      required
                      defaultValue=""
                      className="w-full h-10 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3"
                    >
                      <option value="" disabled>Select supplier…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-amber-400/80 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
                    Item will NOT be added back to stock. Tracked as pending supplier claim.
                  </p>
                </>
              )}
            </div>

            {returnType === "STOCK_BACK" && hasWarranty && (
              <button
                type="button"
                onClick={() => setRefundWarranty((v) => !v)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  refundWarranty
                    ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0 text-left">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span>Refund warranty fee</span>{" "}
                    <span className="font-semibold tabular-nums">
                      LKR {warrantyAmount.toLocaleString("en-LK")}
                    </span>
                    {perUnit > 0 && qty > 1 && (
                      <span className="block text-xs opacity-70">
                        {qty} × LKR {perUnit.toLocaleString("en-LK")}
                      </span>
                    )}
                    {perUnit === 0 && (
                      <span className="block text-xs opacity-70">
                        Whole-bill warranty (older sale)
                      </span>
                    )}
                  </span>
                </span>
                <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors ${
                  refundWarranty ? "bg-emerald-500 border-emerald-500" : "bg-slate-700 border-slate-600"
                }`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    refundWarranty ? "translate-x-4" : "translate-x-0"
                  }`} />
                </span>
              </button>
            )}

            {state?.error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 h-10 text-sm rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={pending}
                className={`flex-1 h-10 rounded-xl text-sm ${
                  returnType === "SUPPLIER_RETURN"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {pending ? "…" : "Confirm Return"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
