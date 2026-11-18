"use client";

import { useEffect, useState } from "react";
import styles from "./BillingDashboard.module.css";
import { BillingCancellation, BillingDetailsForm, BillingPaymentMethod, type BillingDetails } from "./BillingAccountControls";
import SubscriptionCheckoutButton from "@/components/billing/SubscriptionCheckoutButton";

import { getContentWorkspaceFeatureList } from "@/lib/contentWorkspaceEntitlements";


import UiSymbol from "@/components/ui/UiSymbol";
import Link from "next/link";

import { TIERS } from "@/lib/subscriptionTiers";
import SubscribeButton from "@/components/SubscribeButton";
import CancelSubscriptionButton from "@/components/CancelSubscriptionButton";
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
  history?: React.ReactNode;
  account?: {
    deliveryActive: boolean;
    deliveryTier: "FREE" | keyof typeof TIERS;
    deliveryCycle: BillingCycle | null;
    deliveryRenewsAt: Date | null;
    deliveryAmount: number | null;
    deliveryCard: boolean;
    workspacePlan: ContentWorkspacePlan | null;
    workspaceCard: boolean;
    seatsUsed: number | null;
    detailsAvailable: boolean;
    details: BillingDetails;
  };
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

function PlanFeatures({ features }: { features: string[] }) {
  const renderFeature = (feature: string) => (
    <li key={feature} className="flex items-start gap-1.5">
      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#155FC7]" />
      <span>{feature}</span>
    </li>
  );

  return (
    <div className="mt-3 text-xs leading-5 text-slate-700">
      <ul className="space-y-1">{features.slice(0, 2).map(renderFeature)}</ul>
      {features.length > 2 && (
        <details className="group mt-1">
          <summary className="flex min-h-11 cursor-pointer list-none sm:min-h-9 items-center gap-1.5 font-medium text-[#155FC7] [&::-webkit-details-marker]:hidden">
            All features <span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="space-y-1 border-t border-[#d9e6f5] pt-2">{features.slice(2).map(renderFeature)}</ul>
        </details>
      )}
    </div>
  );
}

