import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AnalyticsCharts } from "./analytics-charts";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
} from "date-fns";

async function getAnalyticsData() {
  const now = new Date();
  const thirtyDaysAgo = subDays(startOfDay(now), 29);
  const twelveWeeksAgo = startOfWeek(subWeeks(now, 11), { weekStartsOn: 5 });
  const twelveMonthsAgo = startOfMonth(subMonths(now, 11));

  const [sales, topProducts, brandSales] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { totalRevenue: true, totalCost: true, profit: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<{ brandName: string; revenue: number; count: bigint }[]>`
      SELECT b.name as "brandName",
             SUM(s."totalRevenue")::float as revenue,
             COUNT(s.id) as count
      FROM "Sale" s
      JOIN "SaleItem" si ON si."saleId" = s.id
      JOIN "Product" p ON p.id = si."productId"
      JOIN "Brand" b ON b.id = p."brandId"
      WHERE s."createdAt" >= ${thirtyDaysAgo}
      GROUP BY b.name
      ORDER BY revenue DESC
      LIMIT 6
    `,
  ]);

  // Top products with names
  const topProductDetails = await prisma.product.findMany({
    where: { id: { in: topProducts.map((t) => t.productId) } },
    include: { brand: true, model: true },
  });

  const topProductsWithNames = topProducts.map((t) => {
    const p = topProductDetails.find((d) => d.id === t.productId);
    return {
      name: p
        ? `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}`
        : "Unknown",
      quantity: t._sum.quantity ?? 0,
    };
  });

  // Daily data (last 30 days)
  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: startOfDay(now) });
  const dailyData = days.map((day) => {
    const daySales = sales.filter((s) => {
      const d = startOfDay(new Date(s.createdAt));
      return d.getTime() === day.getTime();
    });
    return {
      label: format(day, "dd MMM"),
      revenue: daySales.reduce((a, s) => a + Number(s.totalRevenue), 0),
      profit: daySales.reduce((a, s) => a + Number(s.profit), 0),
      cost: daySales.reduce((a, s) => a + Number(s.totalCost), 0),
    };
  });

  // Weekly data (last 12 weeks)
  const weeks = eachWeekOfInterval(
    { start: twelveWeeksAgo, end: now },
    { weekStartsOn: 5 }
  );
  const weeklyData = weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekSales = sales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= weekStart && d <= weekEnd;
    });
    return {
      label: format(weekStart, "dd MMM"),
      revenue: weekSales.reduce((a, s) => a + Number(s.totalRevenue), 0),
      profit: weekSales.reduce((a, s) => a + Number(s.profit), 0),
      cost: weekSales.reduce((a, s) => a + Number(s.totalCost), 0),
    };
  });

  // Monthly data (last 12 months)
  const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: now });
  const monthlyData = months.map((monthStart) => {
    const monthEnd = startOfMonth(subMonths(monthStart, -1));
    const monthSales = sales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= monthStart && d < monthEnd;
    });
    return {
      label: format(monthStart, "MMM yy"),
      revenue: monthSales.reduce((a, s) => a + Number(s.totalRevenue), 0),
      profit: monthSales.reduce((a, s) => a + Number(s.profit), 0),
      cost: monthSales.reduce((a, s) => a + Number(s.totalCost), 0),
    };
  });

  return {
    dailyData,
    weeklyData,
    monthlyData,
    topProducts: topProductsWithNames,
    brandSales: brandSales.map((b) => ({ brandName: b.brandName, revenue: Number(b.revenue), count: Number(b.count) })),
  };
}

export default async function AnalyticsPage() {
  await verifyRole(["ADMIN", "OWNER"]);
  const data = await getAnalyticsData();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Revenue, cost, and profit breakdown</p>
        </div>
        <Link href="/analytics/performance"
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          <TrendingUp className="h-4 w-4" />
          Product Performance →
        </Link>
      </div>
      <AnalyticsCharts data={data} />
    </div>
  );
}
