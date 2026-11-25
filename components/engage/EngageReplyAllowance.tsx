"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { trialAiLimitNotice } from "@/lib/contentWorkspaceEntitlements";
import menuStyles from "@/components/calendars/WorkspaceMenu.module.css";

export default function EngageReplyAllowance({
  calendarId,
  engage = false,
  sidebar = false,
  canSubscribe = false,
}: {
  calendarId: string;
  engage?: boolean;
  sidebar?: boolean;
  canSubscribe?: boolean;
}) {
  const [usage, setUsage] = useState<{
    used: number;
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
          `/api/calendars/${encodeURIComponent(calendarId)}/engage-usage`,
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok) setUsage(await response.json());
        else if (response.status === 404) setUsage(null);
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
  const plansHref = engage ? "/dashboard/billing?product=engage" : "/dashboard/billing?product=content-workspace#content-workspace-plans";
  if (sidebar) {
    if (!usage.trialEndsAt) return null;
    const used = usage.used ?? Math.max(0, usage.limit - usage.remaining);
    return (
      <section aria-label="Trial AI credits" className={menuStyles.trialCredits}>
        <p className={menuStyles.trialCreditsLabel}>Trial AI credits</p>
        <p role="status" className={menuStyles.trialCreditsCount}>
          <span className={menuStyles.trialCreditsFull}>{used} of {usage.limit} used</span>
          <span className={menuStyles.trialCreditsCompact} aria-hidden="true">{used}/{usage.limit}</span>
        </p>
        <progress aria-label="Trial AI credits used" value={Math.min(used, usage.limit)} max={usage.limit} className={menuStyles.trialCreditsProgress} />
        {canSubscribe && <Link href={plansHref} className={menuStyles.trialCreditsLink}>View plans</Link>}
      </section>
    );
  }
  return (
    <div
      role="status"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${usage.remaining ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      <strong>
        {usage.remaining.toLocaleString()} of {usage.limit.toLocaleString()} AI {usage.trialEndsAt ? "credits" : "replies"} remaining
      </strong>
      {usage.trialEndsAt && (
        <span className="mt-1 block text-xs">
          Free trial ends{" "}
          {new Date(usage.trialEndsAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
          })}
          .
        </span>
      )}
      <span className="mt-1 block text-xs">
        {!usage.active
          ? "Subscription inactive. Restore access in Settings."
          : usage.trialEndsAt
            ? usage.remaining === 0
              ? trialAiLimitNotice.error
              : "Each AI draft or chat turn uses 1 credit. Manual work uses no credits."
            : usage.remaining
              ? "Drafts and automatic replies share this monthly allowance. Human replies do not use it."
              : "Your AI allowance resets monthly. You can still reply to customers yourself."}
      </span>
      {usage.trialEndsAt && usage.remaining === 0 && (
        <Link href={plansHref} className="mt-2 inline-block font-semibold underline">View plans</Link>
      )}
    </div>
  );
}
