"use client";
import { subscribeChannelChanges } from "@/lib/reporting/channelChanges";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, ArrowUpRight } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

export default function InboxHandoffAlert({ calendarId }: { calendarId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let stopped = false, pending = false, failures = 0, nextAttempt = 0, version = 0;
    const refresh = async () => {
      if (stopped || document.hidden || pending || Date.now() < nextAttempt) return;
      pending = true;
      const requestVersion = version;
      try {
        const response = await calendarMutationFetch(`/api/calendars/${encodeURIComponent(calendarId)}/inbox/handoffs`, { cache: "no-store" });
        if (!response.ok) { failures++; nextAttempt = Date.now() + Math.min(120000, 15000 * 2 ** failures); return; }
        failures = 0; nextAttempt = 0;
        if (response.ok) { const result = await response.json(); if (!stopped && requestVersion === version) setCount(result.count); }
      } catch { failures++; nextAttempt = Date.now() + Math.min(120000, 15000 * 2 ** failures); /* Keep the last confirmed count. */ }
      finally { pending = false; if (!stopped && requestVersion !== version) void refresh(); }
    };
    const unsubscribe = subscribeChannelChanges(calendarId, () => { version++; setCount(0); nextAttempt = 0; void refresh(); });
    void refresh(); const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { unsubscribe(); stopped = true; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [calendarId]);
  if (!count) return null;
  return <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><BellRing size={16} aria-hidden="true" /><span>{count} {count === 1 ? "conversation needs" : "conversations need"} a person. AI is paused.</span><Link className="ml-auto inline-flex min-h-8 items-center gap-1 font-semibold" href={`/dashboard/calendars/${encodeURIComponent(calendarId)}?view=inbox&attention=true`}>Review inbox<ArrowUpRight size={14} aria-hidden="true" /></Link></div>;
}
