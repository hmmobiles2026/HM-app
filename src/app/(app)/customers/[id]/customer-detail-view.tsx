"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  recordPayment,
  addAdjustment,
  setCustomerActive,
} from "@/app/actions/customers";
import type { LedgerRow } from "@/lib/customers";
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
  ArrowLeft,
  Store,
  Phone,
  Wallet,
  HandCoins,
  Receipt,
  CalendarClock,
  AlertTriangle,
  SlidersHorizontal,
  Power,
  Package,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  shopName: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  creditLimit: number | null;
};

type Summary = {
  outstanding: number;
  lifetimeBusiness: number;
  totalPaid: number;
  lastPaymentAt: Date | null;
};

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

const typeLabel: Record<LedgerRow["type"], string> = {
  CHARGE: "Credit sale",
  PAYMENT: "Payment",
  RETURN_CREDIT: "Return credit",
  ADJUSTMENT: "Adjustment",
};

const typeBadge: Record<LedgerRow["type"], string> = {
  CHARGE: "bg-blue-500/20 text-blue-300",
  PAYMENT: "bg-emerald-500/20 text-emerald-300",
  RETURN_CREDIT: "bg-amber-500/20 text-amber-300",
  ADJUSTMENT: "bg-purple-500/20 text-purple-300",
};

const methodLabel: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

