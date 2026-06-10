"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ChartPoint = { label: string; revenue: number; profit: number; cost: number };

type Props = {
  data: {
    dailyData: ChartPoint[];
    weeklyData: ChartPoint[];
    monthlyData: ChartPoint[];
    topProducts: { name: string; quantity: number }[];
    brandSales: { brandName: string; revenue: number }[];
  };
};

const BRAND_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4",
];

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

const tooltipContentStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  color: "#fff",
  fontSize: 12,
};

function RevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={45} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(v) => `LKR ${Number(v ?? 0).toLocaleString("en-LK")}`}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#g1)" />
        <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} fill="url(#g2)" />
        <Area type="monotone" dataKey="cost" name="Cost" stroke="#f59e0b" strokeWidth={1.5} fill="url(#g3)" strokeDasharray="4 2" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsCharts({ data }: Props) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  const chartData =
    period === "daily"
      ? data.dailyData.slice(-14)
      : period === "weekly"
        ? data.weeklyData
        : data.monthlyData;

  const totals = chartData.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      profit: acc.profit + d.profit,
      cost: acc.cost + d.cost,
    }),
    { revenue: 0, profit: 0, cost: 0 }
  );

  const margin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Revenue", val: totals.revenue, color: "text-blue-400" },
          { label: "Cost", val: totals.cost, color: "text-amber-400" },
          { label: "Profit", val: totals.profit, color: "text-emerald-400" },
          { label: "Margin", val: null, str: `${margin}%`, color: "text-violet-400" },
        ].map((c) => (
          <Card key={c.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className={`text-base font-bold mt-1 ${c.color}`}>
                {c.str ?? `LKR ${fmt(c.val!)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main revenue chart */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm font-semibold">
              Revenue / Profit / Cost
            </CardTitle>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors capitalize ${
                    period === p
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RevenueChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top products */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm font-semibold">
              Top Products (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.topProducts}
                layout="vertical"
                margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  formatter={(v) => [`${Number(v ?? 0)} units`, "Qty"]}
                />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Brand breakdown */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm font-semibold">
              Revenue by Brand (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.brandSales}
                  dataKey="revenue"
                  nameKey="brandName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {data.brandSales.map((_, i) => (
                    <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  formatter={(v) => `LKR ${Number(v ?? 0).toLocaleString("en-LK")}`}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
