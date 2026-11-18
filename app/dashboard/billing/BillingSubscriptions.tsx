"use client";

import { useEffect, useState } from "react";
import SubscriptionCheckoutButton from "@/components/billing/SubscriptionCheckoutButton";

import { getContentWorkspaceFeatureList } from "@/lib/contentWorkspaceEntitlements";


import UiSymbol from "@/components/ui/UiSymbol";
import Link from "next/link";

import { TIERS } from "@/lib/subscriptionTiers";
import SubscribeButton from "@/components/SubscribeButton";
import CancelSubscriptionButton from "@/components/CancelSubscriptionButton";
import TrialCountdownBanner from "@/components/calendars/TrialCountdownBanner";
import CalendarBillingSettings, { type WorkspacePlanSwitchRequest } from "@/components/calendars/CalendarBillingSettings";

import {
  CONTENT_WORKSPACE_PLANS,
  CONTENT_WORKSPACE_PLAN_ORDER,
  formatWorkspaceLimit,
  type ContentWorkspacePlan,
} from "@/lib/contentWorkspaceEntitlements";

type Product = "delivery" | "content-workspace" | "engage" | "portfolio";

type BillingCycle = "MONTHLY" | "ANNUAL";

type WorkspaceBillingStatus =
  | "PENDING_SETUP"
  | "TRIAL"
  | "ACTIVE"
  | "OFFLINE";

type OfferPrices = Record<string, { title: string; percent: number; months: number; standardPriceNgn: number; priceNgn: number; remainingCycles: number }>;

type BillingSubscriptionsProps = {
  benefits?: React.ReactNode;
  offerPrices?: OfferPrices;
  creator: {
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  };

usage: {
  complimentary?: boolean;
  tier: "FREE" | "STARTER" | "GROWTH" | "UNLIMITED";
  used: number;
  limit: number;
  remaining: number;
  atCap: boolean;
  nextTier?: {
    name: string;
    limit: number | null;
    priceNgnMonthly: number;
  } | null;
};

  workspaceBilling: {
  recurringPriceNgn?: number;
  contentWorkspacePlan: ContentWorkspacePlan | null;
  contentWorkspaceBillingStatus: WorkspaceBillingStatus;
  contentWorkspaceBillingCycle: BillingCycle | null;
  contentWorkspaceTrialUsedAt: Date | null;
  contentWorkspaceTrialEndsAt: Date | null;
  contentWorkspaceSubscriptionRenewsAt: Date | null;
  isComped: boolean;
  compedUntil: Date | null;
} | null;

  selectedProduct: Product;
  selectedTier: string | null;
  selectedCycle: BillingCycle;
};

/* ============================================================
   ICONS
============================================================ */

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
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRightIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      aria-hidden="true"
    >
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeliveryIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M8 9h8M8 13h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="m15 16 2.5-2.5L20 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkspaceIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M3 9.5h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M7 13h3M14 13h3M7 16.5h3M14 16.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PortfolioIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="8.5"
        cy="9"
        r="1.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="m3 16 5-5 4 4 3-3 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function getComplimentaryPeriod(
  compedUntil: Date | null
): {
  label: string;
  detail: string;
} {
  if (!compedUntil) {
    return {
      label: "Complimentary access",
      detail: "No expiration date",
    };
  }

  const end = new Date(compedUntil);
  const now = new Date();

  if (end.getTime() <= now.getTime()) {
    return {
      label: "Complimentary access ended",
      detail: `Access ended ${formatDate(end)}`,
    };
  }

  let months =
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth());

  const monthAnchor = new Date(now);
  monthAnchor.setMonth(monthAnchor.getMonth() + months);

  if (monthAnchor.getTime() > end.getTime()) {
    months -= 1;
  }

  if (months >= 1) {
    return {
      label: `${months} month${months === 1 ? "" : "s"} remaining`,
      detail: `Complimentary access ends ${formatDate(end)}`,
    };
  }

  const days = Math.max(
    0,
    Math.ceil(
      (end.getTime() - now.getTime()) /
        86400000
    )
  );

  return {
    label: `${days} day${days === 1 ? "" : "s"} remaining`,
    detail: `Complimentary access ends ${formatDate(end)}`,
  };
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDeliveryPlanName(
  tier: "FREE" | "STARTER" | "GROWTH" | "UNLIMITED"
) {
  const names = {
    FREE: "Free",
    STARTER: "Starter",
    GROWTH: "Growth",
    UNLIMITED: "Agency",
  } as const;

  return names[tier];
}