/** A CHARGE's note repeats the sale reference already rendered as a link. */
function isRedundantNote(note: string, saleId: string | null): boolean {
  if (!saleId) return false;
  return note.trim().toUpperCase() === `SALE #${saleId.slice(-6).toUpperCase()}`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CustomerDetailView({
  customer,
  summary,
  ledger,
  canManage,
}: {
  customer: Customer;
  summary: Summary;
  ledger: LedgerRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [togglingActive, startToggle] = useTransition();

  const inAdvance = summary.outstanding < 0;
  const overLimit =
    customer.creditLimit !== null && summary.outstanding > customer.creditLimit;

  function toggleActive() {
    startToggle(async () => {
      const r = await setCustomerActive(customer.id, !customer.isActive);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(r?.success ?? "Updated.");
        router.refresh();
      }
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All customers
      </Link>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{customer.shopName}</h1>
              {!customer.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
              {customer.ownerName && <span>{customer.ownerName}</span>}
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </a>
              )}
              {!customer.ownerName && !customer.phone && <span>—</span>}
            </p>
          </div>
        </div>

        {!canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/customers/${customer.id}/statement`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 inline-flex items-center gap-1.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
            >
              <FileText className="h-4 w-4" />
              Statement
            </a>
          </div>
        )}
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setAdjustOpen(true)}
              variant="outline"
              className="h-10 border-slate-700 text-slate-300 hover:text-white rounded-xl gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Adjust</span>
            </Button>
            <Button
              onClick={toggleActive}
              disabled={togglingActive}
              variant="outline"
              className="h-10 border-slate-700 text-slate-300 hover:text-white rounded-xl gap-1.5"
            >
              <Power className="h-4 w-4" />
              <span className="hidden sm:inline">
                {customer.isActive ? "Deactivate" : "Reactivate"}
              </span>
            </Button>
            <a
              href={`/api/customers/${customer.id}/statement`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 inline-flex items-center gap-1.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
              title="Printable statement showing how this balance was built up"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Statement</span>
            </a>
            <Button
              onClick={() => setPayOpen(true)}
              className="h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-1.5"
            >
              <HandCoins className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        )}
      </div>

      {overLimit && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-950/50 border border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Over their credit limit by{" "}
            <span className="font-semibold">
              {lkr(summary.outstanding - customer.creditLimit!)}
            </span>
          </p>
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className={`rounded-2xl border p-4 ${
            inAdvance
              ? "bg-emerald-950/40 border-emerald-800"
              : summary.outstanding > 0
                ? "bg-blue-950/40 border-blue-800"
                : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {inAdvance ? "In advance" : "Outstanding"}
            </p>
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${
              inAdvance
                ? "text-emerald-300"
                : summary.outstanding > 0
                  ? "text-white"
                  : "text-slate-400"
            }`}
          >
            {lkr(Math.abs(summary.outstanding))}
          </p>
          {customer.creditLimit !== null && (
            <p className="text-xs text-slate-500 mt-0.5">
              limit {customer.creditLimit.toLocaleString("en-LK")}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lifetime business
            </p>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-200 tabular-nums">
            {lkr(summary.lifetimeBusiness)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-slate-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total paid
            </p>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-200 tabular-nums">
            {lkr(summary.totalPaid)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Last payment
            </p>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-200">
            {summary.lastPaymentAt ? fmtDate(summary.lastPaymentAt) : "—"}
          </p>
        </div>
      </div>

      {/* ── Ledger ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-slate-300 mb-3">History</h2>

        {ledger.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-500 rounded-2xl bg-slate-900 border border-slate-800">
            <Receipt className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Nothing yet</p>
            <p className="text-xs mt-1">
              Credit sales and payments will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold px-4 py-3">Date</th>
                    <th className="text-left font-semibold px-4 py-3">Type</th>
                    <th className="text-left font-semibold px-4 py-3">Details</th>
                    <th className="text-right font-semibold px-4 py-3">Amount</th>
                    <th className="text-right font-semibold px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => {
                    // CHARGE and a positive ADJUSTMENT increase the debt; everything
                    // else reduces it.
                    const increases =
                      row.type === "CHARGE" ||
                      (row.type === "ADJUSTMENT" && row.amount > 0);
                    const shown = Math.abs(row.amount);

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-800/60 last:border-0"
                      >
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {fmtDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${typeBadge[row.type]}`}
                          >
                            {typeLabel[row.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 min-w-[260px]">
                          {row.saleId && (
                            <Link
                              href={`/sales?tab=history&sale=${row.saleId}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                              title="Open this sale to view items or return one"
                            >
                              Sale #{row.saleId.slice(-6).toUpperCase()} &rarr;
                            </Link>
                          )}
                          {row.method && (
                            <span>{methodLabel[row.method] ?? row.method}</span>
                          )}

                          {/* The actual parts. Without these a charge is just a
                              reference number nobody can place months later. */}
                          {row.lines.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {row.lines.map((line, i) => (
                                <li
                                  key={`${row.id}-${i}`}
                                  className="text-xs text-slate-300 flex items-baseline gap-1.5"
                                >
                                  <Package className="h-3 w-3 text-slate-500 shrink-0 translate-y-0.5" />
                                  <span className="min-w-0">
                                    {line.label}
                                    <span className="text-slate-500">
                                      {" "}× {line.quantity}
                                      {line.unitPrice > 0 && (
                                        <> @ {line.unitPrice.toLocaleString("en-LK")}</>
                                      )}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* A CHARGE note is just "Sale #XXXXXX", already shown above. */}
                          {row.note && !isRedundantNote(row.note, row.saleId) && (
                            <span className="block text-xs text-slate-500 mt-1">
                              {row.note}
                            </span>
                          )}
                          <span className="block text-xs text-slate-600 mt-0.5">
                            by {row.createdByName}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                            increases ? "text-blue-300" : "text-emerald-300"
                          }`}
                        >
                          {increases ? "+" : "−"}
                          {shown.toLocaleString("en-LK")}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white tabular-nums whitespace-nowrap">
                          {row.balanceAfter.toLocaleString("en-LK")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {canManage && (
        <>
          <PaymentDialog
            key={payOpen ? "pay-open" : "pay-closed"}
            open={payOpen}
            customerId={customer.id}
            outstanding={summary.outstanding}
            onClose={() => setPayOpen(false)}
            onSaved={() => {
              setPayOpen(false);
              router.refresh();
            }}
          />
          <AdjustmentDialog
            key={adjustOpen ? "adj-open" : "adj-closed"}
            open={adjustOpen}
            customerId={customer.id}
            onClose={() => setAdjustOpen(false)}
            onSaved={() => {
              setAdjustOpen(false);
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

function PaymentDialog({
  open,
  customerId,
  outstanding,
  onClose,
  onSaved,
}: {
  open: boolean;
  customerId: string;
  outstanding: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : "");
  const [method, setMethod] = useState("CASH");

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      const result = await recordPayment(undefined, fd);
      if (result?.success) {
        toast.success(result.success);
        onSaved();
      }
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  const entered = Number(amount) || 0;
  const remaining = outstanding - entered;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Record Payment</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="method" value={method} />

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Currently owes</span>
            <span className="text-white font-semibold tabular-nums">
              {lkr(Math.max(0, outstanding))}
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Amount received
            </label>
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 h-12 mt-1.5">
              <span className="text-sm text-slate-400">LKR</span>
              <input
                name="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                autoFocus
                className="flex-1 bg-transparent text-white font-bold text-xl tabular-nums outline-none min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            {entered > 0 && (
              <p className="text-xs text-slate-400 mt-1.5 px-1">
                {remaining > 0 ? (
                  <>
                    Still owing after this:{" "}
                    <span className="text-white font-semibold">{lkr(remaining)}</span>
                  </>
                ) : remaining < 0 ? (
                  <span className="text-emerald-400">
                    Settles the account, {lkr(Math.abs(remaining))} left in advance
                  </span>
                ) : (
                  <span className="text-emerald-400">Settles the account exactly</span>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Method
            </label>
            <div className="grid grid-cols-4 gap-1.5 mt-1.5">
              {(["CASH", "BANK", "CHEQUE", "OTHER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`h-9 rounded-xl text-xs font-medium transition-colors ${
                    method === m
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {methodLabel[m]}
                </button>
              ))}
            </div>
          </div>

          <Input
            name="note"
            placeholder="Note (optional)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />

          <DialogFooter>
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
              disabled={pending || entered <= 0}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {pending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  open,
  customerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [amount, setAmount] = useState("");

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      // The stored amount is signed: negative reduces what they owe.
      const raw = Math.abs(Number(fd.get("amount")) || 0);
      fd.set("amount", String(direction === "increase" ? raw : -raw));
      const result = await addAdjustment(undefined, fd);
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
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Manual Adjustment</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-slate-400">
          For corrections only. History is never edited — this adds a new line that
          anyone can see.
        </p>

        <form action={action} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setDirection("decrease")}
              className={`h-10 rounded-xl text-sm font-medium transition-colors ${
                direction === "decrease"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Reduce debt
            </button>
            <button
              type="button"
              onClick={() => setDirection("increase")}
              className={`h-10 rounded-xl text-sm font-medium transition-colors ${
                direction === "increase"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Increase debt
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 h-12">
            <span className="text-sm text-slate-400">LKR</span>
            <input
              name="amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="flex-1 bg-transparent text-white font-bold text-xl tabular-nums outline-none min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <Input
            name="note"
            placeholder="Reason (required)"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />

          <DialogFooter>
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
              disabled={pending || !(Number(amount) > 0)}
              className="bg-purple-600 hover:bg-purple-500"
            >
              {pending ? "Saving…" : "Add Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
