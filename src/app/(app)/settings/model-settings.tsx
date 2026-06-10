"use client";

import { useActionState, useState } from "react";
import { createModel, deleteModel } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Trash2, Plus, Cpu } from "lucide-react";
import { toast } from "sonner";

type Brand = { id: string; name: string; models: { id: string; name: string }[] };

export function ModelSettings({ brands, isAdmin }: { brands: Brand[]; isAdmin: boolean }) {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createModel(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  const brandItems = brands.map((b) => ({ id: b.id, label: b.name }));
  const brandModels = brands.find((b) => b.id === selectedBrand)?.models ?? [];
  const selectedBrandName = brands.find((b) => b.id === selectedBrand)?.name;

  return (
    <div className="mt-4 max-w-md space-y-5">

      {/* Add form */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add New Model</p>
        <form action={action} className="space-y-2">
          <Combobox
            name="brandId"
            items={brandItems}
            value={selectedBrand}
            onChange={(id) => setSelectedBrand(id)}
            placeholder="Select brand…"
          />
          <div className="flex gap-2">
            <Input
              name="name"
              placeholder="e.g. A54, Note 12, 14 Pro"
              disabled={!selectedBrand}
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1 disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={pending || !selectedBrand}
              className="bg-blue-600 hover:bg-blue-500 px-3 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Models list */}
      {selectedBrand && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            {selectedBrandName} — {brandModels.length} model{brandModels.length !== 1 ? "s" : ""}
          </p>
          {brandModels.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-slate-500 shrink-0" />
                <p className="text-white text-sm font-medium">{m.name}</p>
              </div>
              {isAdmin && (
                <form action={async () => {
                  const r = await deleteModel(m.id);
                  if (r?.success) toast.success(r.success);
                  if (r?.error) toast.error(r.error);
                }}>
                  <button type="submit" className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          ))}
          {brandModels.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">No models for this brand yet</p>
          )}
        </div>
      )}
    </div>
  );
}
