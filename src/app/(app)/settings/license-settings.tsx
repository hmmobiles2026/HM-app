"use client";

import { useActionState } from "react";
import { activateLicense } from "@/app/actions/license";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, ShieldOff, Clock } from "lucide-react";
import type { LicenseStatus } from "@/lib/license";

function StatusBadge({ status }: { status: LicenseStatus }) {
  if (status.expired) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-900 rounded-xl">
        <ShieldOff className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-300">License Expired</p>
          <p className="text-xs text-red-400/80 mt-0.5">Telegram alerts are disabled. Enter a license key to reactivate.</p>
        </div>
      </div>
    );
  }

  if (status.warningSoon) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/50 border border-amber-900 rounded-xl">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Expiring Soon — {status.daysLeft} day{status.daysLeft !== 1 ? "s" : ""} left
          </p>
          <p className="text-xs text-amber-400/80 mt-0.5">
            {status.isTrial ? "Free trial" : "License"} ends{" "}
            {status.expiresAt.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/50 border border-emerald-900 rounded-xl">
      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-300">
          {status.isTrial ? "Free Trial Active" : "License Active"} — {status.daysLeft} days left
        </p>
        <p className="text-xs text-emerald-400/80 mt-0.5">
          {status.isTrial ? "Trial" : "License"} valid until{" "}
          {status.expiresAt.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export function LicenseSettings({ status }: { status: LicenseStatus }) {
  const [state, action, pending] = useActionState(activateLicense, undefined);

  return (
    <div className="mt-4 space-y-4 max-w-md">
      <StatusBadge status={status} />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-300">Activate License Key</p>
        </div>
        <p className="text-xs text-slate-500">
          Receive a key from HM Stocks support after payment. Each key extends access by 3 months (LKR 2,000).
        </p>

        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">License Key</Label>
            <Input
              name="licenseKey"
              placeholder="Paste your license key here…"
              required
              className="h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-xs rounded-xl"
            />
          </div>

          {state?.error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded-lg px-3 py-2">
              {state.success}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="h-9 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm"
          >
            {pending ? "Activating…" : "Activate"}
          </Button>
        </form>
      </div>
    </div>
  );
}
