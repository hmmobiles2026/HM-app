"use client";

import { useActionState, useState } from "react";
import { createReturn } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Undo2, X, CheckCircle2 } from "lucide-react";

export function ReturnButton({
  saleItemId,
  maxQty,
  productName,
}: {
  saleItemId: string;
  maxQty: number;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
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
    <form action={formAction} className="flex flex-col gap-2 mt-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">Return — {productName}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          name="quantity"
          type="number"
          min={1}
          max={maxQty}
          defaultValue={1}
          className="h-9 w-20 bg-slate-900 border-slate-700 text-white text-sm rounded-lg"
        />
        <Input
          name="reason"
          placeholder="Reason (optional)"
          className="h-9 flex-1 bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500 rounded-lg"
        />
        <Button type="submit" disabled={pending} className="h-9 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm px-3">
          {pending ? "…" : "Confirm"}
        </Button>
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
