"use client";

import SubscriptionCheckoutButton from "@/components/billing/SubscriptionCheckoutButton";
import { CONTENT_WORKSPACE_PLANS } from "@/lib/contentWorkspaceEntitlements";
import { useEffect, useMemo, useState } from "react";

type ContentWorkspacePlan = "CREATOR" | "GROWTH" | "STUDIO" | "UNLIMITED";
type BillingCycle = "MONTHLY" | "ANNUAL";

const PLAN_PRICING = Object.fromEntries(
  Object.entries(CONTENT_WORKSPACE_PLANS).map(([key, plan]) => [key, {
    name: plan.name, monthly: plan.priceNgnMonthly, annual: plan.priceNgnAnnual,
  }])
) as Record<ContentWorkspacePlan, { name: string; monthly: number; annual: number }>;

function SparkIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M12 2.5l1.55 5.95L19.5 10l-5.95 1.55L12 17.5l-1.55-5.95L4.5 10l5.95-1.55L12 2.5Z" />
      <path d="M19 16.5l.7 2.8 2.8.7-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8Z" />
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

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function getMonthsAndDaysRemaining(msLeft: number) {
  const totalDays = Math.max(0, Math.ceil(msLeft / 86400000));

  if (totalDays < 30) {
    return {
      months: 0,
      days: totalDays,
    };
  }

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  return {
    months,
    days,
  };
}

