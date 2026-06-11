"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { ReturnButton } from "./return-button";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  returnedQty: number;
  product: {
    name: string;
    imageUrl: string | null;
    qualityGrade: string;
    brand: { name: string };
    model: { name: string } | null;
  };
};

type Sale = {
  id: string;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  note: string | null;
  createdAt: Date;
  seller: { name: string };
  items: SaleItem[];
};

type Props = { sales: Sale[]; showFinancials: boolean };

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

const gradeColor: Record<string, string> = {
  ORIGINAL: "border-emerald-700 text-emerald-300",
  COPY_A: "border-blue-700 text-blue-300",
  COPY_B: "border-amber-700 text-amber-300",
  OTHER: "border-slate-700 text-slate-300",
};

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

function SaleRow({ sale, showFinancials }: { sale: Sale; showFinancials: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header row — desktop table-like, mobile stacked */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
      >
        {/* Desktop */}
        <div className="hidden md:grid md:grid-cols-[120px_1fr_140px_130px_130px_36px] items-center gap-4 px-5 py-4 hover:bg-slate-800/50 transition-colors">
          <div>
            <p className="text-xs font-mono font-bold text-white">#{sale.id.slice(-8).toUpperCase()}</p>
            <p className="text-xs text-slate-500 mt-0.5">{sale.items.length} item{sale.items.length > 1 ? "s" : ""}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-300 truncate">{sale.seller.name}</p>
            <p className="text-xs text-slate-500">{format(new Date(sale.createdAt), "dd MMM yyyy, h:mm a")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white tabular-nums">{lkr(sale.totalRevenue)}</p>
            {showFinancials && <p className="text-xs text-slate-400 tabular-nums">Cost: {lkr(sale.totalCost)}</p>}
          </div>
          {showFinancials ? (
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-400 tabular-nums">{lkr(sale.profit)}</p>
              <p className="text-xs text-slate-500">
                {sale.totalRevenue > 0 ? ((sale.profit / sale.totalRevenue) * 100).toFixed(1) : "0.0"}% margin
              </p>
            </div>
          ) : <div />}
          {sale.note ? (
            <p className="text-xs text-slate-500 truncate italic">{sale.note}</p>
          ) : <div />}
          <div className="flex justify-end">
            {expanded
              ? <ChevronUp className="h-4 w-4 text-slate-500" />
              : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
          <div>
            <p className="text-white font-semibold text-sm">#{sale.id.slice(-8).toUpperCase()}</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {sale.seller.name} · {format(new Date(sale.createdAt), "dd MMM, h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white font-bold text-sm">{lkr(sale.totalRevenue)}</p>
              {showFinancials && <p className="text-xs text-emerald-400">{lkr(sale.profit)}</p>}
            </div>
            {expanded
              ? <ChevronUp className="h-4 w-4 text-slate-500" />
              : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </div>
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-slate-800">
          {/* Desktop items table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left px-5 py-2.5 font-medium">Product</th>
                  <th className="text-right px-4 py-2.5 font-medium w-24">Grade</th>
                  <th className="text-right px-4 py-2.5 font-medium w-20">Qty</th>
                  <th className="text-right px-4 py-2.5 font-medium w-32">Unit Price</th>
                  <th className="text-right px-4 py-2.5 font-medium w-32">Subtotal</th>
                  {showFinancials && <th className="text-right px-4 py-2.5 font-medium w-28">Profit</th>}
                  <th className="text-right px-5 py-2.5 font-medium w-28">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sale.items.map((item) => {
                  const label = `${item.product.brand.name}${item.product.model ? ` ${item.product.model.name}` : ""} — ${item.product.name}`;
                  const subtotal = Number(item.unitPrice) * item.quantity;
                  const itemProfit = (Number(item.unitPrice) - Number(item.unitCost)) * item.quantity;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {item.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.product.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 ring-1 ring-slate-700" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-slate-400">{item.product.name.charAt(0)}</span>
                            </div>
                          )}
                          <p className="text-white font-medium truncate max-w-xs">{label}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className={`text-xs ${gradeColor[item.product.qualityGrade]}`}>
                          {gradeLabel[item.product.qualityGrade] ?? "Other"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">× {item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{lkr(Number(item.unitPrice))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{lkr(subtotal)}</td>
                      {showFinancials && (
                        <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{lkr(itemProfit)}</td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <ReturnButton
                          saleItemId={item.id}
                          maxQty={item.quantity - item.returnedQty}
                          productName={item.product.name}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/30">
                  <td colSpan={4} className="px-5 py-3 text-xs text-slate-500">
                    {sale.note && <span className="italic">Note: {sale.note}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{lkr(sale.totalRevenue)}</td>
                  {showFinancials && (
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 tabular-nums">{lkr(sale.profit)}</td>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile items */}
          <div className="md:hidden px-4 py-3 space-y-3">
            {sale.items.map((item) => {
              const label = `${item.product.brand.name}${item.product.model ? ` ${item.product.model.name}` : ""} — ${item.product.name}`;
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    {item.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 ring-1 ring-slate-700" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-400">{item.product.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${gradeColor[item.product.qualityGrade]}`}>
                          {gradeLabel[item.product.qualityGrade] ?? "Other"}
                        </Badge>
                        <span className="text-xs text-slate-400">× {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white tabular-nums">{lkr(Number(item.unitPrice) * item.quantity)}</p>
                      <ReturnButton saleItemId={item.id} maxQty={item.quantity - item.returnedQty} productName={item.product.name} />
                    </div>
                  </div>
                </div>
              );
            })}
            {sale.note && (
              <p className="text-xs text-slate-500 italic pt-2 border-t border-slate-800">{sale.note}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesHistory({ sales, showFinancials }: Props) {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-slate-500">
        <Receipt className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No sales yet</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Desktop column headers */}
      <div className="hidden md:grid md:grid-cols-[120px_1fr_140px_130px_130px_36px] gap-4 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <span>Sale ID</span>
        <span>Seller / Date</span>
        <span className="text-right">Revenue</span>
        {showFinancials ? <span className="text-right">Profit</span> : <span />}
        <span>Note</span>
        <span />
      </div>

      {sales.map((sale) => (
        <SaleRow key={sale.id} sale={sale} showFinancials={showFinancials} />
      ))}
    </div>
  );
}
