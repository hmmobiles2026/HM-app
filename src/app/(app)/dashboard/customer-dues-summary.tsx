"use client";

import Link from "next/link";
import { ArrowRight, Wallet, Clock } from "lucide-react";

type Props = {
  totalOutstanding: number;
  shopsWithDues: number;
  overdue30: number;
  collectedThisMonth: number;
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

export function CustomerDuesSummary({
  totalOutstanding,
  shopsWithDues,
  overdue30,
  collectedThisMonth,
}: Props) {
  if (shopsWithDues === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 px-5 py-4">
        <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <Wallet className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300">No money on credit</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {collectedThisMonth > 0
              ? `${lkr(collectedThisMonth)} collected this month`
              : "Every shop is settled up"}
          </p>
        </div>
        <Link
          href="/customers"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 shrink-0 transition-colors"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-blue-950/40 border border-blue-800/60 rounded-2xl px-5 py-4 space-y-2.5">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
          <Wallet className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-300">
            {lkr(totalOutstanding)} owed by {shopsWithDues} shop
            {shopsWithDues !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-blue-400/70 mt-0.5">
            Already counted as revenue — this is money not yet collected
          </p>
        </div>
        <Link
          href="/customers"
          className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 shrink-0 transition-colors"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {(overdue30 > 0 || collectedThisMonth > 0) && (
        <div className="flex items-center gap-4 pl-14 text-xs">
          {overdue30 > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Clock className="h-3 w-3" />
              {lkr(overdue30)} owed over 30 days
            </span>
          )}
          {collectedThisMonth > 0 && (
            <span className="text-emerald-400">
              {lkr(collectedThisMonth)} collected this month
            </span>
          )}
        </div>
      )}
    </div>
  );
}
