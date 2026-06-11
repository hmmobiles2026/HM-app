import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import { AlertTriangle, PackageSearch, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const LEAD_DAYS = 14;   // days of stock considered "safe buffer"
const ORDER_DAYS = 30;  // how many days of stock to suggest ordering

async function getReorderSuggestions() {
  const thirtyDaysAgo = subDays(startOfDay(new Date()), 29);

  const [soldItems, products] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, model: true, category: true },
    }),
  ]);

  const soldMap = Object.fromEntries(soldItems.map((s) => [s.productId, s._sum.quantity ?? 0]));

  const rows = products.map((p) => {
    const soldLast30 = soldMap[p.id] ?? 0;
    const dailyVelocity = soldLast30 / 30;
    const daysUntilOut = dailyVelocity > 0 ? Math.floor(p.stockQty / dailyVelocity) : null;
    const suggestedQty = dailyVelocity > 0 ? Math.ceil(dailyVelocity * ORDER_DAYS) : null;
    const urgent = daysUntilOut !== null && daysUntilOut <= LEAD_DAYS;
    const outOfStock = p.stockQty === 0 && soldLast30 > 0;

    return {
      id: p.id,
      name: `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`,
      grade: p.qualityGrade,
      stockQty: p.stockQty,
      soldLast30,
      dailyVelocity,
      daysUntilOut,
      suggestedQty,
      urgent,
      outOfStock,
      costPrice: Number(p.costPrice),
    };
  });

  const needsReorder = rows
    .filter((r) => r.outOfStock || (r.daysUntilOut !== null && r.daysUntilOut <= LEAD_DAYS))
    .sort((a, b) => {
      if (a.outOfStock && !b.outOfStock) return -1;
      if (!a.outOfStock && b.outOfStock) return 1;
      return (a.daysUntilOut ?? 999) - (b.daysUntilOut ?? 999);
    });

  const watchlist = rows
    .filter((r) => !r.outOfStock && r.daysUntilOut !== null && r.daysUntilOut > LEAD_DAYS && r.daysUntilOut <= 30)
    .sort((a, b) => (a.daysUntilOut ?? 999) - (b.daysUntilOut ?? 999));

  return { needsReorder, watchlist, totalProducts: products.length };
}

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original", COPY_A: "Copy A", COPY_B: "Copy B", OTHER: "Other",
};
const gradeBadge: Record<string, string> = {
  ORIGINAL: "bg-emerald-500/20 text-emerald-300",
  COPY_A: "bg-blue-500/20 text-blue-300",
  COPY_B: "bg-amber-500/20 text-amber-300",
  OTHER: "bg-slate-500/20 text-slate-300",
};

function UrgencyBadge({ daysUntilOut, outOfStock }: { daysUntilOut: number | null; outOfStock: boolean }) {
  if (outOfStock) return <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">OUT OF STOCK</span>;
  if (daysUntilOut !== null && daysUntilOut <= 3) return <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">≤3 days left</span>;
  if (daysUntilOut !== null && daysUntilOut <= 7) return <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{daysUntilOut} days left</span>;
  return <span className="text-xs font-semibold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{daysUntilOut} days left</span>;
}

export default async function ReorderPage() {
  await verifyRole(["ADMIN", "OWNER"]);
  const { needsReorder, watchlist } = await getReorderSuggestions();

  const totalReorderCost = needsReorder.reduce(
    (s, r) => s + r.costPrice * (r.suggestedQty ?? 0), 0
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Reorder Suggestions</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Based on 30-day sales velocity · suggests {ORDER_DAYS}-day supply
          </p>
        </div>
        {needsReorder.length > 0 && (
          <div className="rounded-xl bg-amber-950/40 border border-amber-900/50 px-4 py-2 text-sm">
            <span className="text-slate-400">Est. reorder cost: </span>
            <span className="text-amber-300 font-bold">LKR {totalReorderCost.toLocaleString("en-LK")}</span>
          </div>
        )}
      </div>

      {needsReorder.length === 0 && watchlist.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-500">
          <CheckCircle2 className="h-12 w-12 mb-3 text-emerald-500/50" />
          <p className="text-base font-medium text-slate-400">All stocked up</p>
          <p className="text-sm mt-1">No products need reordering in the next {LEAD_DAYS} days</p>
        </div>
      ) : (
        <>
          {/* Needs reorder now */}
          {needsReorder.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                  Reorder Now ({needsReorder.length})
                </p>
              </div>
              <div className="space-y-2">
                {needsReorder.map((row) => (
                  <div key={row.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white leading-snug">{row.name}</p>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${gradeBadge[row.grade]}`}>
                          {gradeLabel[row.grade]}
                        </span>
                      </div>
                      <UrgencyBadge daysUntilOut={row.daysUntilOut} outOfStock={row.outOfStock} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500">In stock</p>
                        <p className="text-sm font-semibold text-white">{row.stockQty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Sold (30d)</p>
                        <p className="text-sm font-semibold text-white">{row.soldLast30}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Daily rate</p>
                        <p className="text-sm font-semibold text-white">
                          {row.dailyVelocity > 0 ? row.dailyVelocity.toFixed(1) : "—"}/day
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Suggest order</p>
                        <p className="text-sm font-bold text-blue-400">
                          {row.suggestedQty ? `${row.suggestedQty} units` : "—"}
                        </p>
                      </div>
                    </div>
                    {row.suggestedQty && (
                      <p className="text-xs text-slate-500 mt-2">
                        Est. cost: LKR {(row.costPrice * row.suggestedQty).toLocaleString("en-LK")} at current cost price
                      </p>
                    )}
                    <Link href={`/stock/${row.id}?tab=stock-in`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      <PackageSearch className="h-3.5 w-3.5" />
                      Add stock →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watchlist */}
          {watchlist.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
                Watch — Running Low Soon ({watchlist.length})
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
                {watchlist.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{row.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.stockQty} in stock · {row.soldLast30} sold last 30d
                      </p>
                    </div>
                    <UrgencyBadge daysUntilOut={row.daysUntilOut} outOfStock={false} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
