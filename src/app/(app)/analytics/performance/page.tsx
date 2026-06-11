import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

async function getPerformance() {
  const thirtyDaysAgo = subDays(startOfDay(new Date()), 29);

  const [soldItems, returnedItems, allProducts, revenueItems, lastSaleItems] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true },
    }),
    prisma.saleReturn.groupBy({
      by: ["saleItemId"],
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, model: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
      select: { productId: true, quantity: true, unitPrice: true, unitCost: true },
    }),
    prisma.saleItem.findMany({
      distinct: ["productId"],
      orderBy: { sale: { createdAt: "desc" } },
      select: { productId: true, sale: { select: { createdAt: true } } },
    }),
  ]);

  // Revenue / cost per product
  const revenueByProduct: Record<string, number> = {};
  const costByProduct: Record<string, number> = {};
  for (const item of revenueItems) {
    const rev = Number(item.unitPrice) * item.quantity;
    const cost = Number(item.unitCost) * item.quantity;
    revenueByProduct[item.productId] = (revenueByProduct[item.productId] ?? 0) + rev;
    costByProduct[item.productId] = (costByProduct[item.productId] ?? 0) + cost;
  }

  // Units sold map
  const soldMap = Object.fromEntries(soldItems.map((s) => [s.productId, s._sum.quantity ?? 0]));

  // Last sale date
  const lastSaleMap = Object.fromEntries(lastSaleItems.map((i) => [i.productId, i.sale.createdAt]));

  // Map returns → productId (returns reference saleItemId, not productId directly)
  const returnSaleItemIds = returnedItems.map((r) => r.saleItemId);
  const returnSaleItems = returnSaleItemIds.length > 0
    ? await prisma.saleItem.findMany({
        where: { id: { in: returnSaleItemIds } },
        select: { id: true, productId: true },
      })
    : [];
  const saleItemToProduct = Object.fromEntries(returnSaleItems.map((si) => [si.id, si.productId]));

  const returnsByProduct: Record<string, number> = {};
  for (const r of returnedItems) {
    const pid = saleItemToProduct[r.saleItemId];
    if (pid) returnsByProduct[pid] = (returnsByProduct[pid] ?? 0) + (r._sum.quantity ?? 0);
  }

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

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-slate-500">—</span>;
  const color = margin >= 30 ? "text-emerald-400" : margin >= 15 ? "text-amber-400" : "text-red-400";
  const Icon = margin >= 30 ? TrendingUp : margin >= 15 ? Minus : TrendingDown;
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {margin.toFixed(1)}%
    </span>
  );
}

export default async function PerformancePage() {
  await verifyRole(["ADMIN", "OWNER"]);
  const rows = await getPerformance();
  const active = rows.filter((r) => r.unitsSold > 0);
  const inactive = rows.filter((r) => r.unitsSold === 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Product Performance</h1>
        <p className="text-slate-400 text-sm mt-0.5">Last 30 days — units sold, revenue, margin, returns</p>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-500">
          <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No sales recorded in the last 30 days</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
            Selling ({active.length})
          </p>

          {/* Desktop table */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3 w-20">Sold</th>
                  <th className="text-right px-4 py-3 w-32">Revenue</th>
                  <th className="text-right px-4 py-3 w-32">Profit</th>
                  <th className="text-right px-4 py-3 w-28">Margin</th>
                  <th className="text-right px-4 py-3 w-24">Returns</th>
                  <th className="text-right px-4 py-3 w-28">Last Sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {active.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium truncate max-w-xs">{row.name}</p>
                      <span className={`text-xs ${gradeColor[row.grade]}`}>{gradeLabel[row.grade]}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{row.unitsSold}</td>
                    <td className="px-4 py-3 text-right text-slate-200 tabular-nums">{lkr(row.revenue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{lkr(row.profit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex justify-end">
                        <MarginBadge margin={row.margin} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.returnRate > 0
                        ? <span className="text-red-400">{row.returnRate.toFixed(0)}%</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs tabular-nums">
                      {row.daysSinceLastSale !== null ? `${row.daysSinceLastSale}d ago` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {active.map((row) => (
              <div key={row.id} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white leading-snug">{row.name}</p>
                  <span className={`text-xs shrink-0 ${gradeColor[row.grade]}`}>{gradeLabel[row.grade]}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Sold</p>
                    <p className="text-white font-semibold">{row.unitsSold}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Revenue</p>
                    <p className="text-white">{lkr(row.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Margin</p>
                    <MarginBadge margin={row.margin} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-1">
            No Sales in 30 Days ({inactive.length})
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {inactive.slice(0, 20).map((row) => (
              <div key={row.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-400 truncate">{row.name}</p>
                  <span className={`text-xs ${gradeColor[row.grade]}`}>{gradeLabel[row.grade]}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500">
                  <span>{row.stockQty} in stock</span>
                  <span>{row.daysSinceLastSale !== null ? `${row.daysSinceLastSale}d ago` : "Never sold"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
