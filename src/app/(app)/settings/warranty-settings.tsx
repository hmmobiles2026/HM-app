"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateWarrantyDefaults } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { WARRANTY_MONTH_OPTIONS } from "@/lib/warranty-math";

export function WarrantySettings({
  defaultFee,
  defaultMonths,
  isAdmin,
}: {
  defaultFee: number;
  defaultMonths: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [fee, setFee] = useState(String(defaultFee));
  const [months, setMonths] = useState(defaultMonths);

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      const result = await updateWarrantyDefaults(undefined, fd);
      if (result?.success) {
        toast.success(result.success);
        router.refresh();
      }
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  return (
    <div className="mt-4 max-w-md space-y-4">
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Default Warranty
          </p>
        </div>

        <p className="text-xs text-slate-400">
          These are only the starting values in the sale form. You can still change the
          fee or the period on any individual item while making a sale.
        </p>

        <form action={action} className="space-y-3">
          <input type="hidden" name="defaultMonths" value={months} />

          <div>
            <label className="text-xs text-slate-400">Fee per item</label>
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 h-11 mt-1">
              <span className="text-sm text-slate-400">LKR</span>
              <Input
                name="defaultFee"
                type="number"
                min={0}
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                onFocus={(e) => e.target.select()}
                disabled={!isAdmin}
                className="border-0 bg-transparent text-white font-semibold p-0 h-auto focus-visible:ring-0"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Cover period</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {WARRANTY_MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setMonths(m)}
                  className={`h-10 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${
                    months === m
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {m} mo
                </button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <Button
              type="submit"
              disabled={pending}
              className="bg-blue-600 hover:bg-blue-500 gap-2"
            >
              <Save className="h-4 w-4" />
              {pending ? "Saving…" : "Save defaults"}
            </Button>
          )}
        </form>
      </div>

      <p className="text-xs text-slate-500 px-1">
        Changing these never affects warranties already sold — each item keeps the cover
        it was given at the time of sale.
      </p>
    </div>
  );
}
