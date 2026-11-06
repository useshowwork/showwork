"use client";

import { TIERS } from "@/lib/subscriptionTiers";
import { CONTENT_WORKSPACE_PLANS, CONTENT_WORKSPACE_PLAN_ORDER, formatWorkspaceLimit, getContentWorkspaceFeatureList } from "@/lib/contentWorkspaceEntitlements";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

type Product = "delivery" | "workspace";
type BillingCycle = "monthly" | "annual";

type PricingPlan = {
  name: string;
  monthly: number;
  annual: number;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
};

const DELIVERY_PLANS: PricingPlan[] = [
  {
    name: "Free",
    monthly: 0,
    annual: 0,
    description: "A simple way to start delivering your work.",
    features: [
      "1 project per 30 days",
      "Basic client delivery",
      "Secure project links",
    ],
    cta: "Start free",
    href: "/start",
  },
  {
    name: "Starter",
    monthly: TIERS.STARTER.priceNgnMonthly,
    annual: TIERS.STARTER.priceNgnAnnual,
    description: "For creators starting to manage more client work.",
    features: [
      "5 projects per billing cycle",
      "Client collaboration",
      "File delivery",
      "Project feedback",
    ],
    cta: "Choose Starter",
    href: "/start?product=delivery&cycle=MONTHLY&tier=STARTER",
  },
  {
    name: "Growth",
    monthly: TIERS.GROWTH.priceNgnMonthly,
    annual: TIERS.GROWTH.priceNgnAnnual,
    description: "For busy creatives handling work at scale.",
    features: [
      "15 projects per billing cycle",
      "Advanced client delivery",
      "Client feedback & approvals",
      "Project collaboration",
    ],
    cta: "Choose Growth",
    href: "/start?product=delivery&cycle=MONTHLY&tier=GROWTH",
    popular: true,
  },
  {
    name: "Unlimited",
    monthly: TIERS.UNLIMITED.priceNgnMonthly,
    annual: TIERS.UNLIMITED.priceNgnAnnual,
    description: "For established creative businesses.",
    features: [
      "Unlimited projects",
      "Full client delivery",
      "Advanced collaboration",
      "Built for growing teams",
    ],
    cta: "Choose Unlimited",
    href: "/start?product=delivery&cycle=MONTHLY&tier=UNLIMITED",
  },
];

const WORKSPACE_PLANS: PricingPlan[] = CONTENT_WORKSPACE_PLAN_ORDER.map((key) => {
  const plan = CONTENT_WORKSPACE_PLANS[key];
  return {
    name: plan.name,
    monthly: plan.priceNgnMonthly,
    annual: plan.priceNgnAnnual,
    description: key === "CREATOR" ? "For independent social media managers." : key === "GROWTH" ? "For social media managers growing their client base." : key === "STUDIO" ? "For small marketing teams and agencies." : "For businesses and agencies coordinating larger teams.",
    features: [
      key === "UNLIMITED" ? "Unlimited active marketing workspaces" : `${formatWorkspaceLimit(plan.activeWorkspaces)} active marketing workspace${plan.activeWorkspaces === 1 ? "" : "s"}`,
      key === "UNLIMITED" ? "Unlimited collaborators" : `Up to ${plan.collaborators} collaborators`,
      `${plan.storageBytes / 1_000_000_000} GB storage`,
      `${plan.aiGenerations.toLocaleString("en-NG")} AI generations / month`,
      ...(key !== "CREATOR" ? ["Randy in AI Studio"] : []),
      ...getContentWorkspaceFeatureList(key).filter(feature => feature !== "Randy in AI Studio"),
    ],
    cta: "Start 7-day trial",
    href: `/signup?next=/dashboard/calendars&plan=${key}&cycle=MONTHLY`,
    popular: key === "UNLIMITED",
  };
});

function formatNaira(amount: number) {
  if (amount === 0) {
    return "Free";
  }

  return `₦${amount.toLocaleString("en-NG")}`;
}

