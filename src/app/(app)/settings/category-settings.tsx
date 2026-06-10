"use client";

import { useActionState } from "react";
import { createCategory, deleteCategory } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Layers } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string };

export function CategorySettings({ categories, isAdmin }: { categories: Category[]; isAdmin: boolean }) {
  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createCategory(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 max-w-md space-y-5">

      {/* Add form */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add New Category</p>
        <form action={action} className="flex gap-2">
          <Input
            name="name"
            placeholder="e.g. Display, Battery, Flex Cable"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1"
          />
          <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 px-3 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          {categories.length} Categor{categories.length !== 1 ? "ies" : "y"}
        </p>
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-slate-500 shrink-0" />
              <p className="text-white text-sm font-medium">{c.name}</p>
            </div>
            {isAdmin && (
              <form action={async () => {
                const r = await deleteCategory(c.id);
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
        {categories.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">No categories yet</p>
        )}
      </div>
    </div>
  );
}
