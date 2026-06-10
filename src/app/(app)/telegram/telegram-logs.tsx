import { format, isToday, isYesterday } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Log = {
  id: string;
  direction: string;
  from: string;
  to: string;
  message: string;
  createdAt: Date;
};

function dateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd MMM yyyy");
}

export function TelegramLogs({ logs }: { logs: Log[] }) {
  if (logs.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center py-16 text-slate-400">
        <svg viewBox="0 0 24 24" className="h-10 w-10 fill-current mb-3 opacity-30">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z" />
        </svg>
        <p className="text-sm">No messages yet</p>
        <p className="text-xs mt-1">Messages will appear here once the webhook is active</p>
      </div>
    );
  }

  // Group by day
  const groups: { label: string; items: Log[] }[] = [];
  for (const log of logs) {
    const label = dateLabel(new Date(log.createdAt));
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.items.push(log);
    } else {
      groups.push({ label, items: [log] });
    }
  }

  return (
    <div className="mt-4 max-w-xl space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-400 font-medium">{group.label}</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="space-y-1.5">
            {group.items.map((log) => {
              const isIn = log.direction === "IN";
              return (
                <div
                  key={log.id}
                  className={`flex gap-3 px-4 py-3 rounded-xl border ${
                    isIn
                      ? "bg-slate-900 border-slate-800"
                      : "bg-blue-950/20 border-blue-900/30"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 rounded-full p-1 ${isIn ? "bg-emerald-950/60" : "bg-blue-950/60"}`}>
                    {isIn ? (
                      <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${isIn ? "text-emerald-500" : "text-blue-500"}`}>
                        {isIn ? `User · ${log.from}` : "Bot reply"}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {format(new Date(log.createdAt), "h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
