"use client";

import Link from "next/link";
import { ArrowRight, PackageMinus, Truck } from "lucide-react";

type Props = {
  lossValue: number;
  pendingClaimValue: number;
  recoveredValue: number;
  units: number;
  claimedUnits: number;
  byReason: { reason: string; units: number; lossValue: number }[];
};

const LABEL: Record<string, string> = {
  DAMAGED: "damaged",
  WRONG_ITEM: "wrong item",
  LOST: "lost",
  COUNT_CORRECTION: "miscount",
  OTHER: "other",
};

const lkr = (n: number) =>
  `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

export function StockLossSummary({
  lossValue,
  pendingClaimValue,
  recoveredValue,
  units,
  claimedUnits,
  byReason,
}: Props) {
  if (units === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 px-5 py-4">
        <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <PackageMinus className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300">No stock written off</p>
          <p className="text-xs text-slate-500 mt-0.5">Nothing removed this month</p>
        </div>
      </div>
    );
  }

  // Everything removed was claimable, so nothing is actually lost.
  const nothingLost = lossValue === 0;

  return (
    <div
      className={`rounded-2xl px-5 py-4 space-y-2.5 border ${
        nothingLost ? "bg-slate-900 border-slate-800" : "bg-red-950/40 border-red-900/60"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
            nothingLost
              ? "bg-slate-800 border-slate-700"
              : "bg-red-500/10 border-red-500/30"
          }`}
        >
          <PackageMinus
            className={`h-5 w-5 ${nothingLost ? "text-slate-400" : "text-red-400"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              nothingLost ? "text-slate-300" : "text-red-300"
            }`}
          >
            {nothingLost ? "Nothing lost" : `${lkr(lossValue)} written off`}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              nothingLost ? "text-slate-500" : "text-red-400/70"
            }`}
          >
            {units} {units === 1 ? "piece" : "pieces"} removed this month
            {nothingLost && claimedUnits > 0 && " — all claimed from suppliers"}
          </p>
        </div>
        <Link
          href="/stock"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 shrink-0 transition-colors"
        >
          Stock <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {(pendingClaimValue > 0 || recoveredValue > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-14 text-xs">
          {pendingClaimValue > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Truck className="h-3 w-3" />
              {lkr(pendingClaimValue)} due back from suppliers
            </span>
          )}
          {recoveredValue > 0 && (
            <span className="text-emerald-400">
              {lkr(recoveredValue)} already recovered
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-14 text-xs text-slate-400">
        {byReason.map((r) => (
          <span key={r.reason}>
            {LABEL[r.reason] ?? r.reason} {r.units}
          </span>
        ))}
      </div>
    </div>
  );
}