function getDeliveryStatus(
  tier: string
) {
  if (tier === "FREE") {
    return {
      label: "Free plan",
      dot: "#98A2B3",
      text: "#475467",
      bg: "#F2F4F7",
      border: "#EAECF0",
    };
  }

  return {
    label: "Active",
    dot: "#22C55E",
    text: "#067647",
    bg: "#ECFDF3",
    border: "#D1FADF",
  };
}

function getWorkspaceStatus(
  status: WorkspaceBillingStatus
) {
  if (status === "ACTIVE") {
    return {
      label: "Active",
      dot: "#22C55E",
      text: "#067647",
      bg: "#ECFDF3",
      border: "#D1FADF",
    };
  }

  if (status === "TRIAL") {
    return {
      label: "Free trial",
      dot: "#2478FF",
      text: "#175CD3",
      bg: "#EFF8FF",
      border: "#D1E9FF",
    };
  }

  if (status === "OFFLINE") {
    return {
      label: "Offline",
      dot: "#F04438",
      text: "#B42318",
      bg: "#FEF3F2",
      border: "#FECDCA",
    };
  }

  return {
    label: "Setup required",
    dot: "#F79009",
    text: "#B54708",
    bg: "#FFFAEB",
    border: "#FEDF89",
  };
}

function DeliverySubscription({
  offerPrices = {},
  usage,
  selectedTier,
  selectedCycle,
}: {
  offerPrices?: OfferPrices;
  usage: BillingSubscriptionsProps["usage"];
  selectedTier: string | null;
  selectedCycle: BillingCycle;
}) {
  const status = { ...getDeliveryStatus(usage.tier), ...(usage.complimentary ? { label: "Complimentary access" } : {}) };
  const planName = getDeliveryPlanName(usage.tier);

  useEffect(() => {
    if (selectedTier && ["STARTER", "GROWTH", "UNLIMITED"].includes(selectedTier)) {
      document.getElementById(`delivery-plan-${selectedTier}`)?.scrollIntoView({ block: "start" });
    }
  }, [selectedTier]);

  const tiers = [
    {
      key: "FREE" as const,
      name: "Free",
      priceMonthly: 0,
      priceAnnual: 0,
      description:
        "A simple place to start delivering creative work.",
      features: [
        "1 project per 30 days",
        "Password-protected delivery",
        "Custom presentation",
        "Client feedback",
        "Project analytics",
      ],
    },
    {
      key: "STARTER" as const,
      name: "Starter",
      priceMonthly: TIERS.STARTER.priceNgnMonthly,
      priceAnnual: TIERS.STARTER.priceNgnAnnual,
      description:
        "For creators taking on clients consistently.",
      features: [
        "Up to 5 projects per billing cycle",
        "Password-protected delivery",
        "Client feedback",
        "Individual + ZIP downloads",
        "Dashboard analytics",
      ],
    },
    {
      key: "GROWTH" as const,
      name: "Growth",
      priceMonthly: TIERS.GROWTH.priceNgnMonthly,
      priceAnnual: TIERS.GROWTH.priceNgnAnnual,
      description:
        "For studios and creators delivering every week.",
      features: [
        "Up to 20 projects per billing cycle",
        "Client feedback",
        "Individual + ZIP downloads",
        "Dashboard analytics",
        "Priority support",
      ],
    },
    {
      key: "UNLIMITED" as const,
      name: getDeliveryPlanName("UNLIMITED"),
      priceMonthly: TIERS.UNLIMITED.priceNgnMonthly,
      priceAnnual: TIERS.UNLIMITED.priceNgnAnnual,
      description:
        "For teams who no longer want to count projects.",
      features: [
        "Unlimited projects",
        "Full delivery experience",
        "Client feedback",
        "Individual + ZIP downloads",
        "Highest priority support",
      ],
    },
  ];

  return (
    <section
      id="project-delivery-subscription"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold text-blue-700">{status.label}</p>
          <h3 className="mt-1 text-lg font-semibold">{planName}</h3>
          {usage.atCap && <p className="mt-1 text-sm text-slate-600">Project limit reached for this billing period.</p>}
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold tabular-nums">{usage.used}{usage.limit === Infinity ? "" : ` of ${usage.limit}`} projects used</p>
          <p className="mt-0.5 text-xs text-slate-600">This billing period</p>
        </div>
      </div>

      {/* Plans */}
      <div id="project-delivery-plans" className="scroll-mt-6">
        <h3 className="mb-4 text-lg font-semibold">Compare plans</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((plan) => {
            const isCurrent =
              usage.tier === plan.key;

            const isSelected =
              selectedTier === plan.key &&
              !isCurrent;

            const offer = offerPrices[`DELIVERY:${plan.key}:${selectedCycle}`];
            const price = offer?.priceNgn ?? (selectedCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly);

            return (
              <div
                key={plan.key}
                id={`delivery-plan-${plan.key}`}
                style={{ scrollMarginTop: 24 }}
                className={`relative overflow-hidden rounded-[24px] border bg-white p-5 transition-all duration-300 sm:p-6 ${
                  isCurrent
                    ? "border-[#2478FF] shadow-[0_12px_40px_rgba(36,120,255,0.10)]"
                    : isSelected
                      ? "border-[#2478FF] shadow-[0_12px_40px_rgba(36,120,255,0.10)]"
                      : "border-[#E7E9EE] hover:-translate-y-0.5 hover:border-[#D0D5DD] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]"
                }`}
              >
                {isCurrent && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#2478FF]">
                    Current
                  </div>
                )}

                {isSelected && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#101828] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
                    Selected
                  </div>
                )}

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                  {plan.name}
                </p>

                {offer && <p className="mt-3 text-xs text-[#2478FF]"><span className="mr-2 text-[#98A2B3] line-through">{formatNaira(offer.standardPriceNgn)}</span>{offer.percent}% off for {offer.remainingCycles} payment(s)</p>}
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-[30px] font-semibold tracking-[-0.04em] text-[#101828]">
                    {price === 0
                      ? "₦0"
                      : formatNaira(price)}
                  </span>

                  {price > 0 && (
                    <span className="mb-1 text-xs text-[#98A2B3]">
                      {selectedCycle === "ANNUAL"
                        ? "/year"
                        : "/month"}
                    </span>
                  )}
                </div>

                {selectedCycle === "ANNUAL" &&
                  price > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-[#2478FF]">
                      Equivalent to{" "}
                      {formatNaira(
                        Math.round(
                          price / 12
                        )
                      )}
                      /month
                    </p>
                  )}

                <p className="mt-4 min-h-[42px] text-xs leading-5 text-[#667085]">
                  {plan.description}
                </p>

                <div className="mt-5 space-y-2.5 border-t border-[#EAECF0] pt-5">
                  {plan.features.map(
                    (feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-2 text-[11px] text-[#475467]"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#12B76A]">
                          <CheckIcon className="h-2.5 w-2.5" />
                        </span>

                        {feature}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-[#067647]">
                        You are currently on this plan.
                      </div>

                      {offer && plan.key !== "FREE" && <SubscribeButton tier={plan.key} cycle={selectedCycle} label="Activate this offer" />}
                      {usage.tier !== "FREE" && !usage.complimentary && (
                        <CancelSubscriptionButton />
                      )}
                    </div>
                  ) : plan.key === "FREE" ? (
                    usage.complimentary ? <span className="text-xs text-[#667085]">Complimentary access is active</span> : <CancelSubscriptionButton label="Downgrade to Free" />
                  ) : (
                    <SubscribeButton
                      tier={plan.key}
                      cycle={selectedCycle}
                      label={
                        usage.tier === "FREE"
                          ? `Choose ${plan.name}`
                          : `Switch to ${plan.name}`
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}

/* ============================================================
   MARKETING WORKSPACE
============================================================ */

function ContentWorkspaceSubscription({
  selectedTier,
  offerPrices = {},
  workspaceBilling,
  selectedCycle,
}: {
  selectedTier?: string | null;
  offerPrices?: OfferPrices;
  workspaceBilling:
    BillingSubscriptionsProps["workspaceBilling"];

  selectedCycle: BillingCycle;
}) {
  useEffect(() => {
    if (selectedTier && CONTENT_WORKSPACE_PLAN_ORDER.includes(selectedTier as ContentWorkspacePlan)) document.getElementById(`workspace-plan-${selectedTier}`)?.scrollIntoView({ block: "start" });
  }, [selectedTier]);
  const [switchRequest, setSwitchRequest] = useState<WorkspacePlanSwitchRequest | null>(null);
  const [switchBusy, setSwitchBusy] = useState(false);

  const plan =
    workspaceBilling?.contentWorkspacePlan;

  const billingStatus =
    workspaceBilling?.contentWorkspaceBillingStatus ??
    "PENDING_SETUP";

  const billingCycle =
    workspaceBilling?.contentWorkspaceBillingCycle ??
    selectedCycle;

  const status = workspaceBilling?.isComped
  ? {
      label: "Complimentary access",
      dot: "#2478FF",
      text: "#175CD3",
      bg: "#EFF8FF",
      border: "#D1E9FF",
    }
  : getWorkspaceStatus(billingStatus);

  const complimentaryPeriod =
  workspaceBilling?.isComped
    ? getComplimentaryPeriod(
        workspaceBilling.compedUntil
      )
    : null;

  /*
   * If the account has not created a Marketing Workspace
   * yet, send the user to the actual workspace entry point.
   *
   * We deliberately do not invent another subscription
   * endpoint here.
   */
  if (!plan) {
    return (
      <section
        id="content-workspace-subscription"
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#DCE7FF] bg-white p-5">
          <p className="text-sm text-slate-600">Try Marketing Workspace free for 3 days with full Agency access.</p>
          <Link href="/dashboard/calendars" className="text-sm font-semibold text-blue-700 hover:underline">
            Start Marketing Workspace
          </Link>
        </div>

        <WorkspacePlanComparison
        selectedTier={selectedTier}
          offerPrices={offerPrices}
          selectedCycle={selectedCycle}
          currentPlan={null}
        />
      </section>
    );
  }

  return (
    <section id="content-workspace-subscription" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold text-blue-700">{status.label}</p>
          <h3 className="mt-1 text-lg font-semibold">{CONTENT_WORKSPACE_PLANS[plan].name}</h3>
          {complimentaryPeriod ? (
            <p className="mt-1 text-sm text-slate-600">{complimentaryPeriod.detail}</p>
          ) : billingStatus === "ACTIVE" && workspaceBilling?.contentWorkspaceSubscriptionRenewsAt ? (
            <p className="mt-1 text-sm text-slate-600">Renews {formatDate(workspaceBilling.contentWorkspaceSubscriptionRenewsAt)}</p>
          ) : null}
        </div>
        <Link href={plan === "ENGAGE" ? "/dashboard/engage?billing=1" : "/dashboard/calendars"} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
          {plan === "ENGAGE" ? "Manage Engage" : "Open Marketing Workspace"}
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {workspaceBilling && plan !== "ENGAGE" &&
        (workspaceBilling.isComped || billingStatus === "TRIAL" || billingStatus === "OFFLINE") && (
          <TrialCountdownBanner
            plan={plan}
            billingStatus={billingStatus}
            trialEndsAt={workspaceBilling.contentWorkspaceTrialEndsAt?.toISOString() ?? ""}
            isComped={workspaceBilling.isComped}
            compedUntil={workspaceBilling.compedUntil?.toISOString() ?? null}
          />
        )}

      {/* Existing billing settings */}
      <div>
        <CalendarBillingSettings
          plan={plan}
          recurringPriceNgn={workspaceBilling?.recurringPriceNgn}
          hidePlanComparison
          switchRequest={switchRequest}
          onBusyChange={setSwitchBusy}
          billingStatus={billingStatus}
          billingCycle={billingCycle}
          subscriptionRenewsAt={
            workspaceBilling?.contentWorkspaceSubscriptionRenewsAt
              ? workspaceBilling.contentWorkspaceSubscriptionRenewsAt.toISOString()
              : null
          }
          trialEndsAt={
            workspaceBilling?.contentWorkspaceTrialEndsAt
              ? workspaceBilling.contentWorkspaceTrialEndsAt.toISOString()
              : null
          }
        />
      </div>

      <WorkspacePlanComparison
        selectedTier={selectedTier}
          offerPrices={offerPrices}
        selectedCycle={selectedCycle}
        currentPlan={billingStatus === "ACTIVE" ? plan : null}
        trialPlan={billingStatus === "TRIAL" ? plan : null}
        switching={switchBusy}
        onSelectPlan={(nextPlan) => setSwitchRequest({ plan: nextPlan, billingCycle: selectedCycle })}
      />
    </section>
  );
}

/* ============================================================
   WORKSPACE PLAN COMPARISON
============================================================ */

function WorkspacePlanComparison({
  selectedTier,
  offerPrices = {},
  selectedCycle,
  currentPlan,
  trialPlan = null,
  switching = false,
  onSelectPlan,
}: {
  selectedTier?: string | null;
  offerPrices?: OfferPrices;
  selectedCycle: BillingCycle;
  currentPlan: ContentWorkspacePlan | null;
  trialPlan?: ContentWorkspacePlan | null;
  switching?: boolean;
  onSelectPlan?: (plan: ContentWorkspacePlan) => void;
}) {
  const plans = CONTENT_WORKSPACE_PLAN_ORDER;

  return (
    <div id="content-workspace-plans" className="scroll-mt-6">
      <h3 className="mb-4 text-lg font-semibold">Compare plans</h3>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((planKey) => {
          const plan =
            CONTENT_WORKSPACE_PLANS[planKey];

          const isCurrent =
            currentPlan === planKey;

          const offer = offerPrices[`CONTENT_WORKSPACE:${planKey}:${selectedCycle}`];
          const price = offer?.priceNgn ?? (selectedCycle === "ANNUAL" ? plan.priceNgnAnnual : plan.priceNgnMonthly);

          return (
            <div
              key={planKey}
              id={`workspace-plan-${planKey}`}
              style={{ scrollMarginTop: 24 }}
              data-selected={selectedTier === planKey ? "true" : undefined}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 transition-colors ${
                isCurrent || selectedTier === planKey
                  ? "border-[#2478FF] shadow-[0_12px_40px_rgba(36,120,255,0.10)]"
                  : "border-[#E7E9EE] hover:-translate-y-0.5 hover:border-[#D0D5DD] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]"
              }`}
            >
              {isCurrent && (
                <div className="absolute right-5 top-5 rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#2478FF]">
                  Current plan
                </div>
              )}

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2478FF]">
                {plan.name}
              </p>

              {offer && <p className="mt-3 text-xs text-[#2478FF]"><span className="mr-2 text-[#98A2B3] line-through">{formatNaira(offer.standardPriceNgn)}</span>{offer.percent}% off for {offer.remainingCycles} payment(s)</p>}
              <div className="mt-3 flex items-end gap-1">
                <span className="text-[31px] font-semibold tracking-[-0.045em] text-[#101828]">
                  {formatNaira(price)}
                </span>

                <span className="mb-1 text-xs text-[#98A2B3]">
                  {selectedCycle === "ANNUAL"
                    ? "/year"
                    : "/month"}
                </span>
              </div>

              {selectedCycle === "ANNUAL" && (
                <p className="mt-1 text-[10px] font-medium text-[#2478FF]">
                  5% annual savings
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2">
                <WorkspaceMiniStat
                  label="Workspaces"
                  value={formatWorkspaceLimit(plan.activeWorkspaces)}
                />

                <WorkspaceMiniStat
                  label="Collaborators"
                  value={formatWorkspaceLimit(plan.collaborators)}
                />

                <WorkspaceMiniStat
                  label="Storage"
                  value={
                    `${plan.storageBytes / 1_000_000_000} GB`
                  }
                />

                <WorkspaceMiniStat
                  label="AI / month"
                  value={String(
                    plan.aiGenerations
                  )}
                />
              </div>

              <div className="mt-6 border-t border-[#EAECF0] pt-5">
                <p className="text-[11px] font-semibold text-[#344054]">
                  Included
                </p>

                <div className="mt-3 space-y-2">
                  {getContentWorkspaceFeatureList(planKey).map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-[11px] text-[#667085]"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ECFDF3] text-[#12B76A]">
                        <CheckIcon className="h-2.5 w-2.5" />
                      </span>

                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-6">
                {isCurrent ? (
                  <span className="text-[11px] font-semibold text-[#067647]">Current plan</span>
                ) : currentPlan || (trialPlan && trialPlan !== planKey) ? (
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => onSelectPlan?.(planKey)}
                    className="group inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-xs font-semibold text-[#344054] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Switch to {plan.name}
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <SubscriptionCheckoutButton product="CONTENT_WORKSPACE" plan={planKey} cycle={selectedCycle} label={`Subscribe to ${plan.name}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#2478FF] px-4 py-2.5 text-xs font-semibold text-white"/>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3">
      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#98A2B3]">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#101828]">
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function BillingSubscriptions({
  benefits,
  offerPrices,
  creator,
  usage,
  workspaceBilling,
  selectedProduct,
  selectedTier,
  selectedCycle,
}: BillingSubscriptionsProps) {
  const workspacePlan = workspaceBilling?.contentWorkspacePlan;
  const workspaceStatus = workspaceBilling?.isComped
    ? "Complimentary access"
    : getWorkspaceStatus(workspaceBilling?.contentWorkspaceBillingStatus ?? "PENDING_SETUP").label;
  const products = [
    {
      key: "delivery",
      title: "Project Delivery",
      icon: <DeliveryIcon />,
      status: usage.complimentary ? "Complimentary access" : `Current plan · ${getDeliveryPlanName(usage.tier)}`,
    },
    {
      key: "content-workspace",
      title: "Marketing Workspace",
      icon: <WorkspaceIcon />,
      status: workspacePlan && workspacePlan !== "ENGAGE"
        ? `${CONTENT_WORKSPACE_PLANS[workspacePlan].name} · ${workspaceStatus}` : "Content planning & publishing",
    },
    {
      key: "engage",
      title: "Showwork Engage",
      icon: <UiSymbol name="message" />,
      status: workspacePlan === "ENGAGE" ? workspaceStatus : "Conversations & AI replies",
    },
    {
      key: "portfolio",
      title: "Portfolio",
      icon: <PortfolioIcon />,
      status: "No subscription required",
    },
  ];
  const selected = products.find((product) => product.key === selectedProduct);
  const activeMarketing = workspacePlan && workspacePlan !== "ENGAGE" && workspaceBilling?.contentWorkspaceBillingStatus === "ACTIVE";
  const engage = CONTENT_WORKSPACE_PLANS.ENGAGE;
  const engageOffer = offerPrices?.[`CONTENT_WORKSPACE:ENGAGE:${selectedCycle}`];
  const engagePrice = selectedCycle === "ANNUAL" ? engage.priceNgnAnnual : engage.priceNgnMonthly;

  return (
    <main className="min-h-screen bg-[#f5f7fc] text-[#101828]">
      <header className="bg-[#0b1534] bg-[radial-gradient(ellipse_at_top_right,_#224ab0,_transparent_65%)] text-white">
        <div className="mx-auto max-w-[1280px] px-5 pb-9 pt-6 sm:px-8 sm:pb-12">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
            <Link href="/dashboard" aria-label="Showwork dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo/swwhite.svg" alt="Showwork" width={112} height={19} />
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-100 hover:text-white">
              <UiSymbol name="left" /> Back to dashboard
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Billing &amp; subscriptions</h1>
              <p className="mt-3 text-sm text-blue-100 sm:text-base">View your subscriptions and compare Showwork plans.</p>
            </div>
            <Link href="/dashboard/profile" aria-label="Edit your profile" className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-blue-50 hover:bg-white/15">
              {creator.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
              )}
              <span className="break-all">{creator.name || creator.email}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-6 sm:px-8">
        <nav aria-label="Billing products" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={product.key} href={`/dashboard/billing?product=${product.key}&cycle=${selectedCycle}`}
              aria-current={selectedProduct === product.key ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl p-3 text-sm transition-colors ${selectedProduct === product.key ? "bg-[#173fb2] text-white" : "text-slate-800 hover:bg-blue-50"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selectedProduct === product.key ? "bg-white/15" : "bg-blue-50 text-blue-700"}`}>{product.icon}</span>
              <span>
                <span className="block font-semibold">{product.title}</span>
                <span className={`mt-0.5 block text-xs ${selectedProduct === product.key ? "text-blue-100" : "text-slate-600"}`}>{product.status}</span>
              </span>
            </Link>
          ))}
        </nav>

        <section id="subscription-details" aria-labelledby="billing-product-title" className="mt-7 scroll-mt-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 id="billing-product-title" className="text-2xl font-semibold tracking-tight">{selected?.title}</h2>
            {selectedProduct !== "portfolio" && <nav aria-label="Billing cycle" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {(["MONTHLY", "ANNUAL"] as const).map((cycle) => (
                <Link key={cycle} aria-current={selectedCycle === cycle ? "true" : undefined}
                  href={`/dashboard/billing?product=${selectedProduct}&cycle=${cycle}${selectedTier ? `&tier=${encodeURIComponent(selectedTier)}` : ""}#subscription-details`}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${selectedCycle === cycle ? "bg-[#173fb2] text-white" : "text-slate-600 hover:bg-blue-50"}`}>
                  {cycle === "MONTHLY" ? "Monthly" : "Annual"}
                </Link>
              ))}
            </nav>}
          </div>
          {selectedProduct === "delivery" ? (
            <DeliverySubscription offerPrices={offerPrices} usage={usage} selectedTier={selectedTier} selectedCycle={selectedCycle} />
          ) : selectedProduct === "content-workspace" ? (
            <ContentWorkspaceSubscription selectedTier={selectedTier} offerPrices={offerPrices} workspaceBilling={workspaceBilling} selectedCycle={selectedCycle} />
          ) : selectedProduct === "portfolio" ? (
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <div>
                <h3 className="text-lg font-semibold">Free plan</h3>
                <p className="mt-1 text-sm text-slate-600">Your Portfolio is free to use and has no recurring charges.</p>
              </div>
              <Link href="/dashboard/portfolio" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                Manage Portfolio <ArrowUpRightIcon />
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid md:grid-cols-[1.3fr_1fr]">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold tracking-tight">Manage conversations across channels</h3>
                <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  {getContentWorkspaceFeatureList("ENGAGE").map((feature) => (
                    <li key={feature} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-blue-700" />{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-blue-100 bg-blue-50 p-6 sm:p-8 md:border-l md:border-t-0">
                <p className="text-sm font-semibold text-blue-900">{selectedCycle === "ANNUAL" ? "Annual plan" : "Monthly plan"}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{formatNaira(engageOffer?.priceNgn ?? engagePrice)}<span className="ml-1 text-sm font-normal text-slate-600">/{selectedCycle === "ANNUAL" ? "year" : "month"}</span></p>
                {engageOffer && <p className="mt-2 text-sm text-blue-900">{engageOffer.percent}% off for {engageOffer.remainingCycles} {engageOffer.remainingCycles === 1 ? "payment" : "payments"}, then {formatNaira(engageOffer.standardPriceNgn)} per {selectedCycle === "ANNUAL" ? "year" : "month"}.</p>}
                {!engageOffer && <p className="mt-2 text-sm text-slate-600">{selectedCycle === "ANNUAL" ? "Save ₦29,800 compared with monthly billing." : `Annual billing is ${formatNaira(engage.priceNgnAnnual)} per year.`}</p>}
                {activeMarketing && <p className="mt-4 text-sm text-slate-700">Your account has an active Marketing Workspace subscription. Your account can have one of these subscriptions at a time.</p>}
                <Link href={`/dashboard/engage?billing=1&cycle=${selectedCycle}`} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173fb2] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                  {workspacePlan === "ENGAGE" ? "Manage Engage" : "View Engage options"} <ArrowRightIcon />
                </Link>
              </div>
            </div>
          )}
        </section>

        {benefits && <div className="mt-8">{benefits}</div>}
      </div>
    </main>
  );
}
