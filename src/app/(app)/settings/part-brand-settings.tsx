"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createPartBrand, deletePartBrand, recoverPartBrand } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, RotateCcw, Clock, Award } from "lucide-react";
import { toast } from "sonner";

type PartBrand = { id: string; name: string; deletedAt: Date | null };
type Category = { id: string; name: string };

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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type CategoryWithPartBrands = Category & { partBrands: PartBrand[] };

export function PartBrandSettings({
  categories,
  isAdmin,
}: {
  categories: CategoryWithPartBrands[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [recoverId, setRecoverId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [recovering, startRecover] = useTransition();

  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createPartBrand(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  const categoryItems = categories.map((c) => ({ id: c.id, label: c.name }));
  const selected = categories.find((c) => c.id === selectedCategory);
  const activePartBrands = selected?.partBrands.filter((pb) => !pb.deletedAt) ?? [];
  const deletedPartBrands = selected?.partBrands.filter(
    (pb) => pb.deletedAt && Date.now() - new Date(pb.deletedAt).getTime() < THREE_DAYS_MS
  ) ?? [];

  const deleteTarget = deleteId ? activePartBrands.find((pb) => pb.id === deleteId) : null;
  const recoverTarget = recoverId ? deletedPartBrands.find((pb) => pb.id === recoverId) : null;

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startDelete(async () => {
      const r = await deletePartBrand(id);
      if (r?.error) toast.error(r.error);
      else { toast.success(r?.success ?? "Moved to trash."); router.refresh(); }
    });
  }

  function handleRecover() {
    if (!recoverId) return;
    const id = recoverId;
    setRecoverId(null);
    startRecover(async () => {
      const r = await recoverPartBrand(id);
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
            <DialogTitle className="text-white">Delete part brand?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{selected?.name} — {deleteTarget?.name}</span> will be moved to trash. You can recover it within 3 days.
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
            <DialogTitle className="text-white">Recover part brand?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{selected?.name} — {recoverTarget?.name}</span> will be restored.
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
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Add Part Brand</p>
        <p className="text-xs text-slate-400">e.g. Display → Crown, CAA, OG</p>
        <form action={action} className="space-y-2">
          <Combobox
            name="categoryId"
            items={categoryItems}
            value={selectedCategory}
            onChange={(id) => setSelectedCategory(id)}
            placeholder="Select category…"
          />
          <div className="flex gap-2">
            <Input
              name="name"
              placeholder="e.g. Crown, CAA, OG, BStar"
              disabled={!selectedCategory}
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1 disabled:opacity-50"
            />
            <Button type="submit" disabled={pending || !selectedCategory} className="bg-blue-600 hover:bg-blue-500 px-3 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Active part brands for selected category */}
      {selectedCategory && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 px-1">
            {selected?.name} — {activePartBrands.length} part brand{activePartBrands.length !== 1 ? "s" : ""}
          </p>
          {activePartBrands.map((pb) => (
            <div key={pb.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <Award className="h-4 w-4 text-slate-300 shrink-0" />
                <p className="text-white text-sm font-medium">{pb.name}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setDeleteId(pb.id)}
                  className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {activePartBrands.length === 0 && (
            <p className="text-slate-300 text-sm text-center py-6">No part brands for this category</p>
          )}

          {/* Recently deleted */}
          {isAdmin && deletedPartBrands.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recently Deleted ({deletedPartBrands.length})
                </p>
              </div>
              {deletedPartBrands.map((pb) => {
                const expiry = expiryLabel(pb.deletedAt);
                return (
                  <div key={pb.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 opacity-60 hover:opacity-80 transition-opacity">
                    <div>
                      <p className="text-slate-300 text-sm font-medium">{pb.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRecoverId(pb.id)}
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
      )}
    </div>
  );
}
