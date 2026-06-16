"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recoverProduct } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, RotateCcw, Clock } from "lucide-react";
import type { Brand, Category, PhoneModel } from "@/generated/prisma/client";

type DeletedProduct = {
  id: string;
  name: string;
  deletedAt: Date | null;
  brand: Brand;
  model: PhoneModel | null;
  category: Category;
};

function hoursLeft(deletedAt: Date | null): number {
  if (!deletedAt) return 0;
  const expiresAt = new Date(deletedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
}

function expiryLabel(deletedAt: Date | null): { text: string; color: string } {
  const hours = hoursLeft(deletedAt);
  if (hours <= 24) return { text: `${hours}h left`, color: "text-red-400" };
  const days = Math.ceil(hours / 24);
  return { text: `${days} day${days !== 1 ? "s" : ""} left`, color: "text-amber-400" };
}

export function DeletedProducts({ products }: { products: DeletedProduct[] }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [recovering, startRecover] = useTransition();
  const router = useRouter();

  const confirmProduct = confirmId ? products.find((p) => p.id === confirmId) : null;

  function handleRecover() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    startRecover(async () => {
      const result = await recoverProduct(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Product recovered."); router.refresh(); }
    });
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-6">
      {/* Recover confirmation dialog */}
      <Dialog open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <DialogContent showCloseButton={false} className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Recover product?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {confirmProduct
                ? `${confirmProduct.brand.name}${confirmProduct.model ? ` ${confirmProduct.model.name}` : ""} — ${confirmProduct.name}`
                : ""}
            </span>{" "}
            will be restored and visible in stock again.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={recovering}
              onClick={handleRecover}
            >
              {recovering ? "Recovering…" : "Yes, Recover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 mb-3">
        <Trash2 className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-medium text-slate-400">
          Recently Deleted ({products.length})
        </h2>
        <span className="text-xs text-slate-500">— recoverable within 3 days</span>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {/* Desktop */}
        <table className="w-full text-sm hidden md:table">
          <tbody className="divide-y divide-slate-800/50">
            {products.map((p) => {
              const expiry = expiryLabel(p.deletedAt);
              return (
                <tr key={p.id} className="bg-slate-950 opacity-60 hover:opacity-80 transition-opacity">
                  <td className="px-4 py-3">
                    <p className="text-slate-300 font-medium">
                      {p.brand.name}{p.model ? ` ${p.model.name}` : ""} — {p.name}
                    </p>
                    <p className="text-xs text-slate-500">{p.category.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmId(p.id)}
                      className="h-7 text-xs border-emerald-800 text-emerald-400 hover:bg-emerald-950 hover:border-emerald-700 gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Recover
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-slate-800/50">
          {products.map((p) => {
            const expiry = expiryLabel(p.deletedAt);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-slate-950 opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm font-medium truncate">
                    {p.brand.name}{p.model ? ` ${p.model.name}` : ""} — {p.name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmId(p.id)}
                  className="h-7 text-xs border-emerald-800 text-emerald-400 hover:bg-emerald-950 gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Recover
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
