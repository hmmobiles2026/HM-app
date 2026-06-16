"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export function PasswordSettings() {
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await changePassword(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  return (
    <div className="mt-4 max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="h-4 w-4 text-slate-400" />
        <p className="text-sm text-slate-400">Change your account password.</p>
      </div>

      <form action={action} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Current Password</Label>
          <Input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">New Password</Label>
          <Input
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Confirm New Password</Label>
          <Input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
          />
        </div>
        {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
        <Button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-500 w-full"
        >
          {pending ? "Saving…" : "Change Password"}
        </Button>
      </form>
    </div>
  );
}
