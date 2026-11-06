"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { getContentWorkspaceFeatureList } from "@/lib/contentWorkspaceEntitlements";

import { CONTENT_WORKSPACE_PLANS, CONTENT_WORKSPACE_PLAN_ORDER, formatWorkspaceLimit } from "@/lib/contentWorkspaceEntitlements";
import { useRouter } from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";

type ContentWorkspacePlan = "CREATOR" | "GROWTH" | "STUDIO" | "UNLIMITED";
type BillingCycle = "MONTHLY" | "ANNUAL";
type BillingStatus =
  | "PENDING_SETUP"
  | "TRIAL"
  | "ACTIVE"
  | "OFFLINE";
export type WorkspacePlanSwitchRequest = {
  plan: ContentWorkspacePlan;
  billingCycle: BillingCycle;
};

type BillingQuote = { amountNgn: number; standardPriceNgn: number; offer: { id: string; title: string; percent: number; durationMonths: number; remainingCycles: number } | null };

type PendingSwitch = "upgrade" | "downgrade" | null;

function SettingsIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function ArrowRightIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function UsersIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SparklesIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
        strokeLinejoin="round"
      />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </svg>
  );
}

function CloseIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ShieldIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 5 6v5c0 5 3.2 8.7 7 10 3.8-1.3 7-5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const PLAN_DETAILS = Object.fromEntries(CONTENT_WORKSPACE_PLAN_ORDER.map(key => {
 const plan = CONTENT_WORKSPACE_PLANS[key];
 return [key, {
  name: plan.name, monthlyPrice: plan.priceNgnMonthly, annualPrice: plan.priceNgnAnnual,
  workspaces: `${formatWorkspaceLimit(plan.activeWorkspaces)} active marketing workspaces`,
  collaborators: `${formatWorkspaceLimit(plan.collaborators)} collaborators`,
  storage: `${plan.storageBytes / 1_000_000_000} GB storage`,
  ai: `${plan.aiGenerations.toLocaleString("en-NG")} AI generations / month`,
 }];
})) as Record<ContentWorkspacePlan, { name: string; monthlyPrice: number; annualPrice: number; workspaces: string; collaborators: string; storage: string; ai: string }>;

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function CalendarBillingSettings({
  plan,
  billingStatus,
  billingCycle,
  subscriptionRenewsAt,
  trialEndsAt,
  switchRequest,
  recurringPriceNgn,
  onBusyChange,
}: {
  plan: ContentWorkspacePlan;
  billingStatus: BillingStatus;
  billingCycle: BillingCycle | null;
  subscriptionRenewsAt: string | null;
  trialEndsAt: string | null;
  recurringPriceNgn?: number;
  switchRequest?: WorkspacePlanSwitchRequest | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] =
    useState(false);
  const [loading, setLoading] = useState<"upgrade" | "unlimited" | "downgrade" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] =
    useState<PendingSwitch>(null);

  const [offerQuote, setOfferQuote] = useState<BillingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<ContentWorkspacePlan>(plan);
  const [planBillingCycle, setPlanBillingCycle] = useState<BillingCycle>(billingCycle ?? "MONTHLY");
  const [switchBillingCycle, setSwitchBillingCycle] = useState<BillingCycle>("MONTHLY");
  const errorDialogRef = useRef<HTMLDialogElement>(null);
  const handledSwitchRequest = useRef<WorkspacePlanSwitchRequest | null>(null);

  useEffect(() => { onBusyChange?.(loading !== null); }, [loading, onBusyChange]);

  useEffect(() => {
    const dialog = errorDialogRef.current;
    if (error && open && dialog && !dialog.open) dialog.showModal();
  }, [error, open]);

  const currentPlan = PLAN_DETAILS[plan];

  const isActive = billingStatus === "ACTIVE";

  const isStillInTrial =
    billingStatus === "TRIAL" &&
    !!trialEndsAt &&
    new Date(trialEndsAt).getTime() > Date.now();

  const cycle = billingCycle ?? "MONTHLY";

  const currentPrice = recurringPriceNgn ?? (cycle === "ANNUAL" ? currentPlan.annualPrice : currentPlan.monthlyPrice);

  const currentPriceLabel =
    cycle === "ANNUAL"
      ? `${formatNaira(currentPrice)}/year`
      : `${formatNaira(currentPrice)}/month`;

  const statusMeta = useMemo(() => {
    if (billingStatus === "ACTIVE") {
      return {
        label: "Active",
        text: "#16A34A",
        bg: "#ECFDF3",
        border: "#D1FADF",
        dot: "#22C55E",
      };
    }

    if (billingStatus === "TRIAL") {
      return {
        label: "Free trial",
        text: "#175CD3",
        bg: "#EFF8FF",
        border: "#D1E9FF",
        dot: "#2478FF",
      };
    }

    if (billingStatus === "OFFLINE") {
      return {
        label: "Inactive",
        text: "#B42318",
        bg: "#FEF3F2",
        border: "#FECDCA",
        dot: "#F04438",
      };
    }

    return {
      label: "Setup required",
      text: "#B54708",
      bg: "#FFFAEB",
      border: "#FEDF89",
      dot: "#F79009",
    };
  }, [billingStatus]);

  const formattedBillingDate = useMemo(() => {
    if (!subscriptionRenewsAt) return null;

    return new Date(
      subscriptionRenewsAt
    ).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [subscriptionRenewsAt]);

  const formattedTrialDate = useMemo(() => {
    if (!trialEndsAt) return null;

    return new Date(trialEndsAt).toLocaleDateString(
      "en-NG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }, [trialEndsAt]);

  const targetPlan = selectedPlan;

  const targetPlanDetails = PLAN_DETAILS[targetPlan];

  const targetPrice = offerQuote?.amountNgn ?? (switchBillingCycle === "ANNUAL" ? targetPlanDetails.annualPrice : targetPlanDetails.monthlyPrice);

  const targetPriceLabel =
    switchBillingCycle === "ANNUAL"
      ? `${formatNaira(targetPrice)}/year`
      : `${formatNaira(targetPrice)}/month`;

  const targetAnnualSavings =
    targetPlanDetails.monthlyPrice * 12 -
    targetPlanDetails.annualPrice;

  const targetAnnualEquivalent =
    targetPlanDetails.annualPrice / 12;

  const runSwitch = async (
    kind: "upgrade" | "downgrade",
    payNow: boolean,
    selectedBillingCycle: BillingCycle,
    nextPlan: ContentWorkspacePlan = selectedPlan
  ) => {
    setLoading(kind);
    setError(null);
    setPendingSwitch(null);

    const endpoint =
      kind === "upgrade"
        ? "/api/calendars/upgrade-to-company"
        : "/api/calendars/downgrade-to-individual";

    try {
      const res = await calendarMutationFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payNow,
          expectedQuote: payNow && offerQuote ? { amountNgn: offerQuote.amountNgn, offerId: offerQuote.offer?.id ?? null } : undefined,
          plan: nextPlan,
          billingCycle: selectedBillingCycle,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data.authorizationUrl) {
          window.location.href =
            data.authorizationUrl;
        } else {
          router.refresh();
          setLoading(null);
        }

        return;
      }

      setError(
        data.error ??
          "Failed to switch plans. Please try again."
      );
      setLoading(null);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  const startSwitch = (nextPlan: ContentWorkspacePlan, requestedCycle: BillingCycle = planBillingCycle) => {
    const kind = CONTENT_WORKSPACE_PLAN_ORDER.indexOf(nextPlan) > CONTENT_WORKSPACE_PLAN_ORDER.indexOf(plan) ? "upgrade" : "downgrade";
    setSelectedPlan(nextPlan);
    setSwitchBillingCycle(requestedCycle);
    setPendingSwitch(kind);
  };

  useEffect(() => {
    if (!pendingSwitch) return;
    const controller = new AbortController();
    setOfferQuote(null); setQuoteError(null); setQuoteLoading(true);
    calendarMutationFetch(`/api/billing/quote?product=CONTENT_WORKSPACE&plan=${selectedPlan}&cycle=${switchBillingCycle}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not confirm your price"); return result; })
      .then(setOfferQuote).catch(e => { if (e.name !== "AbortError") setQuoteError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setQuoteLoading(false); });
    return () => controller.abort();
  }, [pendingSwitch, selectedPlan, switchBillingCycle]);

  const cancel = async () => {
    setLoading("cancel");
    setError(null);

    try {
      const res = await calendarMutationFetch(
        "/api/calendars/cancel-subscription",
        {
          method: "POST",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.refresh();
          setLoading(null);
        return;
      }

      setError(
        data.error ??
          "Failed to cancel. Please try again."
      );
      setLoading(null);
      setConfirmingCancel(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
      setConfirmingCancel(false);
    }
  };

  useEffect(() => {
    if (!switchRequest || handledSwitchRequest.current === switchRequest || switchRequest.plan === plan) return;
    handledSwitchRequest.current = switchRequest;
    setOpen(true);
    setPlanBillingCycle(switchRequest.billingCycle);
    startSwitch(switchRequest.plan, switchRequest.billingCycle);
    // Each comparison-card request is consumed once by the existing switch flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switchRequest, plan]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mb-8 flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#E7E9EE] bg-white px-4 py-4 text-left shadow-[0_8px_30px_rgba(16,24,40,0.045)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D9DEE7] hover:shadow-[0_16px_40px_rgba(16,24,40,0.075)] sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2478FF]">
            <SettingsIcon className="h-[18px] w-[18px]" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-[-0.01em] text-[#101828]">
                Marketing Workspace
              </p>

              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                style={{
                  color: statusMeta.text,
                  background: statusMeta.bg,
                  borderColor: statusMeta.border,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: statusMeta.dot,
                  }}
                />
                {statusMeta.label}
              </span>
            </div>

            <p className="mt-1 truncate text-xs text-[#667085]">
              {currentPlan.name} · {currentPriceLabel}
            </p>
          </div>
        </div>

        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#475467]">
          Manage billing
          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    );
  }

  return (
    <>
      <section className="mb-8 overflow-hidden rounded-[28px] border border-[#E7E9EE] bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)]">
        <div className="relative overflow-hidden border-b border-[#EAECF0] bg-[#0B0D12] px-5 py-6 sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#2478FF] opacity-20 blur-[80px]" />
          <div className="pointer-events-none absolute right-24 top-4 h-24 w-24 rounded-full border border-white/[0.06]" />
          <div className="pointer-events-none absolute right-16 top-10 h-40 w-40 rounded-full border border-white/[0.04]" />

          <div className="relative flex items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#78AEFF]">
                  Marketing Workspace
                </span>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]"
                  style={{
                    color:
                      billingStatus === "ACTIVE"
                        ? "#86EFAC"
                        : billingStatus === "TRIAL"
                          ? "#93C5FD"
                          : billingStatus === "OFFLINE"
                            ? "#FDA29B"
                            : "#FEC84B",
                    background:
                      "rgba(255,255,255,0.045)",
                    borderColor:
                      "rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: statusMeta.dot,
                    }}
                  />
                  {statusMeta.label}
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[28px]">
                {currentPlan.name} plan
              </h2>

              <p className="mt-2 max-w-lg text-sm leading-6 text-white/45">
                Manage your Marketing Workspace subscription,
                plan and access in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmingCancel(false);
                setPendingSwitch(null);
                setError(null);
              }}
              aria-label="Close billing settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                Current plan
              </p>

              <p className="mt-2 text-base font-semibold text-[#101828]">
                {currentPlan.name}
              </p>

              <p className="mt-1 text-xs text-[#667085]">
                {currentPriceLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                Status
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: statusMeta.dot,
                  }}
                />

                <p className="text-base font-semibold text-[#101828]">
                  {statusMeta.label}
                </p>
              </div>

              <p className="mt-1 text-xs text-[#667085]">
                {billingStatus === "TRIAL"
                  ? formattedTrialDate
                    ? `Trial ends ${formattedTrialDate}.`
                    : "Trial access is currently enabled."
                  : billingStatus === "ACTIVE"
                    ? "Your subscription is active."
                    : billingStatus === "OFFLINE"
                      ? "Your workspace access is currently restricted."
                      : "Complete billing setup to continue."}
              </p>
            </div>

            <div className="rounded-2xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                Next billing
              </p>

              <p className="mt-2 text-base font-semibold text-[#101828]">
                {isActive && formattedBillingDate
                  ? formattedBillingDate
                  : billingStatus === "TRIAL"
                    ? formattedTrialDate ?? "Trial end date pending"
                    : isActive ? "Confirming renewal date" : "No scheduled payment"}
              </p>

              <p className="mt-1 text-xs text-[#667085]">
                {isActive
                  ? cycle === "ANNUAL"
                    ? "Annual renewal."
                    : "Monthly renewal."
                  : "No active renewal date yet."}
              </p>
            </div>
          </div>


          <div className="mt-7">
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                Your plan
              </p>

              <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#101828]">
                Content, conversations, leads and analytics for your client accounts.
              </h3>
            </div>

            <div className="rounded-[24px] border border-[#EAECF0] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5F0FF] text-[#2478FF]">
                      {plan !== "CREATOR" ? (
                        <UsersIcon className="h-4 w-4" />
                      ) : (
                        <SparklesIcon className="h-4 w-4" />
                      )}
                    </span>

                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#175CD3]">
                      {plan !== "CREATOR"
                        ? "Built for teams & agencies"
                        : "Built for independent creators"}
                    </span>
                  </div>

                  <h4 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-[#101828]">
                    {currentPlan.name}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-[#475467]">
                    Your Marketing Workspace subscription includes
                    marketing workspaces, collaboration, storage,
                    publishing, analytics and AI Studio.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    {[
                      currentPlan.workspaces,
                      currentPlan.collaborators,
                      currentPlan.storage,
                      currentPlan.ai,
                      "AI Studio included",
                    ].map((feature) => (
                      <span
                        key={feature}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#344054]"
                      >
                        <CheckIcon className="h-3.5 w-3.5 text-[#12B76A]" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 lg:text-right">
                  <p className="text-2xl font-semibold tracking-tight text-[#101828]">
                    {formatNaira(currentPrice)}
                    <span className="ml-1 text-xs font-normal text-[#667085]">
                      /{cycle === "ANNUAL" ? "year" : "month"}
                    </span>
                  </p>

                  <p className="mt-1 text-[10px] text-[#667085]">
                    {cycle === "ANNUAL"
                      ? "Annual billing"
                      : "Monthly billing"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#EAECF0] bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#101828]">
                    AI Studio
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-[#667085]">
                    AI content generation, regeneration, Business
                    Knowledge and scheduled AI research are
                    included with your plan.
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#027A48]">
                  Included
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                Plan management
              </p>

              <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#101828]">
                Change your Marketing Workspace plan.
              </h3>
            </div>

            <div className="mb-5 inline-flex rounded-xl border border-[#E7E9EE] bg-[#F9FAFB] p-1" role="group" aria-label="Plan billing cycle">
              {(["MONTHLY", "ANNUAL"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={planBillingCycle === option}
                  disabled={loading !== null}
                  onClick={() => setPlanBillingCycle(option)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${planBillingCycle === option ? "bg-[#2478FF] text-white" : "text-[#475467] hover:bg-white"}`}
                >
                  {option === "MONTHLY" ? "Monthly" : "Annual · Save 5%"}
                </button>
              ))}
            </div>

            <p className="mb-4 text-sm leading-6 text-[#667085]">
              Choose any plan below. During your trial, every plan has full Agency feature access. You can switch your intended plan and keep your remaining trial time. Paid plan changes open checkout and take effect after payment. Existing workspaces beyond the new allowance stay available to review and unlock again when you upgrade.
            </p>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {CONTENT_WORKSPACE_PLAN_ORDER.map((key) => {
                const details = PLAN_DETAILS[key];
                const isCurrent = key === plan;
                const isUpgrade = CONTENT_WORKSPACE_PLAN_ORDER.indexOf(key) > CONTENT_WORKSPACE_PLAN_ORDER.indexOf(plan);
                return (
                  <div key={key} className={`flex flex-col rounded-2xl border p-5 ${key === "UNLIMITED" ? "border-[#D1E9FF] bg-[#F5FAFF]" : "border-[#EAECF0] bg-white"}`}>
                    <div className="mb-3 min-h-6">
                      {isCurrent ? <span className="text-xs font-semibold text-[#027A48]">Current plan</span> : key === "UNLIMITED" ? <span className="text-xs font-semibold text-[#175CD3]">Recommended for teams</span> : null}
                    </div>
                    <h4 className="text-lg font-semibold text-[#101828]">{details.name}</h4>
                    <p className="mt-2 text-xl font-semibold text-[#101828]">{formatNaira(planBillingCycle === "ANNUAL" ? details.annualPrice : details.monthlyPrice)}<span className="text-xs font-normal text-[#667085]">/{planBillingCycle === "ANNUAL" ? "year" : "month"}</span></p>
                    <ul className="my-5 space-y-2 text-xs text-[#475467]">
                      {[details.workspaces, details.collaborators, details.storage, details.ai, ...getContentWorkspaceFeatureList(key)].map(feature => <li key={feature} className="flex gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-[#12B76A]" />{feature}</li>)}
                    </ul>
                    <button type="button" disabled={isCurrent || loading !== null} onClick={() => startSwitch(key)} className={`mt-auto min-h-11 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${key === "UNLIMITED" ? "bg-[#2478FF] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
                      {isCurrent ? "Current plan" : loading !== null && selectedPlan === key ? "Switching…" : `${isUpgrade ? "Upgrade" : "Downgrade"} to ${details.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {isActive && (
            <div className="mt-7 border-t border-[#EAECF0] pt-7">
              <div className="rounded-[22px] border border-[#FECDCA] bg-[#FFFBFA] p-5">
                {confirmingCancel ? (
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">
                      Cancel your Marketing Workspace subscription?
                    </p>

                    <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#667085]">
                      Your marketing workspaces will become inaccessible
                      after cancellation. AI Studio and the other
                      features included in your Marketing Workspace
                      subscription will also become unavailable until
                      you subscribe again.
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => void cancel()}
                        disabled={loading !== null}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#D92D20] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B42318] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === "cancel"
                          ? "Cancelling..."
                          : "Yes, cancel subscription"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmingCancel(false)
                        }
                        disabled={loading !== null}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold text-[#475467] transition-colors hover:bg-white disabled:opacity-60"
                      >
                        Keep my plan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#101828]">
                        Cancel subscription
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#667085]">
                        Stop billing and restrict access to your
                        Marketing Workspace account.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmingCancel(true)
                      }
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#FECDCA] bg-white px-4 py-2.5 text-xs font-semibold text-[#B42318] transition-colors hover:bg-[#FEF3F2]"
                    >
                      Cancel subscription
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <dialog
          ref={errorDialogRef}
          aria-labelledby="billing-error-title"
          aria-describedby="billing-error-description"
          onCancel={() => setError(null)}
          onClose={() => setError(null)}
          className="w-[calc(100%-2rem)] max-w-md rounded-[26px] border border-[#FECDCA] bg-white p-6 shadow-2xl backdrop:bg-[#0A0D12]/70 backdrop:backdrop-blur-sm sm:p-7"
        >
          <h3 id="billing-error-title" className="text-xl font-semibold tracking-tight text-[#101828]">
            {error.startsWith("Creator supports") ? "Unable to switch to Creator" : "Unable to complete this action"}
          </h3>
          <p id="billing-error-description" className="mt-3 text-sm leading-6 text-[#475467]">{error}</p>
          <button
            type="button"
            autoFocus
            onClick={() => errorDialogRef.current?.close()}
            className="mt-6 min-h-11 w-full rounded-xl bg-[#2478FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1768E8]"
          >
            Got it
          </button>
        </dialog>
      )}

      {pendingSwitch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0D12]/70 p-4 backdrop-blur-sm"
          onClick={() =>
            loading === null &&
            setPendingSwitch(null)
          }
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trial-switch-title"
            className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#11151C] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-7"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[#2478FF] opacity-20 blur-[75px]" />

            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2478FF]/20 bg-[#2478FF]/10 text-[#78AEFF]">
                  <ShieldIcon className="h-5 w-5" />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPendingSwitch(null)
                  }
                  disabled={loading !== null}
                  aria-label="Close plan switch dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#78AEFF]">
                You still have free trial time
              </p>

              <h3
                id="trial-switch-title"
                className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white"
              >
                Choose how you want to continue.
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/50">
                Switch to {targetPlanDetails.name} and choose
                whether you want to pay monthly or annually.
                Your current free trial remains available if
                you choose to keep it.
              </p>

              {/* Billing cycle selector */}
              <div className="mt-5">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
                  Billing cycle
                </p>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                  <div
                    className="grid grid-cols-2 gap-1"
                    role="group"
                    aria-label="Choose billing cycle"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSwitchBillingCycle(
                          "MONTHLY"
                        );
                        setError(null);
                      }}
                      disabled={loading !== null}
                      className={`rounded-lg px-3 py-2.5 text-[11px] font-semibold transition-all ${
                        switchBillingCycle === "MONTHLY"
                          ? "bg-white/[0.10] text-white shadow-sm"
                          : "text-white/35 hover:bg-white/[0.04] hover:text-white/65"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      Monthly
                      <span className="ml-1 text-white/30">
                        {formatNaira(
                          targetPlanDetails.monthlyPrice
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSwitchBillingCycle("ANNUAL");
                        setError(null);
                      }}
                      disabled={loading !== null}
                      className={`rounded-lg px-3 py-2.5 text-[11px] font-semibold transition-all ${
                        switchBillingCycle === "ANNUAL"
                          ? "bg-[#2478FF] text-white shadow-[0_6px_18px_rgba(36,120,255,0.22)]"
                          : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      Annual
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                          switchBillingCycle ===
                          "ANNUAL"
                            ? "bg-white/15 text-white"
                            : "bg-emerald-400/10 text-emerald-300"
                        }`}
                      >
                        Save 5%
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Selected billing summary */}
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
                      {targetPlanDetails.name} ·{" "}
                      {switchBillingCycle === "ANNUAL"
                        ? "Annual"
                        : "Monthly"}
                    </p>

                    <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                      {targetPriceLabel}
                    </p>
                  </div>

                  {switchBillingCycle ===
                    "ANNUAL" && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-emerald-300">
                        Save{" "}
                        {formatNaira(
                          targetAnnualSavings
                        )}
                      </p>

                      <p className="mt-0.5 text-[9px] text-white/25">
                        {formatNaira(
                          targetAnnualEquivalent
                        )}
                        /month equivalent
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {quoteLoading && <p className="mt-4 text-sm text-white/60">Confirming your price…</p>}
              {quoteError && <p role="alert" className="mt-4 text-sm text-red-300">{quoteError}</p>}
              {offerQuote?.offer && <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100"><strong>{offerQuote.offer.title} · {offerQuote.offer.percent}% off</strong><p>{offerQuote.offer.remainingCycles} discounted payment(s), then automatically renews at {formatNaira(offerQuote.standardPriceNgn)} per {switchBillingCycle === "ANNUAL" ? "year" : "month"}. The benefit starts with the first successful payment; switching plans does not restart it.</p></div>}
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void runSwitch(
                      pendingSwitch,
                      true,
                      switchBillingCycle
                    )
                  }
                  disabled={loading !== null || quoteLoading || !offerQuote}
                  className="group inline-flex min-h-12 items-center justify-between rounded-xl bg-[#2478FF] px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:bg-[#1768E8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {loading
                      ? "Starting checkout..."
                      : `Pay ${targetPriceLabel} now`}
                  </span>

                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                {isStillInTrial && <button
                  type="button"
                  onClick={() =>
                    void runSwitch(
                      pendingSwitch,
                      false,
                      switchBillingCycle
                    )
                  }
                  disabled={loading !== null}
                  className="min-h-12 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Switch plan and keep my trial
                </button>}
              </div>

              <p className="mt-4 text-center text-[10px] leading-4 text-white/25">
                Your existing marketing workspaces and content
                stay on your account.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}