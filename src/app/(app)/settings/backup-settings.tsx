"use client";

import { useState } from "react";
import { sendTelegramBackup } from "@/app/actions/backup";
import { Button } from "@/components/ui/button";
import { FileDown, FileJson, Send, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type ExportItem = {
  label: string;
  description: string;
  filename: string;
  url: string;
  icon: React.ElementType;
  color: string;
};

const exports: ExportItem[] = [
  {
    label: "Products CSV",
    description: "All products with stock levels, prices, brands and categories",
    filename: "products.csv",
    url: "/api/backup/products",
    icon: FileDown,
    color: "text-blue-400",
  },
  {
    label: "Sales CSV",
    description: "Full sales history with items, revenue and profit per transaction",
    filename: "sales.csv",
    url: "/api/backup/sales",
    icon: FileDown,
    color: "text-emerald-400",
  },
  {
    label: "Full Backup (JSON)",
    description: "Everything — products, sales, stock movements, brands, categories",
    filename: "backup.json",
    url: "/api/backup/full",
    icon: FileJson,
    color: "text-amber-400",
  },
];

export function BackupSettings() {
  const [sendingTelegram, setSendingTelegram] = useState(false);

  async function handleTelegramBackup() {
    setSendingTelegram(true);
    const r = await sendTelegramBackup();
    setSendingTelegram(false);
    if (r?.success) toast.success(r.success);
    if (r?.error) toast.error(r.error);
  }

  return (
    <div className="mt-4 space-y-6 max-w-lg">

      {/* Info banner */}
      <div className="flex gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-900/40">
        <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-300 text-sm font-semibold">Regular backups recommended</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Download a full backup weekly and store it safely. The JSON file can be used to restore all data if needed.
          </p>
        </div>
      </div>

      {/* Download exports */}
      <div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Download</p>
        <div className="space-y-2">
          {exports.map((e) => (
            <div
              key={e.url}
              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800"
            >
              <e.icon className={`h-5 w-5 shrink-0 ${e.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{e.label}</p>
                <p className="text-slate-500 text-xs">{e.description}</p>
              </div>
              <a href={e.url} download>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white shrink-0"
                >
                  Download
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram backup */}
      <div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Telegram</p>
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
          <Send className="h-5 w-5 shrink-0 text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Send Summary to Telegram</p>
            <p className="text-slate-500 text-xs">
              Sends inventory count, all-time revenue, profit, and today's totals to your bot
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sendingTelegram}
            onClick={handleTelegramBackup}
            className="border-slate-700 text-slate-300 hover:text-white shrink-0"
          >
            {sendingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>

    </div>
  );
}
