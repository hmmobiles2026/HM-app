import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

async function getPerformance() {
  const thirtyDaysAgo = subDays(startOfDay(new Date()), 29);

  const [soldItems, returnedItems, allProducts] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true },
      _count: { id: true },
    }),
    prisma.saleReturn.groupBy({
      by: ["saleItemId"],
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, model: true, category: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  // Map returns back to productId
  const saleItemToProduct: Record<string, string> = {};
  const saleItemsWithProduct = await prisma.saleItem.findMany({
    where: { id: { in: returnedItems.map((r) => r.saleItemId) } },
    select: { id: true, productId: true },
  });
  saleItemsWithProduct.forEach((si) => { saleItemToProduct[si.id] = si.productId; });

  const returnsByProduct: Record<string, number> = {};
  returnedItems.forEach((r) => {
    const pid = saleItemToProduct[r.saleItemId];
    if (pid) returnsByProduct[pid] = (returnsByProduct[pid] ?? 0) + (r._sum.quantity ?? 0);
  });

  const soldMap = Object.fromEntries(soldItems.map((s) => [s.productId, s._sum.quantity ?? 0]));

  // Revenue per product (30 days)
  const revenueData = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
    _sum: { quantity: true },
  });

  // Get actual revenue using unitPrice
  const revenueItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
    select: { productId: true, quantity: true, unitPrice: true, unitCost: true },
  });

  const revenueByProduct: Record<string, number> = {};
  const costByProduct: Record<string, number> = {};
  revenueItems.forEach((item) => {
    const rev = Number(item.unitPrice) * item.quantity;
    const cost = Number(item.unitCost) * item.quantity;
    revenueByProduct[item.productId] = (revenueByProduct[item.productId] ?? 0) + rev;
    costByProduct[item.productId] = (costByProduct[item.productId] ?? 0) + cost;
  });

  // Last sale date per product
  const lastSales = await prisma.saleItem.groupBy({
    by: ["productId"],
    _max: { sale: false } as never,
  });
  void lastSales; // fallback: use a different approach
  const lastSaleItems = await prisma.saleItem.findMany({
    distinct: ["productId"],
    orderBy: { sale: { createdAt: "desc" } },
    select: { productId: true, sale: { select: { createdAt: true } } },
  });
  const lastSaleMap = Object.fromEntries(
    lastSaleItems.map((i) => [i.productId, i.sale.createdAt])
  );

  return allProducts.map((p) => {
    const unitsSold = soldMap[p.id] ?? 0;
    const revenue = revenueByProduct[p.id] ?? 0;
    const cost = costByProduct[p.id] ?? 0;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : null;
    const returned = returnsByProduct[p.id] ?? 0;
    const returnRate = unitsSold > 0 ? (returned / unitsSold) * 100 : 0;
    const lastSale = lastSaleMap[p.id] ?? null;
    const daysSinceLastSale = lastSale
      ? Math.floor((Date.now() - new Date(lastSale).getTime()) / 86400000)
      : null;

    return {
      id: p.id,
      name: `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`,
      grade: p.qualityGrade,
      stockQty: p.stockQty,
      unitsSold,
      revenue,
      profit,
      margin,
      returnRate,
      daysSinceLastSale,
    };
  }).sort((a, b) => b.unitsSold - a.unitsSold);
}

const gradeColor: Record<string, string> = {
  ORIGINAL: "text-emerald-400",
  COPY_A: "text-blue-400",
  COPY_B: "text-amber-400",
  OTHER: "text-slate-400",
};

export default async function PerformancePage() {
  await verifyRole(["ADMIN", "OWNER"]);
  const rows = await getPerformance();
  const active = rows.filter((r) => r.unitsSold > 0);
  const inactive = rows.filter((r) => r.unitsSold === 0);

  function MarginIcon({ margin }: { margin: number | null }) {
    if (margin === null) return <Minus className="h-3.5 w-3.5 text-slate-500" />;
    if (margin >= 30) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (margin >= 15) return <Minus className="h-3.5 w-3.5 text-amber-400" />;
    return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Product Performance</h1>
        <p className="text-slate-400 text-sm mt-0.5">Last 30 days — units sold, revenue, margin, returns</p>
      </div>

      {/* Active products */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
          Selling ({active.length})
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_80px_110px_100px_80px_80px] gap-3 px-4 py-2.5 border-b border-slate-800 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span>Product</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Revenue</span>
            <span className="text-right">Margin</span>
            <span className="text-right">Returns</span>
            <span className="text-right">Last Sale</span>
          </div>
          <div className="divide-y divide-slate-800">
            {active.map((row) => (
              <div key={row.id} className="px-4 py-3">
                {/* Mobile layout */}
                <div className="md:hidden space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white leading-snug">{row.name}</p>
                    <span className={`text-xs shrink-0 ${gradeColor[row.grade]}`}>{row.grade.replace("_", " ")}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>Sold: <span className="text-white font-semibold">{row.unitsSold}</span></span>
                    <span>Rev: <span className="text-white">{lkr(row.revenue)}</span></span>
                    <span className="flex items-center gap-1">
                      <MarginIcon margin={row.margin} />
                      <span className={row.margin !== null && row.margin >= 30 ? "text-emerald-400" : row.margin !== null && row.margin >= 15 ? "text-amber-400" : "text-red-400"}>
                        {row.margin !== null ? `${row.margin.toFixed(1)}%` : "—"}
                      </span>
                    </span>
                    {row.returnRate > 0 && <span className="text-red-400">Returns: {row.returnRate.toFixed(0)}%</span>}
                    <span>{row.daysSinceLastSale !== null ? `${row.daysSinceLastSale}d ago` : "—"}</span>
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[1fr_80px_110px_100px_80px_80px] gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{row.name}</p>
                    <span className={`text-xs ${gradeColor[row.grade]}`}>{row.grade.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm font-semibold text-white text-right tabular-nums">{row.unitsSold}</p>
                  <p className="text-sm text-white text-right tabular-nums">{lkr(row.revenue)}</p>
                  <div className="flex items-center justify-end gap-1">
                    <MarginIcon margin={row.margin} />
                    <span className={`text-sm tabular-nums ${row.margin !== null && row.margin >= 30 ? "text-emerald-400" : row.margin !== null && row.margin >= 15 ? "text-amber-400" : "text-red-400"}`}>
                      {row.margin !== null ? `${row.margin.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <p className={`text-sm text-right tabular-nums ${row.returnRate > 0 ? "text-red-400" : "text-slate-500"}`}>
                    {row.returnRate > 0 ? `${row.returnRate.toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-400 text-right">
                    {row.daysSinceLastSale !== null ? `${row.daysSinceLastSale}d ago` : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* No sales in 30 days */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-1">
            No Sales in 30 Days ({inactive.length})
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {inactive.slice(0, 20).map((row) => (
              <div key={row.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <p className="text-sm text-slate-400 truncate">{row.name}</p>
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                  <span>{row.stockQty} in stock</span>
                  {row.daysSinceLastSale !== null
                    ? <span>{row.daysSinceLastSale}d since last sale</span>
                    : <span>Never sold</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
