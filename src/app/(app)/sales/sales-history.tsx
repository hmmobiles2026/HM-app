import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: unknown;
  unitCost: unknown;
  product: { name: string; brand: { name: string }; model: { name: string } | null };
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

export function SalesHistory({ sales, showFinancials }: Props) {
  if (sales.length === 0) {
    return (
      <p className="text-center text-slate-500 py-12 text-sm">No sales yet</p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {sales.map((sale) => (
        <div
          key={sale.id}
          className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <p className="text-white font-semibold text-sm">
                #{sale.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {sale.seller.name} ·{" "}
                {format(new Date(sale.createdAt), "dd MMM yyyy, h:mm a")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{lkr(sale.totalRevenue)}</p>
              {showFinancials && (
                <p className="text-xs text-emerald-400">
                  Profit: {lkr(sale.profit)}
                </p>
              )}
            </div>
          </div>
          <div className="px-4 py-2 space-y-1">
            {sale.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {item.product.brand.name}
                  {item.product.model ? ` ${item.product.model.name}` : ""} —{" "}
                  {item.product.name} × {item.quantity}
                </span>
                <span className="text-slate-400">{lkr(Number(item.unitPrice) * item.quantity)}</span>
              </div>
            ))}
            {sale.note && (
              <p className="text-xs text-slate-500 pt-1">{sale.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
