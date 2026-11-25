"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { trialAiLimitNotice, WORKSPACE_TRIAL_PLAN_COST, WORKSPACE_TRIAL_MAX_DRAFTS } from "@/lib/contentWorkspaceEntitlements";

export default function EngageReplyAllowance({
  calendarId,
  showPlanCost = false,
  engage = false,
}: {
  calendarId: string;
  showPlanCost?: boolean;
  engage?: boolean;
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
              : showPlanCost
                ? `One draft costs 1 credit. A short content plan costs ${WORKSPACE_TRIAL_PLAN_COST} credits and can include up to ${WORKSPACE_TRIAL_MAX_DRAFTS} drafts. An AI revision costs 1 credit.`
                : "Each AI draft or chat turn uses 1 credit. Manual work uses no credits."
            : usage.remaining
              ? "Drafts and automatic replies share this monthly allowance. Human replies do not use it."
              : "Your AI allowance resets monthly. You can still reply to customers yourself."}
      </span>
      {usage.trialEndsAt && usage.remaining === 0 && (
        <Link href={engage ? "/dashboard/billing?product=engage" : "/dashboard/billing?product=content-workspace#content-workspace-plans"} className="mt-2 inline-block font-semibold underline">View plans</Link>
      )}
    </div>
  );
}
