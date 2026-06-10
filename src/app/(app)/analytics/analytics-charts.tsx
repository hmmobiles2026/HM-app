"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type PeriodPoint = { label: string; revenue: number; profit: number; cost: number };
type TopProduct = { name: string; quantity: number };
type BrandSale = { brandName: string; revenue: number; count: number };

type AnalyticsData = {
  dailyData: PeriodPoint[];
  weeklyData: PeriodPoint[];
  monthlyData: PeriodPoint[];
  topProducts: TopProduct[];
  brandSales: BrandSale[];
};

const TABS = [
  { key: "daily", label: "Daily (30d)" },
  { key: "weekly", label: "Weekly (12w)" },
  { key: "monthly", label: "Monthly (12m)" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: LKR {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1 max-w-[180px] truncate">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const [tab, setTab] = useState<TabKey>("daily");

  const periodData =
    tab === "daily" ? data.dailyData : tab === "weekly" ? data.weeklyData : data.monthlyData;

  const totalRevenue = periodData.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = periodData.reduce((s, d) => s + d.profit, 0);
  const totalCost = periodData.reduce((s, d) => s + d.cost, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400">Revenue</p>
          <p className="text-lg font-bold text-white mt-0.5">LKR {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400">Profit</p>
          <p className="text-lg font-bold text-emerald-400 mt-0.5">LKR {totalProfit.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400">Cost</p>
          <p className="text-lg font-bold text-amber-400 mt-0.5">LKR {totalCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-white">Revenue &amp; Profit Over Time</h2>
          <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={periodData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmt}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="cost"
              name="Cost"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
          <h2 className="text-sm font-semibold text-white">Top Products (30d)</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-slate-400 text-sm">No sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.topProducts}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                  tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="quantity" name="Units sold" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Brand breakdown */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
          <h2 className="text-sm font-semibold text-white">Revenue by Brand (30d)</h2>
          {data.brandSales.length === 0 ? (
            <p className="text-slate-400 text-sm">No sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.brandSales}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmt}
                />
                <YAxis
                  type="category"
                  dataKey="brandName"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="revenue" name="Revenue (LKR)" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
