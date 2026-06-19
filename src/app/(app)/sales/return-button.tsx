"use client";

import { useActionState, useState } from "react";
import { createReturn } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Undo2, X, CheckCircle2, Package, Truck } from "lucide-react";

type Supplier = { id: string; name: string };

export function ReturnButton({
  saleItemId,
  maxQty,
  productName,
  suppliers,
}: {
  saleItemId: string;
  maxQty: number;
  productName: string;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  const [returnType, setReturnType] = useState<"STOCK_BACK" | "SUPPLIER_RETURN">("STOCK_BACK");
  const action = createReturn.bind(null, saleItemId);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (maxQty <= 0) return null;

  if (state?.success) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Returned
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 active:text-amber-300 transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Return
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">Return — {productName}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setReturnType("STOCK_BACK")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            returnType === "STOCK_BACK"
              ? "bg-blue-600/20 border-blue-500 text-blue-300"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          <Package className="h-3.5 w-3.5 shrink-0" />
          Back to Stock
        </button>
        <button
          type="button"
          onClick={() => setReturnType("SUPPLIER_RETURN")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            returnType === "SUPPLIER_RETURN"
              ? "bg-amber-600/20 border-amber-500 text-amber-300"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          <Truck className="h-3.5 w-3.5 shrink-0" />
          Defective → Supplier
        </button>
      </div>

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="returnType" value={returnType} />

        <div className="flex gap-2">
          <Input
            name="quantity"
            type="number"
            min={1}
            max={maxQty}
            defaultValue={1}
            className="h-9 w-20 bg-slate-900 border-slate-700 text-white text-sm rounded-lg shrink-0"
          />
          <Input
            name="reason"
            placeholder="Reason *"
            required
            className="h-9 flex-1 bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500 rounded-lg"
          />
        </div>

        {returnType === "SUPPLIER_RETURN" && (
          <select
            name="supplierId"
            required
            defaultValue=""
            className="w-full h-9 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3"
          >
            <option value="" disabled>Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {returnType === "SUPPLIER_RETURN" && (
          <p className="text-xs text-amber-400/80">
            Item will NOT be added back to stock. Cost will be tracked as pending supplier claim.
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className={`h-9 w-full rounded-lg text-sm ${
            returnType === "SUPPLIER_RETURN"
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          {pending ? "…" : returnType === "SUPPLIER_RETURN" ? "Record Supplier Return" : "Confirm Return"}
        </Button>
        {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      </form>
    </div>
  );
}
