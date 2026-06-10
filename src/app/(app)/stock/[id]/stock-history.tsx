import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";

type Movement = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  note: string | null;
  createdAt: Date;
  createdBy: { name: string };
};

const typeConfig = {
  IN: {
    icon: ArrowDownCircle,
    color: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    label: "Stock In",
  },
  OUT: {
    icon: ArrowUpCircle,
    color: "text-red-400",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
    label: "Stock Out",
  },
  ADJUSTMENT: {
    icon: RefreshCw,
    color: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    label: "Adjustment",
  },
};

export function StockHistory({
  movements,
}: {
  movements: Movement[];
  showCosts: boolean;
}) {
  if (movements.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-8 text-center">
        No stock movements yet
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {movements.map((m) => {
        const cfg = typeConfig[m.type];
        return (
          <div
            key={m.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800"
          >
            <cfg.icon className={`h-5 w-5 flex-shrink-0 ${cfg.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                  {cfg.label}
                </Badge>
                <span className="text-white font-semibold text-sm">
                  {m.type === "IN" ? "+" : m.type === "OUT" ? "−" : "~"}
                  {m.quantity}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {m.createdBy.name} ·{" "}
                {format(new Date(m.createdAt), "dd MMM yyyy, h:mm a")}
              </p>
              {m.note && (
                <p className="text-xs text-slate-400 mt-0.5">{m.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