const planSurfaces = ["bg-white", "bg-[#f0f8f7]", "bg-[#f0f5fc]", "bg-[#e3efff]"];

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
      <p className="w-fit rounded-lg bg-[#edf4ff] px-3 py-2 text-sm text-slate-700">
        {usage.used}{usage.limit === Infinity ? "" : ` of ${usage.limit}`} projects used this billing period
      </p>

      {/* Plans */}
      <div id="project-delivery-plans" className="scroll-mt-6">
        <h3 className="mb-3 text-lg font-medium">Compare plans</h3>
        <div className="grid gap-3 sm:auto-rows-fr sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((plan, index) => {
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
                data-billing-card
                style={{ scrollMarginTop: 24 }}
                className={`relative flex flex-col rounded-2xl border p-3.5 transition-colors sm:p-4 ${planSurfaces[index]} ${
                  isCurrent
                    ? "border-[#155FC7]"
                    : isSelected
                      ? "border-[#155FC7]"
                      : "border-[#E7E9EE] hover:border-[#b9cde7]"
                }`}
              >
                {isCurrent && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#155FC7]">
                    Current
                  </div>
                )}

                {isSelected && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#101828] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
                    Selected
                  </div>
                )}

                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#155FC7]">
                  {plan.name}
                </p>

                {offer && <p className="mt-3 text-xs text-[#155FC7]"><span className="mr-2 text-[#98A2B3] line-through">{formatNaira(offer.standardPriceNgn)}</span>{offer.percent}% off for {offer.remainingCycles} payment(s)</p>}
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-[26px] font-medium tracking-[-0.04em] text-[#101828]">
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
                    <p className="mt-1 text-[10px] font-medium text-[#155FC7]">
                      Equivalent to{" "}
                      {formatNaira(
                        Math.round(
                          price / 12
                        )
                      )}
                      /month
                    </p>
                  )}

                <PlanFeatures features={plan.features} />

                <div className="mt-auto pt-2.5">
                  {isCurrent ? (
                    <div className="space-y-3">
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

  const trialEnd = workspaceBilling?.contentWorkspaceTrialEndsAt;
  const restoreAccess = billingStatus === "OFFLINE" || (billingStatus === "TRIAL" && !!trialEnd && new Date(trialEnd).getTime() <= Date.now());
  const showSubscribe = plan && plan !== "ENGAGE" && !workspaceBilling?.isComped && (billingStatus === "TRIAL" || restoreAccess);

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
          <Link href="/dashboard/calendars" className="text-sm font-semibold text-[#155FC7] hover:underline">
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {plan === "ENGAGE" ? (
          <div data-billing-card className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[#dbe9fb] bg-[#edf4ff] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{billingStatus === "ACTIVE" ? "You’re on Showwork Engage" : billingStatus === "TRIAL" && !restoreAccess ? "You’re trying Showwork Engage" : "Your Engage access is inactive"}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-600">Engage and Marketing Workspace are separate plans. Compare Marketing Workspace plans below.</p>
            </div>
            <Link href="/dashboard/billing?product=engage" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-[#155FC7] hover:bg-[#f5f9ff]">
              View Engage billing <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div data-billing-card className="flex w-fit flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#edf4ff] px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{CONTENT_WORKSPACE_PLANS[plan].name}</span>
            <span className="rounded-md bg-white px-2 py-1 text-xs text-[#155FC7]">{restoreAccess && !workspaceBilling?.isComped ? "Restore workspace access" : status.label}</span>
            {complimentaryPeriod ? (
              <span className="text-xs text-slate-600">{complimentaryPeriod.detail}</span>
            ) : billingStatus === "ACTIVE" && workspaceBilling?.contentWorkspaceSubscriptionRenewsAt ? (
              <span className="text-xs text-slate-600">Renews {formatDate(workspaceBilling.contentWorkspaceSubscriptionRenewsAt)}</span>
            ) : billingStatus === "TRIAL" && !restoreAccess && trialEnd ? (
              <span className="text-xs text-slate-600">Ends {formatDate(trialEnd)}</span>
            ) : null}
            <Link href="/dashboard/calendars" className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-[#155FC7] hover:underline">
              Open workspace <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        {showSubscribe && (
          <SubscriptionCheckoutButton product="CONTENT_WORKSPACE" plan={plan} cycle={selectedCycle}
            label={restoreAccess ? "Subscribe & restore access" : "Subscribe now"}
            className="min-h-11 rounded-lg bg-[#155FC7] px-3 text-sm font-medium text-white hover:brightness-95" />
        )}
        <CalendarBillingSettings
          plan={plan}
          recurringPriceNgn={workspaceBilling?.recurringPriceNgn}
          hidePlanComparison
          compactTrigger
          switchRequest={switchRequest}
          onBusyChange={setSwitchBusy}
          billingStatus={billingStatus}
          billingCycle={billingCycle}
          subscriptionRenewsAt={workspaceBilling?.contentWorkspaceSubscriptionRenewsAt?.toISOString() ?? null}
          trialEndsAt={workspaceBilling?.contentWorkspaceTrialEndsAt?.toISOString() ?? null}
        />
      </div>

      <WorkspacePlanComparison
        selectedTier={selectedTier}
          offerPrices={offerPrices}
        selectedCycle={selectedCycle}
        currentPlan={billingStatus === "ACTIVE" ? plan : null}
        trialPlan={billingStatus === "TRIAL" && !restoreAccess ? plan : null}
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
      <h3 className="mb-3 text-lg font-medium">Compare plans</h3>

      <div className="grid gap-3 sm:auto-rows-fr sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((planKey, index) => {
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
              data-billing-card
              style={{ scrollMarginTop: 24 }}
              data-selected={selectedTier === planKey ? "true" : undefined}
              className={`relative flex flex-col rounded-2xl border p-3.5 transition-colors sm:p-4 ${planSurfaces[index]} ${
                isCurrent || selectedTier === planKey
                  ? "border-[#155FC7]"
                  : "border-[#E7E9EE] hover:border-[#b9cde7]"
              }`}
            >
              {isCurrent && (
                <div className="absolute right-5 top-5 rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#155FC7]">
                  Current plan
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-[#155FC7]">{plan.name}</p>
                {planKey === "UNLIMITED" && !isCurrent && <span className="w-fit rounded-full bg-[#D8F3A5] px-2 py-0.5 text-[10px] text-[#102A29]">Recommended for teams</span>}
              </div>

              {offer && <p className="mt-3 text-xs text-[#155FC7]"><span className="mr-2 text-[#98A2B3] line-through">{formatNaira(offer.standardPriceNgn)}</span>{offer.percent}% off for {offer.remainingCycles} payment(s)</p>}
              <div className="mt-3 flex items-end gap-1">
                <span className="text-[26px] font-medium tracking-[-0.045em] text-[#101828]">
                  {formatNaira(price)}
                </span>

                <span className="mb-1 text-xs text-[#98A2B3]">
                  {selectedCycle === "ANNUAL"
                    ? "/year"
                    : "/month"}
                </span>
              </div>

              {selectedCycle === "ANNUAL" && (
                <p className="mt-1 text-[10px] font-medium text-[#155FC7]">
                  5% annual savings
                </p>
              )}

              <PlanFeatures features={[
                ...getContentWorkspaceFeatureList(planKey),
                `Workspaces · ${formatWorkspaceLimit(plan.activeWorkspaces)}`,
                `Collaborators · ${formatWorkspaceLimit(plan.collaborators)}`,
                `Storage · ${plan.storageBytes / 1_000_000_000} GB`,
                `AI generations per month · ${plan.aiGenerations}`,
              ]} />

              <div className="mt-auto pt-2.5">
                {!isCurrent && (currentPlan || (trialPlan && trialPlan !== planKey) ? (
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
                  <SubscriptionCheckoutButton product="CONTENT_WORKSPACE" plan={planKey} cycle={selectedCycle} label={`Subscribe to ${plan.name}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#155FC7] px-4 py-2.5 text-xs font-semibold text-white"/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingUsage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const finite = Number.isFinite(limit);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums">{finite ? `${used} of ${limit} used` : `${used} used · Unlimited`}</span>
      </div>
      {finite && limit > 0 && (
        <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)} aria-valuetext={`${used} of ${limit} used`} className="h-1.5 overflow-hidden rounded-full bg-[#ebf1f8]">
          <div className="h-full rounded-full bg-[#155FC7]" style={{ width: `${Math.min(100, used / limit * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function BillingSubscriptions({
  benefits,
  history,
  account,
  offerPrices,
  creator,
  usage,
  workspaceBilling,
  selectedProduct,
  selectedTier,
  selectedCycle,
}: BillingSubscriptionsProps) {
  const workspacePlan = workspaceBilling?.contentWorkspacePlan;
  const products = [
    { key: "content-workspace", title: "Marketing Workspace" },
    { key: "delivery", title: "Project Delivery" },
    { key: "engage", title: "Showwork Engage" },
    { key: "portfolio", title: "Portfolio" },
  ];
  const selected = products.find((product) => product.key === selectedProduct);
  const activeMarketing = workspacePlan && workspacePlan !== "ENGAGE" && workspaceBilling?.contentWorkspaceBillingStatus === "ACTIVE";
  const engage = CONTENT_WORKSPACE_PLANS.ENGAGE;
  const engageOffer = offerPrices?.[`CONTENT_WORKSPACE:ENGAGE:${selectedCycle}`];
  const engagePrice = selectedCycle === "ANNUAL" ? engage.priceNgnAnnual : engage.priceNgnMonthly;

  const isDelivery = selectedProduct === "delivery";
  const isPortfolio = selectedProduct === "portfolio";
  const actualWorkspacePlan = account?.workspacePlan;
  const workspaceSelected = !isDelivery && !isPortfolio &&
    !!actualWorkspacePlan && (selectedProduct === "engage") === (actualWorkspacePlan === "ENGAGE");
  const workspacePaid = workspaceSelected && workspaceBilling?.contentWorkspaceBillingStatus === "ACTIVE";
  const workspaceTrial = workspaceSelected && workspaceBilling?.contentWorkspaceBillingStatus === "TRIAL" &&
    !!workspaceBilling.contentWorkspaceTrialEndsAt && new Date(workspaceBilling.contentWorkspaceTrialEndsAt).getTime() > Date.now();
  const hasPaidPlan = isDelivery ? !!account?.deliveryActive : workspacePaid;
  const hasCard = isDelivery ? !!account?.deliveryCard : workspaceSelected && !!account?.workspaceCard;
  const currentCycle = (isDelivery ? account?.deliveryCycle : workspaceBilling?.contentWorkspaceBillingCycle) ?? "MONTHLY";
  const currentWorkspace = workspaceSelected ? CONTENT_WORKSPACE_PLANS[actualWorkspacePlan!] : null;
  const workspaceAccess = selectedProduct === "content-workspace" && workspacePlan !== "ENGAGE" && workspaceBilling?.isComped ? workspacePlan : null;
  const status = isDelivery ? hasPaidPlan ? "Active" : usage.complimentary ? "Complimentary access" : hasCard ? "Payment issue" : "Free"
    : isPortfolio ? "Free" : workspacePaid ? "Active" : workspaceTrial ? "Trial"
    : workspaceAccess ? "Complimentary access" : workspaceSelected && workspaceBilling?.contentWorkspaceBillingStatus === "OFFLINE" ? "Payment issue"
    : workspaceSelected && workspaceBilling?.contentWorkspaceBillingStatus === "TRIAL" ? "Trial ended" : "No subscription";
  const planName = isDelivery ? getDeliveryPlanName(hasPaidPlan && account ? account.deliveryTier : usage.tier)
    : isPortfolio ? "Portfolio Free"
    : currentWorkspace?.name ?? (workspaceAccess ? CONTENT_WORKSPACE_PLANS[workspaceAccess].name : selected?.title);
  const deliveryPrice = account && account.deliveryTier !== "FREE" ? TIERS[account.deliveryTier] : null;
  const workspacePrice = currentWorkspace ? (currentCycle === "ANNUAL" ? currentWorkspace.priceNgnAnnual : currentWorkspace.priceNgnMonthly) : null;
  const amount = hasPaidPlan ? isDelivery
    ? account?.deliveryAmount ?? (currentCycle === "ANNUAL" ? deliveryPrice?.priceNgnAnnual : deliveryPrice?.priceNgnMonthly)
    : workspaceBilling?.recurringPriceNgn ?? workspacePrice
    : ["Free", "Trial", "Complimentary access"].includes(status) ? 0 : null;
  const nextPayment = hasPaidPlan ? (isDelivery ? account?.deliveryRenewsAt : workspaceBilling?.contentWorkspaceSubscriptionRenewsAt) : null;
  const seats = currentWorkspace && (workspacePaid || workspaceTrial) ? currentWorkspace.collaborators : null;

  return (
    <main className={`${styles.page} min-h-screen bg-[#f7f8fa] font-sans text-[#102A29]`}>
      <header className="mx-auto max-w-[1280px] px-5 pt-4 sm:px-8 sm:pt-5">
        <div className={styles.header}>
          <div className={styles.top}>
            <div className={styles.navigation}>
              <Link href="/dashboard" className={styles.brand} aria-label="Showwork dashboard">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo/swwhite.svg" alt="Showwork" width={98} height={16} />
              </Link>
              <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                <Link href="/dashboard">All tools</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Billing</span>
              </nav>
            </div>
            <Link href="/dashboard/profile" aria-label="Edit your profile" className={styles.profile}>
              {creator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt="" className={styles.avatar} />
              ) : <span aria-hidden="true" className={styles.initial}>{(creator.name || creator.email).trim().charAt(0).toUpperCase()}</span>}
              <span className={styles.profileName}>{creator.name || creator.email}</span>
            </Link>
          </div>
          <div className={styles.heading}>
            <h1>Billing &amp; Subscription</h1>
            <p>Manage your plan, payments and billing details.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-5 pb-12 pt-5 sm:px-8 lg:grid-cols-[174px_minmax(0,1fr)] lg:gap-6">
        <aside className="lg:sticky lg:top-5 lg:self-start">
        <nav aria-label="Billing products" className="grid grid-cols-2 gap-1 rounded-xl bg-[#eaf1fb] p-1 lg:grid-cols-1">
          {products.map((product) => (
            <Link key={product.key} href={`/dashboard/billing?product=${product.key}&cycle=${selectedCycle}`}
              aria-current={selectedProduct === product.key ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-2.5 lg:min-h-9 py-1.5 text-xs font-medium leading-tight transition-colors ${selectedProduct === product.key ? "bg-[#155FC7] text-white" : "text-slate-700 hover:bg-white/70"}`}>
              {product.title}
            </Link>
          ))}
        </nav>

        {account && <nav aria-label="Billing sections" className="mt-4 hidden gap-0.5 pl-2.5 text-xs lg:grid">
          <a href="#subscription-details" className="py-2 text-slate-600 hover:text-[#155FC7]">Plan management</a>
          <a href="#payment-method" className="py-2 text-slate-600 hover:text-[#155FC7]">Payment method</a>
          <a href="#billing-history" className="py-2 text-slate-600 hover:text-[#155FC7]">Billing history</a>
          <a href="#billing-details" className="py-2 text-slate-600 hover:text-[#155FC7]">Billing details</a>
        </nav>}
        </aside>

        <div className="min-w-0">

        {account && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <section data-billing-card aria-labelledby="current-subscription-title" className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="current-subscription-title" className="text-sm font-medium text-slate-600">Current subscription</h2>
                    <p className="mt-1 text-xl font-medium tracking-tight">{planName}</p>
                    <span className={hasPaidPlan ? "mt-2 inline-flex rounded-full bg-[#D8F3A5] px-2.5 py-1 text-xs text-[#102A29]" : "mt-2 inline-flex rounded-full bg-[#edf4ff] px-2.5 py-1 text-xs text-[#155FC7]"}>{status}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums">{amount == null ? "—" : formatNaira(amount)}{hasPaidPlan && <span className="ml-1 text-sm font-normal tracking-normal text-slate-600">/ {currentCycle === "ANNUAL" ? "year" : "month"}</span>}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{workspaceTrial ? `Trial ends ${formatDate(workspaceBilling?.contentWorkspaceTrialEndsAt ?? null)}` : nextPayment ? `Next payment ${formatDate(nextPayment)}` : hasPaidPlan ? "Next payment date unavailable" : "No payment scheduled"}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  {isDelivery && <BillingUsage label="Projects this period" used={usage.used} limit={usage.limit} />}
                  {seats != null && account.seatsUsed != null && <BillingUsage label="Team seats" used={account.seatsUsed} limit={seats === Number.MAX_SAFE_INTEGER ? Infinity : seats + 1} />}
                  {!isDelivery && (seats == null || account.seatsUsed == null) && <p className="text-sm text-slate-600">{isPortfolio ? "Portfolio has no recurring subscription." : "Compare plans to see what’s included."}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-[#f8fafc] px-4 py-3 sm:px-5">
                <a href="#subscription-details" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#155FC7] px-4 text-sm font-medium text-white hover:bg-[#114f9f]">Manage plan <ArrowRightIcon /></a>
                {hasPaidPlan && (!isDelivery || account.deliveryCard) && <BillingCancellation key={selectedProduct} delivery={isDelivery} product={selected?.title ?? "subscription"} />}
                {hasPaidPlan && selectedCycle !== currentCycle && (
                  <SubscriptionCheckoutButton
                    product={isDelivery ? "DELIVERY" : "CONTENT_WORKSPACE"}
                    plan={isDelivery ? account.deliveryTier : actualWorkspacePlan!}
                    cycle={selectedCycle}
                    label={selectedCycle === "ANNUAL" ? "Switch to yearly" : "Switch to monthly"}
                    className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-[#155FC7] hover:bg-[#f2f7ff]"
                  />
                )}
                {status === "Payment issue" && <a href={hasCard ? "#payment-method" : "#subscription-details"} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[#155FC7]">Resolve payment issue</a>}
              </div>
            </section>
            <BillingPaymentMethod key={selectedProduct} product={selectedProduct} available={hasCard} />
          </div>
        )}

        {history && <div className="mt-4">{history}</div>}
        {benefits && <div className="mt-4">{benefits}</div>}

        <section id="subscription-details" aria-labelledby="billing-product-title" className="mt-5 scroll-mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="billing-product-title" className="text-xl font-medium tracking-tight">{account && selectedProduct !== "portfolio" ? "Plan management" : selected?.title}</h2>
            {selectedProduct !== "portfolio" && <nav aria-label="Billing cycle" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {(["MONTHLY", "ANNUAL"] as const).map((cycle) => (
                <Link key={cycle} aria-current={selectedCycle === cycle ? "true" : undefined}
                  href={`/dashboard/billing?product=${selectedProduct}&cycle=${cycle}${selectedTier ? `&tier=${encodeURIComponent(selectedTier)}` : ""}#subscription-details`}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${selectedCycle === cycle ? "bg-[#155FC7] text-white" : "text-slate-600 hover:bg-blue-50"}`}>
                  {cycle === "MONTHLY" ? "Monthly" : "Yearly"}
                </Link>
              ))}
            </nav>}
          </div>
          {selectedProduct === "delivery" ? (
            <DeliverySubscription offerPrices={offerPrices} usage={usage} selectedTier={selectedTier} selectedCycle={selectedCycle} />
          ) : selectedProduct === "content-workspace" ? (
            <ContentWorkspaceSubscription selectedTier={selectedTier} offerPrices={offerPrices} workspaceBilling={workspaceBilling} selectedCycle={selectedCycle} />
          ) : selectedProduct === "portfolio" ? (
            <div data-billing-card className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <div>
                <h3 className="text-lg font-semibold">Free plan</h3>
                <p className="mt-1 text-sm text-slate-600">Your Portfolio is free to use and has no recurring charges.</p>
              </div>
              <Link href="/dashboard/portfolio" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                Manage Portfolio <ArrowUpRightIcon />
              </Link>
            </div>
          ) : (
            <div data-billing-card className="overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid md:grid-cols-[1.3fr_1fr]">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold tracking-tight">Manage conversations across channels</h3>
                <PlanFeatures features={getContentWorkspaceFeatureList("ENGAGE")} />
              </div>
              <div className="border-t border-blue-100 bg-blue-50 p-6 sm:p-8 md:border-l md:border-t-0">
                <p className="text-sm font-semibold text-blue-900">{selectedCycle === "ANNUAL" ? "Annual plan" : "Monthly plan"}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{formatNaira(engageOffer?.priceNgn ?? engagePrice)}<span className="ml-1 text-sm font-normal text-slate-600">/{selectedCycle === "ANNUAL" ? "year" : "month"}</span></p>
                {engageOffer && <p className="mt-2 text-sm text-blue-900">{engageOffer.percent}% off for {engageOffer.remainingCycles} {engageOffer.remainingCycles === 1 ? "payment" : "payments"}, then {formatNaira(engageOffer.standardPriceNgn)} per {selectedCycle === "ANNUAL" ? "year" : "month"}.</p>}
                {!engageOffer && <p className="mt-2 text-sm text-slate-600">{selectedCycle === "ANNUAL" ? "Save ₦29,800 compared with monthly billing." : `Annual billing is ${formatNaira(engage.priceNgnAnnual)} per year.`}</p>}
                {activeMarketing && <p className="mt-4 text-sm text-slate-700">Your account has an active Marketing Workspace subscription. Your account can have one of these subscriptions at a time.</p>}
                <Link href={`/dashboard/engage?billing=1&cycle=${selectedCycle}`} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#155FC7] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                  {workspacePlan === "ENGAGE" ? "Manage Engage" : "View Engage options"} <ArrowRightIcon />
                </Link>
              </div>
            </div>
          )}
        </section>

        {account && <div className="mt-6 space-y-4">
          <BillingDetailsForm initialDetails={account.details} available={account.detailsAvailable} />
        </div>}
        </div>
      </div>
    </main>
  );
}
