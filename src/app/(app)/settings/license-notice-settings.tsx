"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateLicenseNotice } from "@/app/actions/license";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BellRing, Save } from "lucide-react";
import { toast } from "sonner";

const AUDIENCES = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "OWNER_ADMIN", label: "Owner & Admin" },
  { value: "NOBODY", label: "Nobody" },
] as const;

const DAY_PRESETS = [0, 7, 14, 30] as const;

export function LicenseNoticeSettings({
  warnDaysBefore,
  warningAudience,
  telegramReminders,
  renewalText,
  supportContact,
}: {
  warnDaysBefore: number;
  warningAudience: string;
  telegramReminders: boolean;
  renewalText: string;
  supportContact: string | null;
}) {
  const router = useRouter();
  const [days, setDays] = useState(String(warnDaysBefore));
  const [audience, setAudience] = useState(warningAudience);
  const [telegram, setTelegram] = useState(telegramReminders);

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      const r = await updateLicenseNotice(undefined, fd);
      if (r?.success) {
        toast.success(r.success);
        router.refresh();
      }
      if (r?.error) toast.error(r.error);
      return r;
    },
    undefined
  );

  const off = Number(days) === 0;

  return (
    <div className="mt-5 rounded-xl bg-slate-900/50 border border-slate-800 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Renewal reminders
        </p>
      </div>

      <p className="text-xs text-slate-400">
        Controls the &ldquo;expires soon&rdquo; warning only. The expired notice always
        shows — once a licence lapses the bot stops answering, and hiding the reason
        just turns a renewal into a support call.
      </p>

      <form action={action} className="space-y-4">
        <input type="hidden" name="warningAudience" value={audience} />
        <input type="hidden" name="telegramReminders" value={telegram ? "true" : "false"} />

        <div>
          <label className="text-xs text-slate-400">Start warning this many days before</label>
          <div className="flex items-center gap-1.5 mt-1.5">
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(String(d))}
                className={`h-9 px-3 rounded-xl text-xs font-medium transition-colors ${
                  Number(days) === d
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {d === 0 ? "Off" : `${d} days`}
              </button>
            ))}
            <Input
              name="warnDaysBefore"
              type="number"
              min={0}
              max={180}
              value={days}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDays(e.target.value)}
              className="h-9 w-20 bg-slate-800 border-slate-700 text-white text-sm"
            />
          </div>
          {off && (
            <p className="text-xs text-amber-400/80 mt-1.5">
              No advance warning will be shown. The shop will only find out at expiry.
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-400">Who sees the warning</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                disabled={off}
                onClick={() => setAudience(a.value)}
                className={`h-9 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 ${
                  audience === a.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTelegram((v) => !v)}
          className="flex items-center gap-2.5 w-full text-left"
        >
          <span
            className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              telegram ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
            }`}
          >
            {telegram && <span className="text-slate-900 text-xs font-bold">✓</span>}
          </span>
          <span className="text-sm text-slate-300">Send renewal reminders on Telegram</span>
        </button>

        <div className="space-y-2 pt-1">
          <div>
            <label className="text-xs text-slate-400">Renewal wording</label>
            <Input
              name="renewalText"
              defaultValue={renewalText}
              placeholder="LKR 2,000 for 3 months"
              className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Support contact</label>
            <Input
              name="supportContact"
              defaultValue={supportContact ?? ""}
              placeholder="e.g. Heshan 077 123 4567"
              className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Shown in the banner and in the bot&rsquo;s reply once the licence expires.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 gap-2">
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save reminders"}
        </Button>
      </form>
    </div>
  );
}
