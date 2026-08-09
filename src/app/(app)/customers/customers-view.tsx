"use client";

import { useState, useActionState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCustomer, updateCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Store,
  Search,
  AlertTriangle,
  Wallet,
  Users,
  Clock,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export type CustomerRow = {
  id: string;
  shopName: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  creditLimit: number | null;
  balance: number;
  lastPaymentAt: Date | null;
};

type Summary = {
  totalOutstanding: number;
  shopsWithDues: number;
  overdue30: number;
  collectedThisMonth: number;
};

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone: "blue" | "amber" | "emerald" | "slate";
}) {
  const toneClass = {
    blue: "text-blue-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    slate: "text-slate-300",
  }[tone];

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneClass}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
      </div>
      <p className={`mt-2 text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

export function CustomersView({
  customers,
  summary,
  canManage,
}: {
  customers: CustomerRow[];
  summary: Summary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (!c.isActive && !showInactive) return false;
      if (!q) return true;
      return (
        c.shopName.toLowerCase().includes(q) ||
        c.ownerName?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      );
    });
  }, [customers, query, showInactive]);

  const inactiveCount = customers.filter((c) => !c.isActive).length;

  return (
    <div className="space-y-5">
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Outstanding"
          value={lkr(summary.totalOutstanding)}
          hint="Money out on the street"
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Shops with dues"
          value={String(summary.shopsWithDues)}
          icon={Users}
          tone="slate"
        />
        <StatCard
          label="Over 30 days"
          value={lkr(summary.overdue30)}
          hint="Owed the longest"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Collected this month"
          value={lkr(summary.collectedThisMonth)}
          hint="Credit customers only"
          icon={Wallet}
          tone="emerald"
        />
      </div>

      {/* ── Search + add ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shop, owner or phone…"
            className="h-11 pl-9 rounded-xl bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        {canManage && (
          <Button
            onClick={() => setAddOpen(true)}
            className="h-11 bg-blue-600 hover:bg-blue-500 rounded-xl gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Customer</span>
          </Button>
        )}
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filtered.map((c) => {
          const overLimit = c.creditLimit !== null && c.balance > c.creditLimit;
          const inAdvance = c.balance < 0;

          return (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <Link
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {c.shopName}
                    </p>
                    {!c.isActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 shrink-0">
                        Inactive
                      </span>
                    )}
                    {overLimit && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                        <AlertTriangle className="h-3 w-3" />
                        Over limit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {c.phone ?? c.ownerName ?? "—"}
                    {c.lastPaymentAt && (
                      <>
                        {" · "}last paid{" "}
                        {new Date(c.lastPaymentAt).toLocaleDateString("en-LK", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </>
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      inAdvance
                        ? "text-emerald-400"
                        : c.balance > 0
                          ? "text-white"
                          : "text-slate-500"
                    }`}
                  >
                    {inAdvance ? lkr(Math.abs(c.balance)) : lkr(c.balance)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {inAdvance
                      ? "in advance"
                      : c.creditLimit !== null
                        ? `limit ${c.creditLimit.toLocaleString("en-LK")}`
                        : "no limit"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
              </Link>

              {canManage && (
                <button
                  onClick={() => setEditing(c)}
                  aria-label={`Edit ${c.shopName}`}
                  className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-14 text-slate-500">
            <Store className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">
              {query ? "No shops match that search" : "No customers yet"}
            </p>
            {!query && canManage && (
              <p className="text-xs mt-1">Add a shop to start selling on credit</p>
            )}
          </div>
        )}

        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="w-full text-xs text-slate-500 hover:text-slate-300 py-2 transition-colors"
          >
            {showInactive
              ? "Hide inactive"
              : `Show ${inactiveCount} inactive customer${inactiveCount > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {canManage && (
        <>
          <CustomerDialog
            key={addOpen ? "add-open" : "add-closed"}
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSaved={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
          <CustomerDialog
            key={editing?.id ?? "edit-closed"}
            open={!!editing}
            customer={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

function CustomerDialog({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer?: CustomerRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!customer;

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      const result = isEdit
        ? await updateCustomer(customer!.id, undefined, fd)
        : await createCustomer(undefined, fd);
      if (result?.success) {
        toast.success(result.success);
        onSaved();
      }
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? `Edit ${customer!.shopName}` : "Add Customer"}
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-2.5">
          <Input
            name="shopName"
            defaultValue={customer?.shopName ?? ""}
            placeholder="Shop name e.g. Nimal Mobile"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Input
            name="ownerName"
            defaultValue={customer?.ownerName ?? ""}
            placeholder="Owner name (optional)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            placeholder="Phone (optional)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Input
            name="address"
            defaultValue={customer?.address ?? ""}
            placeholder="Address (optional)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <div>
            <Input
              name="creditLimit"
              type="number"
              min={0}
              step="0.01"
              defaultValue={customer?.creditLimit ?? ""}
              onFocus={(e) => e.target.select()}
              placeholder="Credit limit (optional)"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1 px-1">
              You get a warning past this, but the sale is never blocked.
            </p>
          </div>
          <Input
            name="note"
            defaultValue={customer?.note ?? ""}
            placeholder="Note (optional)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
