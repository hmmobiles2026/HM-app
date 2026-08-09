"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateTelegramRecipients } from "@/app/actions/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, X, Save, Bell } from "lucide-react";
import { toast } from "sonner";

type KnownChat = { chatId: string; name: string; role: string };

export function TelegramRecipients({
  primaryChatId,
  extraChatIds,
  knownChats,
}: {
  primaryChatId: string;
  extraChatIds: string[];
  knownChats: KnownChat[];
}) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(extraChatIds);
  const [draft, setDraft] = useState("");

  const [, action, pending] = useActionState(
    async (_s: unknown, fd: FormData) => {
      fd.set("extraChatIds", ids.join(","));
      const result = await updateTelegramRecipients(undefined, fd);
      if (result?.success) {
        toast.success(result.success);
        router.refresh();
      }
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  function add(id: string) {
    const v = id.trim();
    if (!v) return;
    if (v === primaryChatId.trim()) {
      toast.error("That is already the main chat.");
      return;
    }
    if (ids.includes(v)) {
      toast.error("Already on the list.");
      return;
    }
    setIds([...ids, v]);
    setDraft("");
  }

  // Anyone logged into the bot who is not already receiving notifications.
  const suggestions = knownChats.filter(
    (c) => c.chatId !== primaryChatId.trim() && !ids.includes(c.chatId)
  );

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-blue-400" />
        <p className="text-sm font-semibold text-white">Who gets notifications</p>
      </div>

      <p className="text-xs text-slate-400">
        Sales alerts, low-stock warnings, the daily report and backups go to everyone
        listed here. Without this there is only one recipient — the bot still answers
        anyone who messages it, but only this list receives alerts.
      </p>

      {/* Primary */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
        <Users className="h-4 w-4 text-slate-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{primaryChatId}</p>
          <p className="text-xs text-slate-400">Main chat — set in the bot config above</p>
        </div>
      </div>

      {/* Extras */}
      {ids.map((id) => {
        const known = knownChats.find((c) => c.chatId === id);
        return (
          <div
            key={id}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700"
          >
            <Users className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{id}</p>
              <p className="text-xs text-slate-400">
                {known ? `${known.name} (${known.role})` : "Also notified"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIds(ids.filter((x) => x !== id))}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
              aria-label={`Remove ${id}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Suggestions from people already using the bot */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">Logged into the bot — tap to add:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((c) => (
              <button
                key={c.chatId}
                type="button"
                onClick={() => add(c.chatId)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <Plus className="h-3 w-3" />
                {c.name} <span className="text-slate-500">({c.role})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Or paste a chat ID…"
          className="h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
        <Button
          type="button"
          onClick={() => add(draft)}
          variant="outline"
          className="h-10 border-slate-700 text-slate-300 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <form action={action}>
        <Button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-500 gap-2 w-full"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save recipients"}
        </Button>
      </form>

      <p className="text-xs text-slate-500">
        They need to have messaged the bot at least once — Telegram will not let a bot
        write to someone who has never started a chat with it.
      </p>
    </div>
  );
}
