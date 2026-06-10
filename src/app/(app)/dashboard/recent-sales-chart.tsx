"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, startOfDay } from "date-fns";

type Sale = {
  totalRevenue: unknown;
  totalCost: unknown;
  profit: unknown;
  createdAt: Date;
};

type Props = {
  sales: Sale[];
  showFinancials: boolean;
};

export function RecentSalesChart({ sales, showFinancials }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const label = format(date, "EEE dd");
    const daySales = sales.filter((s) => {
      const d = startOfDay(new Date(s.createdAt));
      return d.getTime() === date.getTime();
    });
    const revenue = daySales.reduce((a, s) => a + Number(s.totalRevenue), 0);
    const profit = daySales.reduce((a, s) => a + Number(s.profit), 0);
    const cost = daySales.reduce((a, s) => a + Number(s.totalCost), 0);
    return { label, revenue, profit, cost };
  });

  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm font-semibold">
          Last 7 Days — Sales Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={days} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmt}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                color: "#fff",
                fontSize: 12,
              }}
              formatter={(value) =>
                `LKR ${Number(value ?? 0).toLocaleString("en-LK")}`
              }
            />
            {showFinancials && <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#revenue)"
            />
            {showFinancials && (
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#profit)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
