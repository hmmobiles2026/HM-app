import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type PriceEntry = {
  id: string;
  oldCostPrice: number;
  newCostPrice: number;
  oldSellPrice: number;
  newSellPrice: number;
  changedAt: Date;
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

function Delta({ old: o, next: n }: { old: number; next: number }) {
  const diff = n - o;
  if (diff === 0) return <Minus className="h-3.5 w-3.5 text-slate-500 inline" />;
  if (diff > 0)
    return <span className="text-emerald-400 text-xs font-medium">▲ {lkr(diff)}</span>;
  return <span className="text-red-400 text-xs font-medium">▼ {lkr(Math.abs(diff))}</span>;
}

export function PriceHistory({ entries, currentCost, currentSell }: {
  entries: PriceEntry[];
  currentCost: number;
  currentSell: number;
}) {
  return (
    <div className="mt-4 space-y-3">
      {/* Current prices */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Current Prices</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400">Cost Price</p>
            <p className="text-white font-bold text-lg tabular-nums">{lkr(currentCost)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Selling Price</p>
            <p className="text-white font-bold text-lg tabular-nums">{lkr(currentSell)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">Margin</p>
            <p className="text-emerald-400 font-semibold tabular-nums">
              {lkr(currentSell - currentCost)}
              <span className="text-slate-400 font-normal text-xs ml-2">
                ({currentSell > 0 ? (((currentSell - currentCost) / currentSell) * 100).toFixed(1) : "0.0"}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {entries.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">No price changes recorded yet</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Change History</p>
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <p className="text-xs text-slate-400">{format(new Date(e.changedAt), "dd MMM yyyy, h:mm a")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Cost</p>
                  <p className="text-xs text-slate-400 line-through">{lkr(e.oldCostPrice)}</p>
                  <p className="text-sm text-white font-medium">{lkr(e.newCostPrice)}</p>
                  <Delta old={e.oldCostPrice} next={e.newCostPrice} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Selling</p>
                  <p className="text-xs text-slate-400 line-through">{lkr(e.oldSellPrice)}</p>
                  <p className="text-sm text-white font-medium">{lkr(e.newSellPrice)}</p>
                  <Delta old={e.oldSellPrice} next={e.newSellPrice} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
