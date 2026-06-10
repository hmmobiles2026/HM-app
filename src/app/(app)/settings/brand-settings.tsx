"use client";

import { useActionState } from "react";
import { createBrand, deleteBrand } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

type Brand = { id: string; name: string; models: { id: string; name: string }[] };

export function BrandSettings({ brands, isAdmin }: { brands: Brand[]; isAdmin: boolean }) {
  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createBrand(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 max-w-md space-y-5">

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

      {/* List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 px-1">
          {brands.length} Brand{brands.length !== 1 ? "s" : ""}
        </p>
        {brands.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-slate-300 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{b.name}</p>
                <p className="text-xs text-slate-300">{b.models.length} model{b.models.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {isAdmin && (
              <form action={async () => {
                const r = await deleteBrand(b.id);
                if (r?.success) toast.success(r.success);
                if (r?.error) toast.error(r.error);
              }}>
                <button type="submit" className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        ))}
        {brands.length === 0 && (
          <p className="text-slate-300 text-sm text-center py-6">No brands added yet</p>
        )}
      </div>
    </div>
  );
}
