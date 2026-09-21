"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateTelegramNotifications } from "@/app/actions/telegram";
import { Button } from "@/components/ui/button";
import { Save, Clock, Moon, Bell } from "lucide-react";
import { toast } from "sonner";

type Props = {
  notifySale: boolean;
  notifyLowStock: boolean;
  notifyStockIn: boolean;
  dailyReportEnabled: boolean;
  autoBackupEnabled: boolean;
  quietHoursEnabled: boolean;
  quietFrom: string;
  quietTo: string;
};

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button type="button" onClick={onChange} className="flex items-start gap-2.5 w-full text-left">
      <span
        className={`h-5 w-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          on ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
        }`}
      >
        {on && <span className="text-slate-900 text-xs font-bold">✓</span>}
      </span>
      <span className="min-w-0">
        <span className="text-sm text-slate-200 block">{label}</span>
        {hint && <span className="text-xs text-slate-500 block">{hint}</span>}
      </span>
    </button>
  );
}

export function TelegramNotifications(props: Props) {
  const router = useRouter();
  const [s, setS] = useState(props);
  const set = <K extends keyof Props>(k: K, v: Props[K]) => setS((p) => ({ ...p, [k]: v }));

  const [, action, pending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      const r = await updateTelegramNotifications(undefined, fd);
      if (r?.success) {
        toast.success(r.success);
        router.refresh();
      }
      if (r?.error) toast.error(r.error);
      return r;
    },
    undefined
  );

  const timeField = (name: keyof Props, value: string, disabled = false) => (
    <input
      type="time"
      name={name}
      value={value}
      disabled={disabled}
      onChange={(e) => set(name, e.target.value as Props[typeof name])}
      className="h-9 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-2 disabled:opacity-40"
    />
  );

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-blue-400" />
        <p className="text-sm font-semibold text-white">Notifications</p>
      </div>

      <form action={action} className="space-y-5">
        {(
          [
            ["notifySale", "Sale alerts", "A message on every sale"],
            ["notifyLowStock", "Low stock warnings", "When an item hits its reorder level"],
            ["notifyStockIn", "Stock in", "When stock is added"],
            ["dailyReportEnabled", "", ""],
            ["autoBackupEnabled", "", ""],
            ["quietHoursEnabled", "", ""],
          ] as const
        ).map(([k]) => (
          <input key={k} type="hidden" name={k} value={s[k] ? "true" : "false"} />
        ))}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Live alerts
          </p>
          <Toggle on={s.notifySale} onChange={() => set("notifySale", !s.notifySale)} label="Sale alerts" hint="A message on every sale" />
          <Toggle on={s.notifyLowStock} onChange={() => set("notifyLowStock", !s.notifyLowStock)} label="Low stock warnings" hint="When an item hits its reorder level" />
          <Toggle on={s.notifyStockIn} onChange={() => set("notifyStockIn", !s.notifyStockIn)} label="Stock in" hint="When stock is added" />
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Scheduled
          </p>

          <Toggle
            on={s.dailyReportEnabled}
            onChange={() => set("dailyReportEnabled", !s.dailyReportEnabled)}
            label="Daily report — 12:10 AM"
            hint="The whole day's sales, low stock and dues"
          />
          <Toggle
            on={s.autoBackupEnabled}
            onChange={() => set("autoBackupEnabled", !s.autoBackupEnabled)}
            label="Automatic backup — 12:20 AM"
            hint="Sends the data file once the day has closed"
          />

          <p className="text-xs text-slate-500">
            Both run just after midnight, Sri Lanka time, and cover the day that has
            just finished — so every sale counts, right up to closing. The times are
            fixed by the hosting plan and cannot be changed here; switch them on or
            off instead.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" /> Quiet hours
          </p>
          <Toggle
            on={s.quietHoursEnabled}
            onChange={() => set("quietHoursEnabled", !s.quietHoursEnabled)}
            label="Silence live alerts overnight"
            hint="The daily report and backup still run"
          />
          {s.quietHoursEnabled && (
            <div className="flex items-center gap-2 pl-7">
              {timeField("quietFrom", s.quietFrom)}
              <span className="text-xs text-slate-500">to</span>
              {timeField("quietTo", s.quietTo)}
            </div>
          )}
        </div>

        <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 gap-2 w-full">
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save notifications"}
        </Button>
      </form>
    </div>
  );
}
