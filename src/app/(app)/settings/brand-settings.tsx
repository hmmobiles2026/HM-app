"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createBrand, deleteBrand, recoverBrand } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Tag, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";

type Model = { id: string; name: string; deletedAt: Date | null };
type Brand = { id: string; name: string; deletedAt: Date | null; models: Model[] };

function hoursLeft(deletedAt: Date | null): number {
  if (!deletedAt) return 0;
  const exp = new Date(deletedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 3600000));
}
function expiryLabel(deletedAt: Date | null) {
  const h = hoursLeft(deletedAt);
  if (h <= 24) return { text: `${h}h left`, color: "text-red-400" };
  return { text: `${Math.ceil(h / 24)}d left`, color: "text-amber-400" };
}

export function BrandSettings({
  brands,
  deletedBrands,
  isAdmin,
}: {
  brands: Brand[];
  deletedBrands: Brand[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [recoverId, setRecoverId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [recovering, startRecover] = useTransition();

  const deleteTarget = deleteId ? brands.find((b) => b.id === deleteId) : null;
  const recoverTarget = recoverId ? deletedBrands.find((b) => b.id === recoverId) : null;

  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createBrand(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startDelete(async () => {
      const r = await deleteBrand(id);
      if (r?.error) toast.error(r.error);
      else { toast.success(r?.success ?? "Moved to trash."); router.refresh(); }
    });
  }

  function handleRecover() {
    if (!recoverId) return;
    const id = recoverId;
    setRecoverId(null);
    startRecover(async () => {
      const r = await recoverBrand(id);
      if (r?.error) toast.error(r.error);
      else { toast.success(r?.success ?? "Recovered."); router.refresh(); }
    });
  }

  return (
    <div className="mt-4 max-w-md space-y-5">

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent showCloseButton={false} className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete brand?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{deleteTarget?.name}</span> and all its models will be moved to trash. You can recover them within 3 days.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recover confirmation */}
      <Dialog open={!!recoverId} onOpenChange={(o) => { if (!o) setRecoverId(null); }}>
        <DialogContent showCloseButton={false} className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Recover brand?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{recoverTarget?.name}</span> and all its models will be restored.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setRecoverId(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={recovering} onClick={handleRecover}>
              {recovering ? "Recovering…" : "Yes, Recover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add form */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Add New Brand</p>
        <form action={action} className="flex gap-2">
          <Input
            name="name"
            placeholder="e.g. Samsung, Redmi, Apple"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1"
          />
          <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 px-3 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Active list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 px-1">
          {brands.length} Brand{brands.length !== 1 ? "s" : ""}
        </p>
        {brands.map((b) => (
          <div key={b.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-slate-300 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{b.name}</p>
                <p className="text-xs text-slate-300">{b.models.filter(m => !m.deletedAt).length} model{b.models.filter(m => !m.deletedAt).length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setDeleteId(b.id)}
                className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {brands.length === 0 && (
          <p className="text-slate-300 text-sm text-center py-6">No brands added yet</p>
        )}
      </div>

      {/* Recently deleted */}
      {isAdmin && deletedBrands.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Trash2 className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recently Deleted ({deletedBrands.length})
            </p>
          </div>
          {deletedBrands.map((b) => {
            const expiry = expiryLabel(b.deletedAt);
            return (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 opacity-60 hover:opacity-80 transition-opacity">
                <div>
                  <p className="text-slate-300 text-sm font-medium">{b.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRecoverId(b.id)}
                  className="h-7 text-xs border-emerald-800 text-emerald-400 hover:bg-emerald-950 gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Recover
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
