"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { adjustStock } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SlidersHorizontal, Minus, Plus, Truck } from "lucide-react";
import { toast } from "sonner";

type Supplier = { id: string; name: string };

const REASONS = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "WRONG_ITEM", label: "Wrong item received" },
  { value: "LOST", label: "Lost" },
  { value: "COUNT_CORRECTION", label: "Count correction" },
  { value: "OTHER", label: "Other" },
] as const;

export function AdjustStockForm({
  productId,
  productName,
  stockQty,
  costPrice,
  suppliers,
}: {
  productId: string;
  productName: string;
  stockQty: number;
  costPrice: number;
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>("DAMAGED");
  const [claim, setClaim] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [claimAmount, setClaimAmount] = useState("");

  const qty = Math.max(0, Number(quantity) || 0);
  const removing = direction === "remove";
  const newQty = removing ? stockQty - qty : stockQty + qty;
  const lossValue = costPrice * qty;
  const tooMany = removing && qty > stockQty;

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      const result = await adjustStock(productId, undefined, fd);
      if (result?.success) {
        toast.success(result.success);
        setOpen(false);
        setQuantity("1");
        setClaim(false);
        setSupplierId("");
        setClaimAmount("");
        router.refresh();
      }
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        className="h-10 border-slate-700 text-slate-300 hover:text-white rounded-xl gap-1.5"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Adjust stock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Adjust stock — {productName}
            </DialogTitle>
          </DialogHeader>

          <form action={action} className="space-y-3">
            <input type="hidden" name="direction" value={direction} />
            <input type="hidden" name="reason" value={reason} />
            <input type="hidden" name="claim" value={claim ? "true" : "false"} />
            <input type="hidden" name="supplierId" value={claim ? supplierId : ""} />

            {/* Which way */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDirection("remove")}
                className={`h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  removing ? "bg-red-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Minus className="h-4 w-4" />
                Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection("add");
                  setClaim(false);
                }}
                className={`h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  !removing ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Plus className="h-4 w-4" />
                Add back
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400">Quantity</label>
              <Input
                name="quantity"
                type="number"
                min={1}
                value={quantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 mt-1 bg-slate-800 border-slate-700 text-white"
              />
              <p className={`text-xs mt-1 ${tooMany ? "text-red-400" : "text-slate-400"}`}>
                {tooMany
                  ? `Only ${stockQty} in stock.`
                  : `${stockQty} → ${newQty} in stock`}
                {removing && qty > 0 && !tooMany && (
                  <> · worth LKR {lossValue.toLocaleString("en-LK")} at cost</>
                )}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400">Reason</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`h-9 rounded-xl text-xs font-medium transition-colors ${
                      reason === r.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Supplier claim — only meaningful for stock going out */}
            {removing && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setClaim((v) => !v)}
                  className="flex items-center gap-2.5 w-full text-left"
                >
                  <span
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      claim ? "bg-amber-500 border-amber-500" : "border-slate-600"
                    }`}
                  >
                    {claim && <span className="text-slate-900 text-xs font-bold">✓</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-300">
                    <Truck className="h-4 w-4" />
                    Claim this from the supplier
                  </span>
                </button>

                {claim && (
                  <div className="space-y-2 pl-7">
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full h-10 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm px-2"
                    >
                      <option value="">Choose supplier…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 h-10">
                      <span className="text-xs text-slate-400">LKR</span>
                      <input
                        name="claimAmount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={claimAmount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        placeholder={String(lossValue)}
                        className="flex-1 bg-transparent text-sm text-white outline-none min-w-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Leave blank to claim what it cost you.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Input
              name="note"
              placeholder="Note (optional)"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-300"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || qty < 1 || tooMany || (claim && !supplierId)}
                className={removing ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}
              >
                {pending ? "Saving…" : removing ? `Remove ${qty || ""}` : `Add ${qty || ""}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
