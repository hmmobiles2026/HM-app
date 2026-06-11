"use client";

import { useActionState, useState } from "react";
import { activateLicense, deactivateLicense, generateLicenseKey, startFreeTrial } from "@/app/actions/license";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, ShieldOff, ShieldX, Clock, PowerOff, KeyRound, Copy, Check, Play } from "lucide-react";
import type { LicenseStatus } from "@/lib/license";

function StatusBadge({ status }: { status: LicenseStatus }) {
  if (status.trialNotStarted) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl">
        <ShieldX className="h-5 w-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-300">Trial Not Started</p>
          <p className="text-xs text-slate-500 mt-0.5">Telegram alerts are inactive. Admin must activate the free trial.</p>
        </div>
      </div>
    );
  }

  if (status.forceDeactivated) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-900 rounded-xl">
        <ShieldOff className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-300">Deactivated by Admin</p>
          <p className="text-xs text-red-400/80 mt-0.5">Telegram alerts are disabled. Contact HM Stocks support.</p>
        </div>
      </div>
    );
  }

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

export function LicenseSettings({ status, isAdmin }: { status: LicenseStatus; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(activateLicense, undefined);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(deactivateLicense, undefined);
  const [trialState, trialAction, trialPending] = useActionState(startFreeTrial, undefined);
  const [genState, genAction, genPending] = useActionState(generateLicenseKey, undefined);
  const [copied, setCopied] = useState(false);

  function copyKey() {
    if (!genState?.key) return;
    navigator.clipboard.writeText(genState.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canStartTrial = isAdmin && (status.trialNotStarted || status.forceDeactivated || status.expired);
  const canDeactivate = isAdmin && status.active;

  return (
    <div className="mt-4 space-y-4 max-w-md">
      <StatusBadge status={status} />

      {/* Admin: Start / Re-activate Free Trial */}
      {canStartTrial && (
        <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">
              {status.trialNotStarted ? "Activate Free Trial" : "Re-activate Free Trial"}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Starts a fresh 4-month trial from today. Telegram alerts become active immediately.
          </p>
          {trialState?.error && <p className="text-xs text-red-400">{trialState.error}</p>}
          {trialState?.success && <p className="text-xs text-emerald-400">{trialState.success}</p>}
          <form action={trialAction}>
            <Button
              type="submit"
              disabled={trialPending}
              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {trialPending ? "Activating…" : status.trialNotStarted ? "Start Free Trial" : "Re-activate Free Trial"}
            </Button>
          </form>
        </div>
      )}

      {/* Owner / Admin: Activate with license key */}
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

      {/* Admin: Generate Key */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-medium text-slate-300">Generate License Key</p>
          </div>
          <p className="text-xs text-slate-500">
            Generate a key and send it to the customer. Each key adds 3 months (LKR 2,000).
          </p>
          <form action={genAction} className="flex items-center gap-2">
            <input type="hidden" name="months" value="3" />
            <button
              type="submit"
              disabled={genPending}
              className="h-8 px-3 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 disabled:opacity-50"
            >
              {genPending ? "Generating…" : "Generate Key"}
            </button>
          </form>
          {genState?.error && <p className="text-xs text-red-400">{genState.error}</p>}
          {genState?.key && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">Copy this key and send to the customer:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono break-all">
                  {genState.key}
                </code>
                <button
                  type="button"
                  onClick={copyKey}
                  className="shrink-0 h-8 w-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-300" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin: Deactivate */}
      {canDeactivate && (
        <div className="bg-slate-900 border border-red-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <PowerOff className="h-4 w-4 text-red-400" />
            <p className="text-sm font-medium text-red-300">Deactivate License</p>
          </div>
          <p className="text-xs text-slate-500">
            Immediately stops all Telegram features — alerts, bot replies, and daily summaries. A payment reminder is sent before shutting down.
          </p>
          {deactivateState?.error && <p className="text-xs text-red-400">{deactivateState.error}</p>}
          {deactivateState?.success && <p className="text-xs text-emerald-400">{deactivateState.success}</p>}
          <form action={deactivateAction}>
            <Button
              type="submit"
              disabled={deactivatePending}
              variant="outline"
              className="h-8 text-xs border-red-900 text-red-400 hover:bg-red-950/50 hover:text-red-300 rounded-lg"
            >
              <PowerOff className="h-3.5 w-3.5 mr-1.5" />
              {deactivatePending ? "Deactivating…" : "Deactivate Now"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