export default function TrialCountdownBanner({
  trialEndsAt,
  billingStatus,
  plan,
  isComped = false,
  compedUntil = null,
}: {
  trialEndsAt: string;
  billingStatus: "PENDING_SETUP" | "TRIAL" | "ACTIVE" | "OFFLINE";
  plan: ContentWorkspacePlan;
  isComped?: boolean;
  compedUntil?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("MONTHLY");

  const pricing = PLAN_PRICING[plan];

  const complimentaryAccess = isComped;
  const subscribed = billingStatus === "ACTIVE";

  // Keep the countdown fresh without requiring a page refresh.
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      60_000
    );

    return () => window.clearInterval(timer);
  }, []);

  const expirationDate = useMemo(() => {
    const value = complimentaryAccess ? compedUntil : trialEndsAt;

    return value ? new Date(value).getTime() : null;
  }, [complimentaryAccess, compedUntil, trialEndsAt]);

  const msLeft =
    expirationDate === null ? null : expirationDate - now;

  const offline = !complimentaryAccess && billingStatus === "OFFLINE";
  const expired = offline ||
    expirationDate !== null && msLeft !== null && msLeft <= 0;

  const daysLeft =
    msLeft === null
      ? 0
      : Math.max(0, Math.ceil(msLeft / 86400000));

  const hoursLeft =
    msLeft === null
      ? 0
      : Math.max(0, Math.ceil(msLeft / 3600000));

  const { months: monthsLeft, days: remainingDays } =
    getMonthsAndDaysRemaining(msLeft ?? 0);

  const planName = pricing.name;

  const annualSavings = pricing.monthly * 12 - pricing.annual;
  const annualMonthlyEquivalent = pricing.annual / 12;
  const annualSavingsPercent = Math.round(
    (annualSavings / (pricing.monthly * 12)) * 100
  );

  const selectedPrice =
    billingCycle === "ANNUAL"
      ? pricing.annual
      : pricing.monthly;

  const selectedPriceLabel =
    billingCycle === "ANNUAL"
      ? "/ year"
      : "/ month";

  const endDate = useMemo(() => {
    const value = complimentaryAccess ? compedUntil : trialEndsAt;

    if (!value) return null;

    return new Date(value).toLocaleDateString(
      "en-NG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }, [complimentaryAccess, compedUntil, trialEndsAt]);

  const complimentaryDurationLabel = useMemo(() => {
    if (!complimentaryAccess) return null;

    if (compedUntil === null) {
      return "No expiration";
    }

    if (expired) {
      return "Complimentary access has ended";
    }

    if (monthsLeft >= 1) {
      if (remainingDays === 0) {
        return `${monthsLeft} month${monthsLeft === 1 ? "" : "s"} remaining`;
      }

      return `${monthsLeft} month${monthsLeft === 1 ? "" : "s"} ${remainingDays} day${
        remainingDays === 1 ? "" : "s"
      } remaining`;
    }

    return `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
  }, [
    complimentaryAccess,
    compedUntil,
    expired,
    monthsLeft,
    remainingDays,
    daysLeft,
  ]);


  const headline = offline ? "Restore workspace access" : complimentaryAccess
    ? expired
      ? "Your complimentary access has ended"
      : compedUntil === null
        ? "Complimentary access"
        : complimentaryDurationLabel
    : expired
      ? "Your trial has ended"
      : daysLeft === 0
        ? "Your trial ends today"
        : `${daysLeft} day${
            daysLeft === 1 ? "" : "s"
          } left`;

  const supportingText = complimentaryAccess
    ? expired
      ? "Subscribe to restore access to your marketing workspaces."
      : compedUntil === null
        ? `You have complimentary ${planName} access with no expiration date.`
        : `You have complimentary ${planName} access until ${endDate}.`
    : expired
      ? "Subscribe to restore access to your marketing workspaces."
      : "Your trial includes full Agency access. Your selected plan applies when the trial ends; all existing data is preserved.";

  // Payment is the primary status; remaining trial benefits are an extra.
  if (subscribed && !complimentaryAccess) {
    if (plan === "UNLIMITED" || !trialEndsAt || expired) return null;
    return (
      <section aria-label="Subscription status" className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <h2 className="font-semibold">{planName} subscription active</h2>
        <p className="mt-2 text-sm">You also keep full Agency access until {endDate}, when your original trial ends. Your paid {planName} plan continues afterward. AI automatic replies remain opt-in.</p>
      </section>
    );
  }

  return (
    <section
      aria-label={
        offline ? "Workspace access status" : complimentaryAccess
          ? "Complimentary access status"
          : "Trial status"
      }
      aria-live="polite"
      className="relative mb-8 overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#101318] shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#2478FF] opacity-20 blur-[90px]"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-white/[0.025] blur-[90px]"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      <div className="relative grid lg:grid-cols-[1fr_auto]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#2478FF]/20 bg-[#2478FF]/10 text-[#6EA8FF]"
              aria-hidden="true"
            >
              <SparkIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-[#2478FF]/20 bg-[#2478FF]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#78AEFF]">
                  {offline ? "Access paused" : complimentaryAccess
                    ? expired
                      ? "Complimentary ended"
                      : "Complimentary access"
                    : expired
                      ? "Trial ended"
                      : "Free trial"}
                </span>

                <span className="text-[10px] font-medium text-white/25">
                  {planName} ·{" "}
                  {formatNaira(pricing.monthly)}
                  /month
                </span>
              </div>

              <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">
                {headline}
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                {supportingText}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/35">
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="text-[#4ADE80]" />
                  Marketing workspaces stay yours
                </span>

                {complimentaryAccess ? (
                  compedUntil === null ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckIcon className="text-[#4ADE80]" />
                      No expiration date
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckIcon className="text-[#4ADE80]" />
                      Access ends {endDate}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckIcon className="text-[#4ADE80]" />
                    {offline ? "Manage your subscription in Billing" : <>Trial ends {endDate}</>}
                  </span>
                )}
              </div>


            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.07] bg-white/[0.018] p-5 sm:p-7 lg:w-[330px] lg:border-l lg:border-t-0 lg:p-8">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/25">
                {complimentaryAccess
                  ? "Continue after complimentary access"
                  : "Continue without interruption"}
              </p>

              {/* Billing cycle toggle */}
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-1">
                <div
                  className="grid grid-cols-2 gap-1"
                  role="group"
                  aria-label="Billing cycle"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle("MONTHLY");
                    }}
                    className={`rounded-lg px-3 py-2.5 text-[11px] font-semibold transition-all ${
                      billingCycle === "MONTHLY"
                        ? "bg-white/[0.10] text-white shadow-sm"
                        : "text-white/35 hover:bg-white/[0.04] hover:text-white/65"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Monthly
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle("ANNUAL");
                    }}
                    className={`relative rounded-lg px-3 py-2.5 text-[11px] font-semibold transition-all ${
                      billingCycle === "ANNUAL"
                        ? "bg-[#2478FF] text-white shadow-[0_6px_18px_rgba(36,120,255,0.22)]"
                        : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Annual
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                        billingCycle === "ANNUAL"
                          ? "bg-white/15 text-white"
                          : "bg-emerald-400/10 text-emerald-300"
                      }`}
                    >
                      Save {annualSavingsPercent}%
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-white">
                    {formatNaira(selectedPrice)}
                  </span>

                  <span className="text-[11px] text-white/30">
                    {selectedPriceLabel}
                  </span>
                </div>

                {billingCycle === "ANNUAL" ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-white/35">
                      Equivalent to{" "}
                      <span className="font-semibold text-white/55">
                        {formatNaira(
                          annualMonthlyEquivalent
                        )}
                        /month
                      </span>
                    </p>

                    <p className="text-[10px] font-semibold text-emerald-300">
                      You save {formatNaira(annualSavings)}{" "}
                      per year
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-white/25">
                    Switch to annual and save{" "}
                    {formatNaira(annualSavings)} a year.
                  </p>
                )}

                {!complimentaryAccess && !expired && (
                  <p className="mt-2 text-[10px] text-white/25">
                    {hoursLeft <= 24
                      ? "Less than a day remaining"
                      : `${daysLeft} days remaining on your trial`}
                  </p>
                )}

                {complimentaryAccess && !expired && (
                  <p className="mt-2 text-[10px] text-white/25">
                    {complimentaryDurationLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {subscribed ? <button disabled className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2478FF] px-4 py-3 text-xs font-semibold text-white opacity-60"><CheckIcon />Subscribed</button> :
                <SubscriptionCheckoutButton product="CONTENT_WORKSPACE" plan={plan} cycle={billingCycle}
                  label={expired ? "Subscribe & restore access" : "Subscribe now"}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2478FF] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#1768E8] disabled:opacity-60" />}

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
