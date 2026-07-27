"use client";

import { Clock } from "lucide-react";

const gradeColor: Record<string, string> = {
  ORIGINAL: "text-emerald-400",
  COPY_A: "text-blue-400",
  COPY_B: "text-amber-400",
  OTHER: "text-slate-400",
};

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

type Product = {
  id: string;
  name: string;
  brandName: string;
  modelName: string | null;
  stockQty: number;
  costPrice: number;
  qualityGrade: string;
};

type Props = { products: Product[]; showFinancials: boolean };

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 0 })}`;
}

export function SlowMoving({ products, showFinancials }: Props) {
  if (products.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center py-12 text-slate-500">
        <Clock className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">All products sold within 30 days</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
      {products.map((p) => {
        const label = p.modelName ? `${p.brandName} ${p.modelName} — ${p.name}` : `${p.brandName} — ${p.name}`;
        const tiedUpValue = p.stockQty * p.costPrice;
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-500 opacity-70" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{label}</p>
              <p className={`text-xs mt-0.5 ${gradeColor[p.qualityGrade] ?? gradeColor.OTHER}`}>
                {gradeLabel[p.qualityGrade] ?? "Other"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-amber-400 tabular-nums">{p.stockQty} units</p>
              {showFinancials && (
                <p className="text-xs text-slate-400 tabular-nums">{lkr(tiedUpValue)} tied up</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
