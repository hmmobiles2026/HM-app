"use client";

import { useActionState } from "react";
import { addStock } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Supplier = { id: string; name: string };

export function StockInForm({ productId, suppliers }: { productId: string; suppliers: Supplier[] }) {
  const action = addStock.bind(null, productId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 mt-4 max-w-sm">
      <div className="space-y-1.5">
        <Label className="text-slate-300">Quantity to Add</Label>
        <Input
          name="quantity"
          type="number"
          min={1}
          placeholder="e.g. 10"
          required
          className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl"
        />
        {state?.errors?.quantity && (
          <p className="text-xs text-red-400">{state.errors.quantity[0]}</p>
        )}
      </div>

      {suppliers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-slate-300">Supplier <span className="text-slate-500 font-normal">(optional)</span></Label>
          <select
            name="supplierId"
            defaultValue=""
            className="w-full h-11 bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-3"
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-slate-300">Note (optional)</Label>
        <Input
          name="note"
          placeholder="e.g. Purchased from supplier"
          className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full sm:w-auto min-w-28 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl font-semibold"
      >
        {pending ? "Adding…" : "Add Stock"}
      </Button>
    </form>
  );
}
