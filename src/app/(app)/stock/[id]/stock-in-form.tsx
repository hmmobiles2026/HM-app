"use client";

import { useActionState } from "react";
import { addStock } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StockInForm({ productId }: { productId: string }) {
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
          className="bg-slate-900 border-slate-700 text-white"
        />
        {state?.errors?.quantity && (
          <p className="text-xs text-red-400">{state.errors.quantity[0]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">Note (optional)</Label>
        <Input
          name="note"
          placeholder="e.g. Purchased from supplier"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="bg-blue-600 hover:bg-blue-500"
      >
        {pending ? "Adding…" : "Add Stock"}
      </Button>
    </form>
  );
}
