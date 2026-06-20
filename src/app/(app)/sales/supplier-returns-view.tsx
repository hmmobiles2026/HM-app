"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveSupplierReturn } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Truck, CheckCircle2, Clock, Download, Package, ArrowRight } from "lucide-react";
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
    product: {
      name: string;
      brand: { name: string };
      model: { name: string } | null;
      partBrand: { name: string } | null;
    };
    sale: { id: string; createdAt: Date };
  };
};

function lkr(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function MarkReturnedButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function confirm() {
    start(async () => {
      const r = await resolveSupplierReturn(id);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Marked as returned to supplier.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-700/50 transition-colors"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mark as Returned
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Return</DialogTitle>
            <DialogDescription className="text-slate-400">
              This confirms the item was physically handed back to the supplier. It will move to History.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2 flex-row justify-end">
            <button
              onClick={() => setOpen(false)}
              className="h-9 px-4 text-sm rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <Button
              disabled={pending}
              onClick={confirm}
              className="bg-emerald-600 hover:bg-emerald-500 h-9"
            >
              {pending ? "Saving…" : "Yes, Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PendingCard({ r, isAdmin }: { r: SupplierReturn; isAdmin: boolean }) {
  const p = r.saleItem.product;
  const saleRef = r.saleItem.sale.id.slice(-6).toUpperCase();
  const partLabel = [p.brand.name, p.model?.name].filter(Boolean).join(" ");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Top colour strip */}
      <div className="h-1 bg-amber-500/60" />

      <div className="p-4 space-y-3">
        {/* Row 1: product + cost */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{p.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{partLabel}</p>
            {p.partBrand && (
              <p className="text-xs text-slate-500">{p.partBrand.name}</p>
            )}
          </div>
          {r.costRecovery != null && (
            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-500 leading-none mb-0.5">Claim</p>
              <p className="text-base font-bold text-amber-300 leading-none">{lkr(r.costRecovery)}</p>
            </div>
          )}
        </div>

        {/* Row 2: chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
            <Package className="h-3 w-3" /> Qty {r.quantity}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
            Sale #{saleRef}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700">
            {format(new Date(r.saleItem.sale.createdAt), "dd MMM yyyy")}
          </span>
        </div>

        {/* Row 3: supplier + reason */}
        <div className="space-y-1">
          {r.supplier && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <Truck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>{r.supplier.name}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 italic">&ldquo;{r.reason}&rdquo;</p>
        </div>

        {/* Row 4: date + action */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <p className="text-xs text-slate-500">{format(new Date(r.createdAt), "dd MMM yyyy · HH:mm")}</p>
          {isAdmin && <MarkReturnedButton id={r.id} />}
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ r }: { r: SupplierReturn }) {
  const p = r.saleItem.product;
  const saleRef = r.saleItem.sale.id.slice(-6).toUpperCase();
  const isResolved = r.supplierStatus === "RESOLVED";

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden ${isResolved ? "border-emerald-900/50" : "border-slate-800"}`}>
      <div className={`h-0.5 ${isResolved ? "bg-emerald-600/50" : "bg-amber-500/40"}`} />
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate">{p.name}</p>
              <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                isResolved
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/50"
                  : "bg-amber-900/40 text-amber-300 border border-amber-800/50"
              }`}>
                {isResolved ? "Returned" : "Pending"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {[p.brand.name, p.model?.name].filter(Boolean).join(" ")}
              {p.partBrand ? ` · ${p.partBrand.name}` : ""}
            </p>
          </div>
          {r.costRecovery != null && (
            <p className="text-sm font-bold text-amber-300 shrink-0">{lkr(r.costRecovery)}</p>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>Qty {r.quantity}</span>
          <span className="text-slate-600">·</span>
          <span>Sale #{saleRef}</span>
          {r.supplier && (
            <>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />{r.supplier.name}
              </span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
          <p className="text-xs text-slate-500">{format(new Date(r.createdAt), "dd MMM yyyy")}</p>
          {isResolved && r.resolvedAt && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <ArrowRight className="h-3 w-3" />
              Returned {format(new Date(r.resolvedAt), "dd MMM yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const totalPending = pending.reduce((s, r) => s + (r.costRecovery ?? 0), 0);

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-slate-600">
        <Truck className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">No supplier returns yet</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="pending" className="mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <TabsList className="bg-slate-900 border border-slate-800 h-9">
          <TabsTrigger value="pending" className="text-sm text-white data-active:bg-amber-600 data-active:text-white h-7 px-4">
            Pending
            {pending.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-700 text-amber-100 font-medium">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-sm text-white data-active:bg-slate-700 data-active:text-white h-7 px-4">
            History
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 font-medium">
              {returns.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Pending tab */}
      <TabsContent value="pending" className="space-y-3">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-600 border border-slate-800 rounded-2xl border-dashed">
            <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">All caught up — no pending returns</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="rounded-2xl bg-amber-950/40 border border-amber-800/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">
                    {pending.length} pending claim{pending.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-500 leading-none">Total to recover</p>
                  <p className="text-base font-bold text-amber-200 leading-tight">{lkr(totalPending)}</p>
                </div>
              </div>
            </div>

            {/* Cards — 1 col mobile, 2 col desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pending.map((r) => (
                <PendingCard key={r.id} r={r} isAdmin={isAdmin} />
              ))}
            </div>
          </>
        )}
      </TabsContent>

      {/* History tab */}
      <TabsContent value="history" className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{returns.length} total record{returns.length !== 1 ? "s" : ""}</p>
          <a
            href="/api/backup/supplier-returns"
            download
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {returns.map((r) => (
            <HistoryCard key={r.id} r={r} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
