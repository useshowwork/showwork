"use client";

import UiSymbol from "@/components/ui/UiSymbol";
import { useState } from "react";

type BillingStatus =
  | "PENDING_SETUP"
  | "TRIAL"
  | "ACTIVE"
  | "OFFLINE";

type ContentWorkspacePlan = "CREATOR" | "GROWTH" | "STUDIO" | "UNLIMITED";

export default function AiAssistantBillingSettings({
  billingStatus,
  subscriptionRenewsAt,
  plan,
}: {
  billingStatus: BillingStatus;
  subscriptionRenewsAt: string | null;
  plan: ContentWorkspacePlan | null;
}) {
  const [open, setOpen] = useState(false);

  const planName =
    plan === "UNLIMITED" ? "Agency" : plan === "STUDIO"
      ? "Studio"
      : plan === "CREATOR"
        ? "Creator"
        : "Marketing Workspace";

  const isAvailable =
    billingStatus === "ACTIVE" ||
    billingStatus === "TRIAL";

  const statusLabel =
    billingStatus === "ACTIVE"
      ? "Included"
      : billingStatus === "TRIAL"
        ? "Included · Trial"
        : "Available with Marketing Workspace";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-8 flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: "rgba(36,120,255,0.1)",
              color: "#2478FF",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div>
            <p className="text-sm font-semibold text-white">
              AI Studio — Included
            </p>

            <p className="text-xs text-white/40">
              {planName} · {statusLabel}
            </p>
          </div>
        </div>

        <span className="text-xs text-white/30"><>{" View details "}<UiSymbol name="right" />{" "}</></span>
      </button>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            AI Studio — Included
          </p>

          <p className="mt-1 text-xs text-white/40">
            AI is included with your {planName} Marketing Workspace
            subscription. There is no separate AI subscription.
          </p>
        </div>

        <button
          onClick={() => setOpen(false)}
          className="text-xs text-white/40 underline"
        >
          Close
        </button>
      </div>

      <div className="rounded-xl border border-[#2478FF]/20 bg-[#2478FF]/[0.05] p-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "rgba(36,120,255,0.12)",
              color: "#2478FF",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M12 3 13.7 8.3 19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
                strokeLinejoin="round"
              />
              <path
                d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div>
            <p className="text-sm font-medium text-white">
              Your AI tools are part of your workspace
            </p>

            <p className="mt-1 text-xs leading-5 text-white/50">
              AI content generation, regeneration, Business Knowledge,
              and scheduled AI research are included in your Marketing
              Workspace plan. You do not need to purchase a separate
              AI subscription.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p
            className="text-[10px] font-semibold uppercase text-white/35"
            style={{ letterSpacing: "0.08em" }}
          >
            Content generation
          </p>

          <p className="mt-1 text-sm font-medium text-white">
            Included
          </p>

          <p className="mt-1 text-xs text-white/40">
            Uses your plan's monthly AI generation allowance.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p
            className="text-[10px] font-semibold uppercase text-white/35"
            style={{ letterSpacing: "0.08em" }}
          >
            AI regeneration
          </p>

          <p className="mt-1 text-sm font-medium text-white">
            Included
          </p>

          <p className="mt-1 text-xs text-white/40">
            Uses your plan's monthly AI regeneration allowance.
          </p>
        </div>
      </div>

      {isAvailable && subscriptionRenewsAt && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p
            className="text-xs font-semibold uppercase text-white/40"
            style={{ letterSpacing: "0.08em" }}
          >
            Marketing Workspace renewal
          </p>

          <p className="mt-1 text-sm font-medium text-white">
            {new Date(
              subscriptionRenewsAt
            ).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          <p className="mt-1 text-xs text-white/40">
            Your AI access is covered by this Marketing Workspace
            subscription.
          </p>
        </div>
      )}

      {!isAvailable && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">
            Marketing Workspace access is required
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            AI Studio becomes available automatically when your
            Marketing Workspace trial starts or your subscription is
            activated.
          </p>
        </div>
      )}
    </div>
  );
}