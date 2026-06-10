"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

type Props = {
  data: {
    todaySales: {
      _sum: { totalRevenue: unknown; profit: unknown };
      _count: number;
    };
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

export function DashboardCards({ data }: Props) {
  const cards = [
    {
      label: "Today's Sales",
      value: data.showFinancials
        ? fmt(data.todaySales._sum.totalRevenue)
        : `${data.todaySales._count} items`,
      sub: `${data.todaySales._count} transaction${data.todaySales._count !== 1 ? "s" : ""}`,
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
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Week Revenue",
            value: fmt(data.weekSales._sum.totalRevenue),
            sub: "This week total",
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
      icon: Package,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Low Stock Items",
      value: String(data.lowStockProducts.length),
      sub: "Need restocking",
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
              <p className="text-slate-400 text-xs font-medium">{card.label}</p>
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-white font-bold text-lg leading-tight">
              {card.value}
            </p>
            <p className="text-slate-300 text-xs mt-0.5">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
