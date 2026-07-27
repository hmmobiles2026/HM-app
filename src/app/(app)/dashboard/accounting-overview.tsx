"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";

type MonthRow = {
  month: Date;
  revenue: number;
  cost: number;
  profit: number;
  count: number;
};

type PeriodStats = {
  revenue: number;
  cost: number;
  profit: number;
  count: number;
};

type Props = {
  accounting: {
    thisMonth: PeriodStats;
    lastMonth: PeriodStats;
    thisWeek: { revenue: number; profit: number; count: number };
    lastWeek: { revenue: number; profit: number; count: number };
    monthly: MonthRow[];
  };
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function lkrShort(n: number) {
  if (n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `LKR ${(n / 1_000).toFixed(1)}K`;
  return `LKR ${n.toFixed(0)}`;
}

function pct(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function ChangeBadge({ current, prev }: { current: number; prev: number }) {
  const change = pct(current, prev);
  if (change === null) return <span className="text-xs text-slate-500">—</span>;
  const up = change >= 0;
  const Icon = change === 0 ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function AccountingOverview({ accounting }: Props) {

  const { thisMonth, lastMonth, thisWeek, lastWeek, monthly } = accounting;
  const thisMargin = thisMonth.revenue > 0 ? (thisMonth.profit / thisMonth.revenue) * 100 : 0;
  const lastMargin = lastMonth.revenue > 0 ? (lastMonth.profit / lastMonth.revenue) * 100 : 0;
  const weekMargin = thisWeek.revenue > 0 ? (thisWeek.profit / thisWeek.revenue) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Month vs last month comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "This Month Revenue",
            value: lkr(thisMonth.revenue),
            sub: <ChangeBadge current={thisMonth.revenue} prev={lastMonth.revenue} />,
            subSuffix: " vs last month",
          },
          {
            label: "This Month Profit",
            value: lkr(thisMonth.profit),
            sub: <ChangeBadge current={thisMonth.profit} prev={lastMonth.profit} />,
            subSuffix: " vs last month",
          },
          {
            label: "Profit Margin",
            value: `${thisMargin.toFixed(1)}%`,
            sub: lastMargin > 0 ? (
              <ChangeBadge current={thisMargin} prev={lastMargin} />
            ) : <span className="text-xs text-slate-500">—</span>,
            subSuffix: " vs last month",
          },
          {
            label: "This Week Revenue",
            value: lkr(thisWeek.revenue),
            sub: <ChangeBadge current={thisWeek.revenue} prev={lastWeek.revenue} />,
            subSuffix: " vs last week",
          },
        ].map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-400 font-medium mb-2">{card.label}</p>
            <p className="text-lg font-bold text-white tabular-nums leading-tight">{card.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {card.sub}
              <span className="text-xs text-slate-500">{card.subSuffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* COGS strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-xs text-slate-500">This Month COGS</p>
          <p className="text-sm font-semibold text-white tabular-nums mt-0.5">{lkr(thisMonth.cost)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Last Month COGS</p>
          <p className="text-sm font-semibold text-slate-300 tabular-nums mt-0.5">{lkr(lastMonth.cost)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">This Month Sales Count</p>
          <p className="text-sm font-semibold text-white tabular-nums mt-0.5">{thisMonth.count} transactions</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Avg. Transaction</p>
          <p className="text-sm font-semibold text-white tabular-nums mt-0.5">
            {thisMonth.count > 0 ? lkr(thisMonth.revenue / thisMonth.count) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">This Week Margin</p>
          <p className="text-sm font-semibold text-white tabular-nums mt-0.5">{weekMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* 6-month P&L table */}
      {monthly.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-slate-300">6-Month P&amp;L</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left px-5 py-2.5 font-medium">Month</th>
                  <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                  <th className="text-right px-4 py-2.5 font-medium">COGS</th>
                  <th className="text-right px-4 py-2.5 font-medium">Profit</th>
                  <th className="text-right px-5 py-2.5 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {monthly.map((m) => {
                  const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
                  return (
                    <tr key={m.month.toString()} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 text-slate-300 font-medium">
                        {format(new Date(m.month), "MMM yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">{lkrShort(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{lkrShort(m.cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold tabular-nums">{lkrShort(m.profit)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className={`text-xs font-semibold ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
