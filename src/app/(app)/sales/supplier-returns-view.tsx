"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveSupplierReturn } from "@/app/actions/returns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Truck, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

type SupplierReturn = {
  id: string;
  quantity: number;
  reason: string;
  costRecovery: number | null;
  supplierStatus: "PENDING" | "RESOLVED" | null;
  resolvedAt: Date | null;
  createdAt: Date;
  supplier: { name: string } | null;
  saleItem: {
    product: { name: string; brand: { name: string }; model: { name: string } | null };
    sale: { id: string; createdAt: Date };
  };
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function ResolveButton({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!isAdmin) return null;
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resolveSupplierReturn(id);
          if (r?.error) toast.error(r.error);
          else { toast.success("Marked as resolved."); router.refresh(); }
        })
      }
      className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1"
    >
      <CheckCircle2 className="h-3 w-3" />
      {pending ? "…" : "Resolve"}
    </Button>
  );
}

export function SupplierReturnsView({
  returns,
  isAdmin,
}: {
  returns: SupplierReturn[];
  isAdmin: boolean;
}) {
  const pending = returns.filter((r) => r.supplierStatus === "PENDING");
  const resolved = returns.filter((r) => r.supplierStatus === "RESOLVED");

  const totalPending = pending.reduce((s, r) => s + (r.costRecovery ?? 0), 0);

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-slate-500">
        <Truck className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No supplier returns yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      {pending.length > 0 && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-800/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">{pending.length} pending claim{pending.length !== 1 ? "s" : ""}</span>
          </div>
          <span className="text-sm font-bold text-amber-200">{lkr(totalPending)}</span>
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Pending" items={pending} isAdmin={isAdmin} />
      )}
      {resolved.length > 0 && (
        <Section title="Resolved" items={resolved} isAdmin={false} />
      )}
    </div>
  );
}

function Section({ title, items, isAdmin }: { title: string; items: SupplierReturn[]; isAdmin: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">{title}</p>
      {items.map((r) => {
        const product = r.saleItem.product;
        const label = [product.brand.name, product.model?.name, product.name].filter(Boolean).join(" — ");
        const saleRef = r.saleItem.sale.id.slice(-6).toUpperCase();

        return (
          <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-white truncate">{label}</p>
                <p className="text-xs text-slate-400">
                  Qty {r.quantity} · Sale #{saleRef} · {format(new Date(r.saleItem.sale.createdAt), "dd MMM yyyy")}
                </p>
                <p className="text-xs text-slate-300">Reason: {r.reason}</p>
                {r.supplier && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Truck className="h-3 w-3 inline" /> {r.supplier.name}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 space-y-1.5">
                {r.costRecovery != null && (
                  <p className="text-sm font-bold text-amber-300">{lkr(r.costRecovery)}</p>
                )}
                <Badge
                  variant="outline"
                  className={
                    r.supplierStatus === "PENDING"
                      ? "border-amber-700 text-amber-300 text-xs"
                      : "border-emerald-700 text-emerald-300 text-xs"
                  }
                >
                  {r.supplierStatus === "PENDING" ? "Pending" : "Resolved"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{format(new Date(r.createdAt), "dd MMM yyyy HH:mm")}</p>
              {r.supplierStatus === "PENDING" && <ResolveButton id={r.id} isAdmin={isAdmin} />}
              {r.resolvedAt && (
                <p className="text-xs text-emerald-500">Resolved {format(new Date(r.resolvedAt), "dd MMM yyyy")}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
