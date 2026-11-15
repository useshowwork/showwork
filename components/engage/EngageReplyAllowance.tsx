"use client";
import { useEffect, useState } from "react";

export default function EngageReplyAllowance({
  calendarId,
}: {
  calendarId: string;
}) {
  const [usage, setUsage] = useState<{
    remaining: number;
    limit: number;
    active: boolean;
    trialEndsAt: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(
          `/api/calendars/${calendarId}/engage-usage`,
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok) setUsage(await response.json());
      } catch {
        /* Keep the last confirmed count during connection interruptions. */
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [calendarId]);
  if (!usage) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${usage.remaining ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      <strong>
        {usage.remaining.toLocaleString()} of {usage.limit.toLocaleString()} AI
        replies remaining
      </strong>
      {usage.trialEndsAt && (
        <span className="mt-1 block text-xs">
          Free trial ends{" "}
          {new Date(usage.trialEndsAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
          })}
          . Subscribe in Settings to continue.
        </span>
      )}
      <span className="mt-1 block text-xs">
        {!usage.active
          ? "Subscription inactive. Restore access in Settings."
          : usage.remaining
            ? "Drafts and automatic replies share this monthly allowance. Human replies do not use it."
            : "Your AI allowance resets monthly. You can still reply to customers yourself."}
      </span>
    </div>
  );
}
