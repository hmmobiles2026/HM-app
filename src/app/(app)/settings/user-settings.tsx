"use client";

import { useActionState, useState } from "react";
import { createUser, toggleUserActive } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Power } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/generated/prisma/client";

const roleBadge: Record<string, string> = {
  ADMIN: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  OWNER: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  SELLER: "bg-green-500/20 text-green-300 border-green-500/30",
};

export function UserSettings({ users }: { users: User[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await createUser(s as undefined, fd);
    if (result?.success) { toast.success(result.success); setShowForm(false); }
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 space-y-4 max-w-xl">
      <Button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 hover:bg-blue-500"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Add User
      </Button>

      {showForm && (
        <form action={action} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Name</Label>
              <Input name="name" required className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Email</Label>
              <Input name="email" type="email" required className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Password</Label>
              <Input name="password" type="password" required className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Role</Label>
              <Select name="role" defaultValue="SELLER">
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="SELLER">Seller</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-slate-300 text-xs">WhatsApp Number (optional)</Label>
              <Input name="whatsappNumber" placeholder="+94771234567" className="bg-slate-800 border-slate-700 text-white h-8 text-sm placeholder:text-slate-500" />
            </div>
          </div>
          {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} size="sm" className="bg-blue-600 hover:bg-blue-500">
              {pending ? "Creating…" : "Create User"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-400">
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-300">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-medium truncate">{u.name}</p>
                <Badge variant="outline" className={`text-xs ${roleBadge[u.role]}`}>
                  {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 truncate">{u.email}</p>
            </div>
            <form action={async () => {
              const r = await toggleUserActive(u.id, !u.isActive);
              if (r?.success) toast.success(r.success);
              if (r?.error) toast.error(r.error);
            }}>
              <button
                type="submit"
                className={`p-1.5 rounded-lg transition-colors ${
                  u.isActive
                    ? "text-emerald-400 hover:bg-emerald-500/10"
                    : "text-red-400 hover:bg-red-500/10"
                }`}
                title={u.isActive ? "Deactivate user" : "Activate user"}
              >
                <Power className="h-4 w-4" />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
