import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";
import { DashboardCards } from "./dashboard-cards";
import { RecentSalesChart } from "./recent-sales-chart";
import { LowStockAlert } from "./low-stock-alert";
import { StockSnapshot } from "./stock-snapshot";
import { TopSelling } from "./top-selling";
import { SlowMoving } from "./slow-moving";
import { AccountingOverview } from "./accounting-overview";
import { PendingReturnsSummary } from "./pending-returns-summary";
import { CustomerDuesSummary } from "./customer-dues-summary";
import { getReceivablesSummary } from "@/lib/customers";
import { startOfDay, subDays, startOfWeek, startOfMonth, subMonths, endOfMonth, subWeeks, endOfWeek } from "date-fns";
import Link from "next/link";
import { ShieldAlert, ShieldOff } from "lucide-react";

async function getDashboardData(role: string) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thirtyDaysAgo = subDays(today, 30);
  const thisMonthStart = startOfMonth(new Date());
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [
    todaySales,
    weekSales,
    totalProducts,
    lowStockProducts,
    last30DaysSales,
    stockAggregate,
    outOfStockCount,
    stockByCategory,
    stockByGrade,
    inventoryValueResult,
    topSelling,
    slowMoving,
    pendingReturnsAgg,
    thisMonthAgg,
    lastMonthAgg,
    lastWeekAgg,
    monthlySummary,
    receivables,
    yesterdaySales,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalRevenue: true, profit: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: weekStart } },
      _sum: { totalRevenue: true, profit: true },
      _count: true,
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.$queryRaw<
      {
        id: string;
        name: string;
        stockQty: number;
        lowStockThreshold: number;
        brandName: string;
        modelName: string | null;
      }[]
    >`
      SELECT p.id, p.name, p."stockQty", p."lowStockThreshold",
             b.name as "brandName", pm.name as "modelName"
      FROM "Product" p
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PhoneModel" pm ON pm.id = p."modelId"
      WHERE p."isActive" = true AND p."stockQty" <= p."lowStockThreshold"
      ORDER BY p."stockQty" ASC
      LIMIT 5
    `,
    prisma.sale.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        totalRevenue: true,
        totalCost: true,
        profit: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _sum: { stockQty: true },
    }),
    prisma.product.count({ where: { isActive: true, stockQty: 0 } }),
    prisma.category.findMany({
      include: {
        products: {
          where: { isActive: true },
          select: { stockQty: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.product.groupBy({
      by: ["qualityGrade"],
      where: { isActive: true },
      _sum: { stockQty: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<[{ totalValue: string | null }]>`
      SELECT SUM("stockQty" * "costPrice") as "totalValue"
      FROM "Product"
      WHERE "isActive" = true
    `,
    // Top selling products (last 30 days)
    prisma.$queryRaw<{ id: string; name: string; brandName: string; modelName: string | null; imageUrl: string | null; totalQty: number; totalRevenue: string }[]>`
      SELECT p.id, p.name, b.name as "brandName", pm.name as "modelName", p."imageUrl",
             SUM(si.quantity)::int as "totalQty",
             SUM(si.quantity * si."unitPrice")::text as "totalRevenue"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PhoneModel" pm ON pm.id = p."modelId"
      WHERE s."createdAt" >= ${thirtyDaysAgo}
      GROUP BY p.id, p.name, b.name, pm.name, p."imageUrl"
      ORDER BY "totalQty" DESC
      LIMIT 8
    `,
    // Slow-moving: in stock but no sales in last 30 days
    prisma.$queryRaw<{ id: string; name: string; brandName: string; modelName: string | null; stockQty: number; costPrice: string; qualityGrade: string }[]>`
      SELECT p.id, p.name, b.name as "brandName", pm.name as "modelName",
             p."stockQty", p."costPrice"::text, p."qualityGrade"
      FROM "Product" p
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PhoneModel" pm ON pm.id = p."modelId"
      WHERE p."isActive" = true AND p."stockQty" > 0
        AND p.id NOT IN (
          SELECT DISTINCT si."productId"
          FROM "SaleItem" si
          JOIN "Sale" s ON s.id = si."saleId"
          WHERE s."createdAt" >= ${thirtyDaysAgo}
        )
      ORDER BY (p."stockQty" * p."costPrice") DESC
      LIMIT 10
    `,
    // Pending supplier returns
    prisma.saleReturn.aggregate({
      where: { returnType: "SUPPLIER_RETURN", supplierStatus: "PENDING" },
      _count: true,
      _sum: { costRecovery: true },
    }),
    // This month sales
    prisma.sale.aggregate({
      where: { createdAt: { gte: thisMonthStart } },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    // Last month sales
    prisma.sale.aggregate({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    // Last week sales (for week comparison)
    prisma.sale.aggregate({
      where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } },
      _sum: { totalRevenue: true, profit: true },
      _count: true,
    }),
    // 6-month monthly P&L
    prisma.$queryRaw<{ month: Date; revenue: string; cost: string; profit: string; count: string }[]>`
      SELECT DATE_TRUNC('month', "createdAt") as month,
             SUM("totalRevenue")::text as revenue,
             SUM("totalCost")::text as cost,
             SUM("profit")::text as profit,
             COUNT(*)::text as count
      FROM "Sale"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `,
    // Customer credit. Sits alongside the figures above and never alters them.
    getReceivablesSummary(),
    // Yesterday, for the change shown on today's tiles. Bounded on both sides so it
    // is strictly yesterday, not "everything before today".
    prisma.sale.aggregate({
      where: { createdAt: { gte: subDays(today, 1), lt: today } },
      _sum: { totalRevenue: true, profit: true },
      _count: true,
    }),
  ]);

  return {
    todaySales: {
      ...todaySales,
      _sum: {
        totalRevenue: todaySales._sum.totalRevenue?.toNumber() ?? 0,
        profit: todaySales._sum.profit?.toNumber() ?? 0,
      },
    },
    weekSales: {
      ...weekSales,
      _sum: {
        totalRevenue: weekSales._sum.totalRevenue?.toNumber() ?? 0,
        profit: weekSales._sum.profit?.toNumber() ?? 0,
      },
    },
    yesterdaySales: {
      totalRevenue: yesterdaySales._sum.totalRevenue?.toNumber() ?? 0,
      profit: yesterdaySales._sum.profit?.toNumber() ?? 0,
      count: yesterdaySales._count,
    },
    totalProducts,
    lowStockProducts,
    last30DaysSales: last30DaysSales.map((s) => ({
      ...s,
      totalRevenue: s.totalRevenue.toNumber(),
      totalCost: s.totalCost.toNumber(),
      profit: s.profit.toNumber(),
    })),
    showFinancials: role === "ADMIN" || role === "OWNER",
    topSelling: topSelling.map((p) => ({
      ...p,
      totalRevenue: Number(p.totalRevenue),
    })),
    slowMoving: slowMoving.map((p) => ({
      ...p,
      costPrice: Number(p.costPrice),
    })),
    pendingReturns: {
      count: pendingReturnsAgg._count,
      value: pendingReturnsAgg._sum.costRecovery?.toNumber() ?? 0,
    },
    receivables,
    accounting: {
      thisMonth: {
        revenue: thisMonthAgg._sum.totalRevenue?.toNumber() ?? 0,
        cost: thisMonthAgg._sum.totalCost?.toNumber() ?? 0,
        profit: thisMonthAgg._sum.profit?.toNumber() ?? 0,
        count: thisMonthAgg._count,
      },
      lastMonth: {
        revenue: lastMonthAgg._sum.totalRevenue?.toNumber() ?? 0,
        cost: lastMonthAgg._sum.totalCost?.toNumber() ?? 0,
        profit: lastMonthAgg._sum.profit?.toNumber() ?? 0,
        count: lastMonthAgg._count,
      },
      thisWeek: {
        revenue: weekSales._sum.totalRevenue?.toNumber() ?? 0,
        profit: weekSales._sum.profit?.toNumber() ?? 0,
        count: weekSales._count,
      },
      lastWeek: {
        revenue: lastWeekAgg._sum.totalRevenue?.toNumber() ?? 0,
        profit: lastWeekAgg._sum.profit?.toNumber() ?? 0,
        count: lastWeekAgg._count,
      },
      monthly: monthlySummary.map((m) => ({
        month: m.month,
        revenue: Number(m.revenue),
        cost: Number(m.cost),
        profit: Number(m.profit),
        count: Number(m.count),
      })),
    },
    stockSnapshot: {
      totalUnits: stockAggregate._sum.stockQty ?? 0,
      outOfStock: outOfStockCount,
      inventoryValue: Number(inventoryValueResult[0]?.totalValue ?? 0),
      byCategory: stockByCategory
        .map((c) => ({
          name: c.name,
          units: c.products.reduce((s, p) => s + p.stockQty, 0),
          skus: c.products.length,
        }))
        .filter((c) => c.skus > 0)
        .sort((a, b) => b.units - a.units),
      byGrade: stockByGrade.map((g) => ({
        grade: g.qualityGrade,
        units: g._sum.stockQty ?? 0,
        skus: g._count._all,
      })),
    },
  };
}

export default async function DashboardPage() {
  const session = await verifySession();
  const [data, license] = await Promise.all([
    getDashboardData(session.role),
    getLicenseStatus(),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {license.trialNotStarted && session.role === "ADMIN" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl">
          <ShieldAlert className="h-5 w-5 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-300">Free trial not started</p>
            <p className="text-xs text-slate-500 mt-0.5">Activate the trial to enable Telegram alerts</p>
          </div>
          <Link href="/settings" className="text-xs text-slate-300 underline shrink-0">Activate →</Link>
        </div>
      )}
      {license.expired && !license.trialNotStarted && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-950/60 border border-red-800 rounded-2xl">
          <ShieldOff className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">Telegram alerts disabled — license expired</p>
            <p className="text-xs text-red-400/80 mt-0.5">Contact HM Stocks support to renew (LKR 2,000 / 3 months)</p>
          </div>
          {session.role === "ADMIN" && (
            <Link href="/settings" className="text-xs text-red-300 underline shrink-0">Activate →</Link>
          )}
        </div>
      )}
      {!license.trialNotStarted && !license.expired && license.warningSoon && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/60 border border-amber-800 rounded-2xl">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">
              {license.isTrial ? "Free trial" : "License"} expires in {license.daysLeft} day{license.daysLeft !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">Renew to keep Telegram alerts active (LKR 2,000 / 3 months)</p>
          </div>
          {session.role === "ADMIN" && (
            <Link href="/settings" className="text-xs text-amber-300 underline shrink-0">Renew →</Link>
          )}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-white">
          Welcome back, {session.name}
        </h1>
        <p className="text-slate-300 text-sm mt-0.5">
          Here&apos;s what&apos;s happening at HM Stocks today.
        </p>
      </div>

      <DashboardCards data={data} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RecentSalesChart sales={data.last30DaysSales} showFinancials={data.showFinancials} />
        </div>
        <div>
          <LowStockAlert products={data.lowStockProducts} />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-300 mb-3">Stock Snapshot</h2>
        <StockSnapshot
          totalUnits={data.stockSnapshot.totalUnits}
          outOfStock={data.stockSnapshot.outOfStock}
          inventoryValue={data.stockSnapshot.inventoryValue}
          byCategory={data.stockSnapshot.byCategory}
          byGrade={data.stockSnapshot.byGrade}
          showFinancials={data.showFinancials}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-300 mb-3">Top Selling (Last 30 Days)</h2>
          <TopSelling products={data.topSelling} showFinancials={data.showFinancials} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-300 mb-3">Slow-Moving Stock</h2>
          <SlowMoving products={data.slowMoving} showFinancials={data.showFinancials} />
        </div>
      </div>

      {data.showFinancials && (
        <>
          <div>
            <h2 className="text-base font-semibold text-slate-300 mb-3">Accounting Overview</h2>
            <AccountingOverview accounting={data.accounting} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-300 mb-3">Pending Supplier Returns</h2>
              <PendingReturnsSummary
                count={data.pendingReturns.count}
                value={data.pendingReturns.value}
              />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-300 mb-3">Customer Dues</h2>
              <CustomerDuesSummary
                totalOutstanding={data.receivables.totalOutstanding}
                shopsWithDues={data.receivables.shopsWithDues}
                overdue30={data.receivables.overdue30}
                collectedThisMonth={data.receivables.collectedThisMonth}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
