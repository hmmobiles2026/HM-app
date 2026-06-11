import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Package, TrendingUp, DollarSign, BarChart3 } from "lucide-react";

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 0 })}`;
}

async function getValuation() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      costPrice: true,
      sellingPrice: true,
      stockQty: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  let totalCostValue = 0;
  let totalSellValue = 0;
  let totalUnits = 0;

  const byBrand: Record<string, { costValue: number; sellValue: number; units: number }> = {};
  const byCategory: Record<string, { costValue: number; sellValue: number; units: number }> = {};

  for (const p of products) {
    const cost = Number(p.costPrice) * p.stockQty;
    const sell = Number(p.sellingPrice) * p.stockQty;
    totalCostValue += cost;
    totalSellValue += sell;
    totalUnits += p.stockQty;

    const bn = p.brand.name;
    byBrand[bn] = byBrand[bn] ?? { costValue: 0, sellValue: 0, units: 0 };
    byBrand[bn].costValue += cost;
    byBrand[bn].sellValue += sell;
    byBrand[bn].units += p.stockQty;

    const cn = p.category.name;
    byCategory[cn] = byCategory[cn] ?? { costValue: 0, sellValue: 0, units: 0 };
    byCategory[cn].costValue += cost;
    byCategory[cn].sellValue += sell;
    byCategory[cn].units += p.stockQty;
  }

  const brandRows = Object.entries(byBrand)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sellValue - a.sellValue);

  const categoryRows = Object.entries(byCategory)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sellValue - a.sellValue);

  return {
    totalCostValue,
    totalSellValue,
    totalUnits,
    totalProducts: products.length,
    potentialProfit: totalSellValue - totalCostValue,
    brandRows,
    categoryRows,
  };
}

export default async function ValuationPage() {
  await verifyRole(["ADMIN", "OWNER"]);
  const data = await getValuation();
  const margin = data.totalSellValue > 0
    ? ((data.potentialProfit / data.totalSellValue) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white">Stock Valuation</h1>
        <p className="text-slate-400 text-sm mt-0.5">Total value of inventory at cost and selling price</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Package, label: "Total Units", value: data.totalUnits.toLocaleString("en-LK"), sub: `${data.totalProducts} products`, color: "text-blue-400" },
          { icon: DollarSign, label: "Cost Value", value: lkr(data.totalCostValue), sub: "Capital invested", color: "text-amber-400" },
          { icon: TrendingUp, label: "Selling Value", value: lkr(data.totalSellValue), sub: "If all sold at list price", color: "text-emerald-400" },
          { icon: BarChart3, label: "Potential Profit", value: lkr(data.potentialProfit), sub: `${margin}% margin`, color: "text-purple-400" },
        ].map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <c.icon className={`h-5 w-5 ${c.color} mb-2`} />
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-white font-bold text-lg leading-tight mt-0.5">{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By brand */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">By Brand</p>
          </div>
          <div className="divide-y divide-slate-800">
            {data.brandRows.map((row) => {
              const pct = data.totalSellValue > 0 ? (row.sellValue / data.totalSellValue) * 100 : 0;
              return (
                <div key={row.name} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{row.name}</span>
                    <span className="text-xs text-slate-400">{row.units} units</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Cost: {lkr(row.costValue)}</span>
                    <span className="text-emerald-400 font-medium">{lkr(row.sellValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By category */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">By Category</p>
          </div>
          <div className="divide-y divide-slate-800">
            {data.categoryRows.map((row) => {
              const pct = data.totalSellValue > 0 ? (row.sellValue / data.totalSellValue) * 100 : 0;
              return (
                <div key={row.name} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{row.name}</span>
                    <span className="text-xs text-slate-400">{row.units} units</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Cost: {lkr(row.costValue)}</span>
                    <span className="text-emerald-400 font-medium">{lkr(row.sellValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
