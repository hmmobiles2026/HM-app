"use client";

import { useActionState } from "react";
import { createBrand, deleteBrand } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Brand = { id: string; name: string; models: { id: string; name: string }[] };

export function BrandSettings({ brands, isAdmin }: { brands: Brand[]; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(async (s: typeof createBrand extends (a: infer A, b: infer B) => infer R ? Parameters<typeof createBrand>[0] : undefined, fd: FormData) => {
    const result = await createBrand(s, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 max-w-md space-y-4">
      <form action={action} className="flex gap-2">
        <Input
          name="name"
          placeholder="Brand name (e.g. Samsung, Redmi)"
          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1"
        />
        <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 px-3">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div className="space-y-1.5">
        {brands.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            <div>
              <p className="text-white text-sm font-medium">{b.name}</p>
              <p className="text-xs text-slate-500">{b.models.length} models</p>
            </div>
            {isAdmin && (
              <form action={async () => {
                const r = await deleteBrand(b.id);
                if (r?.success) toast.success(r.success);
                if (r?.error) toast.error(r.error);
              }}>
                <button
                  type="submit"
                  className="text-slate-500 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        ))}
        {brands.length === 0 && (
          <p className="text-slate-500 text-sm">No brands added yet</p>
        )}
      </div>
    </div>
  );
}
