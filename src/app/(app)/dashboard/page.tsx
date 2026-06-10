import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { DashboardCards } from "./dashboard-cards";
import { RecentSalesChart } from "./recent-sales-chart";
import { LowStockAlert } from "./low-stock-alert";
import { startOfDay, subDays, startOfWeek } from "date-fns";

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
  const data = await getDashboardData(session.role);

  return (
    <div className="p-4 md:p-6 space-y-6">
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
