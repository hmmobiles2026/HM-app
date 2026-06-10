import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: unknown;
  unitCost: unknown;
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
  totalRevenue: unknown;
  totalCost: unknown;
  profit: unknown;
  note: string | null;
  createdAt: Date;
  seller: { name: string };
  items: SaleItem[];
};

type Props = { sales: Sale[]; showFinancials: boolean };

function lkr(val: unknown) {
  return `LKR ${Number(val ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

const gradeColor: Record<string, string> = {
  ORIGINAL: "border-emerald-700 text-emerald-300",
  COPY_A: "border-blue-700 text-blue-300",
  COPY_B: "border-amber-700 text-amber-300",
  OTHER: "border-slate-700 text-slate-300",
};

export function SalesHistory({ sales, showFinancials }: Props) {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-slate-300">
        <Receipt className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No sales yet</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {sales.map((sale) => (
        <div
          key={sale.id}
          className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <div>
              <p className="text-white font-semibold text-sm tracking-wide">
                #{sale.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-slate-300 text-xs mt-0.5">
                {sale.seller.name} · {format(new Date(sale.createdAt), "dd MMM yyyy, h:mm a")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-base">{lkr(sale.totalRevenue)}</p>
              {showFinancials && (
                <p className="text-xs text-emerald-400 mt-0.5">
                  Profit {lkr(sale.profit)}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="px-4 py-3 space-y-2.5">
            {sale.items.map((item) => {
              const productLabel = `${item.product.brand.name}${item.product.model ? ` ${item.product.model.name}` : ""} — ${item.product.name}`;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  {/* Image */}
                  {item.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-10 w-10 rounded-lg object-cover bg-slate-800 shrink-0 ring-1 ring-slate-700"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                      <span className="text-slate-300 text-xs font-bold">
                        {item.product.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 text-sm font-medium truncate">{productLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0 ${gradeColor[item.product.qualityGrade] ?? "border-slate-700 text-slate-300"}`}
                      >
                        {item.product.qualityGrade === "ORIGINAL" ? "Original"
                          : item.product.qualityGrade === "COPY_A" ? "Copy A"
                          : item.product.qualityGrade === "COPY_B" ? "Copy B"
                          : "Other"}
                      </Badge>
                      <span className="text-slate-300 text-xs">× {item.quantity}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <p className="text-slate-200 text-sm font-medium shrink-0">
                    {lkr(Number(item.unitPrice) * item.quantity)}
                  </p>
                </div>
              );
            })}

            {sale.note && (
              <p className="text-slate-300 text-xs border-t border-slate-800 pt-2 mt-1">
                {sale.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