function buildHref(
  product: Product,
  cycle: BillingCycle,
  tier?: string,
  plan?: string
) {
  const params = new URLSearchParams();

  params.set("product", product);
  params.set(
    "cycle",
    cycle === "monthly" ? "MONTHLY" : "ANNUAL"
  );

  if (tier) {
    params.set("tier", tier);
  }

  if (plan) {
    params.set("plan", plan);
  }

  return `/start?${params.toString()}`;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M5 12h14M14 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductIcon({
  product,
}: {
  product: Product;
}) {
  if (product === "delivery") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        aria-hidden
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.35"
        />

        <path
          d="M8 9h8M8 13h5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />

        <path
          d="m15 16 2.5-2.5L20 16"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.35"
      />

      <path
        d="M3 9.5h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      <path
        d="M7 13h3M14 13h3M7 16.5h3M14 16.5h3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PricingSection({ compact = false }: { compact?: boolean }) {
  const [product, setProduct] =
    useState<Product>("workspace");

  const [cycle, setCycle] =
    useState<BillingCycle>("monthly");

  const plans =
    product === "delivery"
      ? DELIVERY_PLANS
      : WORKSPACE_PLANS;

  return (
    <section
      id="pricing"
      className={`relative overflow-hidden bg-white px-5 sm:px-8 lg:px-16 ${compact ? "py-16 sm:py-20" : "py-28 sm:py-36 lg:py-40"}`}
    >
      {/* Background atmosphere */}

      <div
        className="pointer-events-none absolute right-[-220px] top-[-220px] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(36,120,255,.08), transparent 68%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute bottom-[-280px] left-[-220px] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(108,92,255,.055), transparent 68%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1400px]">
        {/* Header */}

        <div className="mx-auto max-w-[760px] text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#155FC7]" />

            <span className="font-[var(--font-fraunces)] text-sm italic text-[#626974]">
              Simple, transparent pricing
            </span>

            <span className="h-px w-8 bg-[#155FC7]" />
          </div>

          <h2 className={compact ? "mt-5 text-[clamp(2rem,4vw,3.1rem)] font-semibold leading-[1.18] tracking-[-0.045em] text-[#294669]" : "mt-6 font-[var(--font-fraunces)] text-[clamp(3rem,6vw,6rem)] font-normal leading-[0.92] tracking-[-0.05em] text-[#101216]"}>
            {compact ? "A plan for every" : "One connected platform."}
            <br />
            <span className="text-[#155FC7]">
              {compact ? "stage of your work." : "Plans for different ways of working."}
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-[590px] text-sm leading-7 text-[#626974] sm:text-base">
            Choose the client capacity, AI allowance and tools that fit your team.
          </p>
        </div>

        {/* Product switcher */}

        <div className="mx-auto mt-12 flex w-fit max-w-full flex-wrap justify-center rounded-full border border-[#E1E4E9] bg-[#F7F8FA] p-1.5">
          <button
            type="button"
            onClick={() => setProduct("workspace")}
            className={`flex items-center gap-2 rounded-full px-3 py-3 text-[11px] font-semibold transition-all sm:px-5 sm:text-xs ${
              product === "workspace"
                ? "bg-[#111317] text-white shadow-sm"
                : "text-[#626974] hover:text-[#111317]"
            }`}
          >
            <ProductIcon product="workspace" />
            Marketing Workspace
          </button>

          <button
            type="button"
            onClick={() => setProduct("delivery")}
            className={`flex items-center gap-2 rounded-full px-3 py-3 text-[11px] font-semibold transition-all sm:px-5 sm:text-xs ${
              product === "delivery"
                ? "bg-[#111317] text-white shadow-sm"
                : "text-[#626974] hover:text-[#111317]"
            }`}
          >
            <ProductIcon product="delivery" />
            Project Delivery
          </button>
        </div>

        {/* Product description */}

        <motion.div
          key={product}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto mt-8 max-w-[700px] text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#155FC7]">
            {product === "delivery"
              ? "For delivering creative work"
              : "For planning work with clients"}
          </p>

          <p className="mt-2 text-sm text-[#626974]">
            {product === "delivery"
              ? "Present, collaborate, collect feedback and hand off projects beautifully."
              : "Manage client content, approvals, publishing, conversations, leads and analytics."}
          </p>
        </motion.div>

        {/* Billing toggle */}

        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="flex rounded-full border border-[#E1E4E9] bg-white p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold transition ${
                cycle === "monthly"
                  ? "bg-[#EEF4FF] text-[#155FC7]"
                  : "text-[#626974]"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold transition ${
                cycle === "annual"
                  ? "bg-[#EEF4FF] text-[#155FC7]"
                  : "text-[#626974]"
              }`}
            >
              Annual
            </button>
          </div>

          <span className="rounded-full bg-[#EAF7EF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1E6B3B]">
            Save 5%
          </span>
        </div>

        {/* Pricing cards */}

        <motion.div
          key={`${product}-${cycle}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`mt-12 grid gap-4 ${
            product === "delivery"
              ? "lg:grid-cols-4"
              : "mx-auto max-w-[1440px] md:grid-cols-2 xl:grid-cols-4"
          }`}
        >
          {plans.map((plan) => {
            const amount =
              cycle === "monthly"
                ? plan.monthly
                : plan.annual;

            let href = plan.href;

if (product === "delivery") {
  if (plan.name === "Free") {
    href = "/start";
  } else {
    const tierMap: Record<string, string> = {
      Starter: "STARTER",
      Growth: "GROWTH",
      Unlimited: "UNLIMITED",
    };

    href = buildHref(
      "delivery",
      cycle,
      tierMap[plan.name]
    );
  }
} else {
  const workspacePlanMap: Record<string, string> = {
    Creator: "CREATOR",
    Growth: "GROWTH",
    Studio: "STUDIO",
    Agency: "UNLIMITED",
  };

  const workspacePlan = workspacePlanMap[plan.name];

  href = `/signup?next=/dashboard/calendars&plan=${workspacePlan}&cycle=${
    cycle === "monthly" ? "MONTHLY" : "ANNUAL"
  }`;
}
            return (
              <motion.div
                key={plan.name}
                whileHover={{ y: -4 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                className={`relative flex min-h-[500px] flex-col rounded-[26px] border p-7 transition-shadow sm:p-8 ${
                  plan.popular
                    ? "border-[#2478FF] bg-[#111317] text-white shadow-[0_25px_80px_rgba(36,120,255,.13)]"
                    : "border-[#E2E5E9] bg-[#FAFAFB] text-[#111317] hover:bg-white hover:shadow-[0_20px_60px_rgba(17,19,23,.06)]"
                }`}
              >
                {/* Popular badge */}

                <div className="mb-4 flex min-h-7 items-center">
                  {plan.popular && (
                    <span className="inline-flex max-w-full items-center rounded-full bg-[#155FC7] px-3 py-1.5 text-[9px] font-bold uppercase leading-4 tracking-[0.08em] text-white">
                      {product === "workspace" ? "Recommended for teams" : "Most popular"}
                    </span>
                  )}
                </div>

                {/* Plan heading */}

                <div>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                      plan.popular
                        ? "text-[#7EAAFF]"
                        : "text-[#155FC7]"
                    }`}
                  >
                    {product === "delivery"
                      ? "Project Delivery"
                      : "Marketing Workspace"}
                  </p>

                  <h3
                    className={`mt-4 text-2xl font-semibold tracking-[-0.035em] ${
                      plan.popular
                        ? "text-white"
                        : "text-[#101216]"
                    }`}
                  >
                    {plan.name}
                  </h3>

                  <p
                    className={`mt-3 min-h-[48px] text-sm leading-6 ${
                      plan.popular
                        ? "text-white/50"
                        : "text-[#626974]"
                    }`}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Price */}

                <div className="mt-8">
                  <div className="flex items-end gap-1">
                    <span
                      className={`font-[var(--font-fraunces)] text-[42px] leading-none tracking-[-0.05em] ${
                        plan.popular
                          ? "text-white"
                          : "text-[#101216]"
                      }`}
                    >
                      {formatNaira(amount)}
                    </span>

                    {amount > 0 && (
                      <span
                        className={`mb-1 text-[11px] ${
                          plan.popular
                            ? "text-white/70"
                            : "text-[#626974]"
                        }`}
                      >
                        /
                        {cycle === "monthly"
                          ? "month"
                          : "year"}
                      </span>
                    )}
                  </div>

                  {cycle === "annual" && amount > 0 && (
                    <p
                      className={`mt-2 text-[10px] ${
                        plan.popular
                          ? "text-white/70"
                          : "text-[#626974]"
                      }`}
                    >
                      Equivalent to ₦
                      {Math.round(
                        amount / 12
                      ).toLocaleString("en-NG")}
                      /month
                    </p>
                  )}
                </div>

                {/* Divider */}

                <div
                  className={`my-8 h-px ${
                    plan.popular
                      ? "bg-white/10"
                      : "bg-[#E4E6EA]"
                  }`}
                />

                {/* Features */}

                <div className="flex-1">
                  <p
                    className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
                      plan.popular
                        ? "text-white/70"
                        : "text-[#626974]"
                    }`}
                  >
                    Includes
                  </p>

                  <ul className="mt-5 space-y-4">
                    {(compact ? plan.features.slice(0, 5) : plan.features).map(
                      (feature) => (
                        <li
                          key={feature}
                          className={`flex items-start gap-3 text-xs leading-5 ${
                            plan.popular
                              ? "text-white/65"
                              : "text-[#555B65]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 ${
                              plan.popular
                                ? "text-[#7EAAFF]"
                                : "text-[#155FC7]"
                            }`}
                          >
                            <CheckIcon />
                          </span>

                          {feature}
                        </li>
                      )
                    )}
                  </ul>
                  {compact && plan.features.length > 5 && <details className="mt-5 text-xs leading-6"><summary className={`cursor-pointer rounded-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${plan.popular ? "text-blue-200" : "text-[#155FC7]"}`}>See all included features</summary><ul className="mt-3 space-y-2">{plan.features.slice(5).map(feature => <li key={feature} className={plan.popular ? "text-white/80" : "text-slate-600"}>{feature}</li>)}</ul></details>}
                </div>

                {/* CTA */}

                <Link
                  href={compact ? href.replace(/^\/start(?=\?|$)/, "/signup") : href}
                  className={`group mt-8 flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-xs font-semibold transition-all ${
                    plan.popular
                      ? "bg-[#155FC7] text-white hover:bg-[#3A88FF]"
                      : "border border-[#D9DDE3] bg-white text-[#111317] hover:border-[#2478FF] hover:text-[#155FC7]"
                  }`}
                >
                  {plan.cta}

                  <ArrowRightIcon />
                </Link>

                {/* Trial note */}

                {product === "workspace" && (
                  <p
                    className={`mt-3 text-center text-[9px] ${
                      plan.popular
                        ? "text-white/70"
                        : "text-[#626974]"
                    }`}
                  >
                    7-day Agency trial · no payment
                    required to start
                  </p>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Portfolio inclusion */}

        <div className="mx-auto mt-10 max-w-[1000px] rounded-[24px] border border-[#E3E6EA] bg-[#F7F8FA] p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#155FC7] shadow-sm ring-1 ring-[#E2E6EB]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.35"
                  />

                  <circle
                    cx="8.5"
                    cy="9"
                    r="1.4"
                    stroke="currentColor"
                    strokeWidth="1.35"
                  />

                  <path
                    d="m3 16 5-5 4 4 3-3 6 6"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#111317]">
                  Your portfolio is free.
                </p>

                <p className="mt-1 max-w-[650px] text-xs leading-5 text-[#626974]">
                  Build a professional home for your
                  work without paying for a subscription.
                  Your paid plans are for the tools that
                  power your workflow.
                </p>
              </div>
            </div>

            <Link
              href="/signup?next=/dashboard/portfolio"
              className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-[#155FC7]"
            >
              Create portfolio
              <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Reassurance */}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#626974]">
          <span>Secure Paystack payments</span>

          <span className="h-1 w-1 rounded-full bg-[#155FC7]/40" />

          <span>Cancel anytime</span>

          <span className="h-1 w-1 rounded-full bg-[#155FC7]/40" />

          <span>Upgrade when you need</span>
        </div>
      </div>
    </section>
  );
}