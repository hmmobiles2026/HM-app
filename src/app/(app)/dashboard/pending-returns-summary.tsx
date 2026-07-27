"use client";

import Link from "next/link";
import { ArrowRight, PackageX } from "lucide-react";

type Props = { count: number; value: number };

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

export function PendingReturnsSummary({ count, value }: Props) {
  if (count === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 px-5 py-4">
        <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <PackageX className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300">No pending supplier returns</p>
          <p className="text-xs text-slate-500 mt-0.5">All returns are resolved</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl flex items-center gap-4 px-5 py-4">
      <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
        <PackageX className="h-5 w-5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          {count} pending supplier return{count !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-amber-400/70 mt-0.5">
          {value > 0 ? `${lkr(value)} cost to recover from supplier` : "Cost recovery amount not recorded"}
        </p>
      </div>
      <Link
        href="/sales?tab=supplier-returns"
        className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 shrink-0 transition-colors"
      >
        View <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
