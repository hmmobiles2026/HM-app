"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type Props = {
  data: {
    todaySales: {
      _sum: { totalRevenue: unknown; profit: unknown };
      _count: number;
    };
    yesterdaySales: { totalRevenue: number; profit: number; count: number };
    weekSales: { _sum: { totalRevenue: unknown; profit: unknown } };
    totalProducts: number;
    lowStockProducts: unknown[];
    showFinancials: boolean;
  };
};

function fmt(val: unknown) {
  const n = Number(val ?? 0);
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Change = { pct: number; up: boolean } | null;

/**
 * Percentage change against yesterday.
 *
 * Returns null when a percentage would be meaningless rather than showing a made-up
 * number: there is nothing to compare against when yesterday was zero, and a
 * percentage off a negative base (a loss-making day) reads backwards.
 */
function changeVsYesterday(today: number, yesterday: number): Change {
  if (yesterday <= 0) return null;
  const pct = ((today - yesterday) / yesterday) * 100;
  if (!Number.isFinite(pct)) return null;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function ChangeChip({ change }: { change: Change }) {
  if (!change) return null;
  const Icon = change.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${
        change.up ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {change.pct.toFixed(1)}%
    </span>
  );
}

export function DashboardCards({ data }: Props) {
  // Sellers see transaction counts rather than money, so compare counts for them.
  const salesChange = data.showFinancials
    ? changeVsYesterday(
        Number(data.todaySales._sum.totalRevenue ?? 0),
        data.yesterdaySales.totalRevenue
      )
    : changeVsYesterday(data.todaySales._count, data.yesterdaySales.count);

  const profitChange = changeVsYesterday(
    Number(data.todaySales._sum.profit ?? 0),
    data.yesterdaySales.profit
  );

  const cards = [
    {
      label: "Today's Sales",
      value: data.showFinancials
        ? fmt(data.todaySales._sum.totalRevenue)
        : `${data.todaySales._count} items`,
      sub: `${data.todaySales._count} transaction${data.todaySales._count !== 1 ? "s" : ""}`,
      change: salesChange,
      icon: ShoppingCart,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    ...(data.showFinancials
      ? [
          {
            label: "Today's Profit",
            value: fmt(data.todaySales._sum.profit),
            sub: "Net profit today",
            change: profitChange,
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Week Revenue",
            value: fmt(data.weekSales._sum.totalRevenue),
            sub: "This week total",
            change: null as Change,
            icon: DollarSign,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
        ]
      : []),
    {
      label: "Total Products",
      value: String(data.totalProducts),
      sub: "Active SKUs",
      change: null as Change,
      icon: Package,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Low Stock Items",
      value: String(data.lowStockProducts.length),
      sub: "Need restocking",
      change: null as Change,
      icon: AlertTriangle,
      color:
        data.lowStockProducts.length > 0 ? "text-red-400" : "text-slate-400",
      bg:
        data.lowStockProducts.length > 0
          ? "bg-red-500/10"
          : "bg-slate-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-slate-300 text-xs font-medium">{card.label}</p>
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-white font-bold text-lg leading-tight">
              {card.value}
            </p>
            <p className="text-slate-300 text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
              {card.change && (
                <>
                  <ChangeChip change={card.change} />
                  <span className="text-slate-500">vs yesterday</span>
                  <span className="text-slate-700">·</span>
                </>
              )}
              <span>{card.sub}</span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
