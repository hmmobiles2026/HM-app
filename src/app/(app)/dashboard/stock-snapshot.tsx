"use client";

import { Package, AlertCircle, DollarSign, Tag } from "lucide-react";

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

const gradeColor: Record<string, string> = {
  ORIGINAL: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  COPY_A: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  COPY_B: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  OTHER: "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

type CategoryRow = { name: string; units: number; skus: number };
type GradeRow = { grade: string; units: number; skus: number };

type Props = {
  totalUnits: number;
  outOfStock: number;
  inventoryValue: number;
  byCategory: CategoryRow[];
  byGrade: GradeRow[];
  showFinancials: boolean;
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

export function StockSnapshot({
  totalUnits,
  outOfStock,
  inventoryValue,
  byCategory,
  byGrade,
  showFinancials,
}: Props) {
  const inStock = totalUnits;
  const maxCategory = byCategory[0]?.units ?? 1;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className={`grid gap-3 ${showFinancials ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-white tabular-nums">{inStock.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Units in stock</p>
          </div>
        </div>

        {showFinancials && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white tabular-nums leading-tight">{lkr(inventoryValue)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Inventory value</p>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${outOfStock > 0 ? "bg-red-500/10 border border-red-500/20" : "bg-slate-800 border border-slate-700"}`}>
            <AlertCircle className={`h-4 w-4 ${outOfStock > 0 ? "text-red-400" : "text-slate-500"}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-2xl font-bold tabular-nums ${outOfStock > 0 ? "text-red-400" : "text-slate-400"}`}>{outOfStock}</p>
            <p className="text-xs text-slate-400 mt-0.5">Out of stock</p>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Category */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">By Category</h3>
          </div>
          {byCategory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No categories</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 truncate">{cat.name}</span>
                    <span className="text-sm font-semibold text-white tabular-nums ml-2 shrink-0">{cat.units.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round((cat.units / maxCategory) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{cat.skus} SKU{cat.skus !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Grade */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">By Quality Grade</h3>
          </div>
          {byGrade.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No products</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {byGrade.map((g) => (
                <div
                  key={g.grade}
                  className={`rounded-xl border px-3 py-2.5 ${gradeColor[g.grade] ?? gradeColor.OTHER}`}
                >
                  <p className="text-xs font-medium opacity-80">{gradeLabel[g.grade] ?? "Other"}</p>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{g.units.toLocaleString()}</p>
                  <p className="text-xs opacity-60 mt-0.5">{g.skus} SKU{g.skus !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
