"use client";

import { useActionState } from "react";
import { createCategory, deleteCategory } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string };

export function CategorySettings({
  categories,
  isAdmin,
}: {
  categories: Category[];
  isAdmin: boolean;
}) {
  const [, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createCategory(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 max-w-md space-y-4">
      <form action={action} className="flex gap-2">
        <Input
          name="name"
          placeholder="Category name (e.g. Display, Battery, Flex)"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1"
        />
        <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 px-3">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      <div className="space-y-1.5">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-white text-sm font-medium">{c.name}</p>
            {isAdmin && (
              <form action={async () => {
                const r = await deleteCategory(c.id);
                if (r?.success) toast.success(r.success);
                if (r?.error) toast.error(r.error);
              }}>
                <button type="submit" className="text-slate-500 hover:text-red-400 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-slate-500 text-sm">No categories yet</p>
        )}
      </div>
    </div>
  );
}
