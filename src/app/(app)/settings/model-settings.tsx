"use client";

import { useActionState, useState } from "react";
import { createModel, deleteModel } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Brand = { id: string; name: string; models: { id: string; name: string }[] };

export function ModelSettings({ brands, isAdmin }: { brands: Brand[]; isAdmin: boolean }) {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createModel(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  const brandModels = brands.find((b) => b.id === selectedBrand)?.models ?? [];

  return (
    <div className="mt-4 max-w-md space-y-4">
      <form action={action} className="space-y-2">
        <Select name="brandId" onValueChange={(v: string | null) => setSelectedBrand(v ?? "")}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
            <SelectValue placeholder="Select brand" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            name="name"
            placeholder="Model name (e.g. A54, Note 12)"
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 flex-1"
          />
          <Button type="submit" disabled={pending || !selectedBrand} className="bg-blue-600 hover:bg-blue-500 px-3">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {selectedBrand && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400 font-medium">
            {brands.find((b) => b.id === selectedBrand)?.name} models
          </p>
          {brandModels.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-white text-sm">{m.name}</p>
              {isAdmin && (
                <form action={async () => {
                  const r = await deleteModel(m.id);
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
          {brandModels.length === 0 && (
            <p className="text-slate-500 text-sm">No models for this brand</p>
          )}
        </div>
      )}
    </div>
  );
}
