import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Log = {
  id: string;
  direction: string;
  from: string;
  to: string;
  message: string;
  createdAt: Date;
};

export function WhatsAppLogs({ logs }: { logs: Log[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-slate-300 text-sm text-center py-12">
        No messages yet
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2 max-w-xl">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`flex gap-3 px-4 py-3 rounded-xl border ${
            log.direction === "IN"
              ? "bg-slate-900 border-slate-800"
              : "bg-blue-950/30 border-blue-900/30"
          }`}
        >
          {log.direction === "IN" ? (
            <ArrowDownLeft className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-300">
                {log.direction === "IN" ? `From: ${log.from}` : `To: ${log.to}`}
              </p>
              <p className="text-xs text-slate-300 flex-shrink-0">
                {format(new Date(log.createdAt), "dd MMM, h:mm a")}
              </p>
            </div>
            <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap break-words">
              {log.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
