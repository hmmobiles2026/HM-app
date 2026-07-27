"use client";

import { TrendingUp } from "lucide-react";

type Product = {
  id: string;
  name: string;
  brandName: string;
  modelName: string | null;
  imageUrl: string | null;
  totalQty: number;
  totalRevenue: number;
};

type Props = { products: Product[]; showFinancials: boolean };

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 0 })}`;
}

export function TopSelling({ products, showFinancials }: Props) {
  if (products.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center py-12 text-slate-500">
        <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No sales in the last 30 days</p>
      </div>
    );
  }

  const maxQty = products[0].totalQty;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
      {products.map((p, i) => {
        const label = p.modelName ? `${p.brandName} ${p.modelName} — ${p.name}` : `${p.brandName} — ${p.name}`;
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs font-bold text-slate-600 tabular-nums w-5 shrink-0 text-center">{i + 1}</span>
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 ring-1 ring-slate-700" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-400">{p.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{label}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.round((p.totalQty / maxQty) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-white tabular-nums">{p.totalQty} sold</p>
              {showFinancials && (
                <p className="text-xs text-emerald-400 tabular-nums">{lkr(p.totalRevenue)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
