import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";
import { DashboardCards } from "./dashboard-cards";
import { RecentSalesChart } from "./recent-sales-chart";
import { LowStockAlert } from "./low-stock-alert";
import { startOfDay, subDays, startOfWeek } from "date-fns";
import Link from "next/link";
import { ShieldAlert, ShieldOff } from "lucide-react";

async function getDashboardData(role: string) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thirtyDaysAgo = subDays(today, 30);

  const [
    todaySales,
    weekSales,
    totalProducts,
    lowStockProducts,
    last7DaysSales,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalRevenue: true, profit: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: weekStart } },
      _sum: { totalRevenue: true, profit: true },
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
    totalProducts,
    lowStockProducts,
    last7DaysSales: last7DaysSales.map((s) => ({
      ...s,
      totalRevenue: s.totalRevenue.toNumber(),
      totalCost: s.totalCost.toNumber(),
      profit: s.profit.toNumber(),
    })),
    showFinancials: role === "ADMIN" || role === "OWNER",
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
          <RecentSalesChart sales={data.last7DaysSales} showFinancials={data.showFinancials} />
        </div>
        <div>
          <LowStockAlert products={data.lowStockProducts} />
        </div>
      </div>
    </div>
  );
}
