"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createSupplier, deleteSupplier } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";

type Supplier = { id: string; name: string; phone: string | null; note: string | null };

export function SupplierSettings({
  suppliers,
  isAdmin,
}: {
  suppliers: Supplier[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const deleteTarget = deleteId ? suppliers.find((s) => s.id === deleteId) : null;

  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createSupplier(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startDelete(async () => {
      const r = await deleteSupplier(id);
      if (r?.error) toast.error(r.error);
      else { toast.success(r?.success ?? "Deleted."); router.refresh(); }
    });
  }

  return (
    <div className="mt-4 max-w-md space-y-5">

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent showCloseButton={false} className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete supplier?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{deleteTarget?.name}</span> will be removed. This will fail if products or returns are still linked to them.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add form */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Add Supplier</p>
        <form action={action} className="space-y-2">
          <Input
            name="name"
            placeholder="Supplier name e.g. Crown Lanka, Mega Parts"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Input
            name="phone"
            placeholder="Phone number (optional)"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Input
            name="note"
            placeholder="Note (optional)"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 gap-2">
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </form>
      </div>

      {/* List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 px-1">
          {suppliers.length} Supplier{suppliers.length !== 1 ? "s" : ""}
        </p>
        {suppliers.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-slate-300 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{s.name}</p>
                {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setDeleteId(s.id)}
                className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {suppliers.length === 0 && (
          <p className="text-slate-300 text-sm text-center py-6">No suppliers added yet</p>
        )}
      </div>
    </div>
  );
}
