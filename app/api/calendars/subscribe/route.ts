import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { complimentaryAccessSelect, workspaceComplimentaryPlan } from "@/lib/complimentaryAccess";
import { initializeOfferSubscription, offerQuote } from "@/lib/billingOffers";
import { calendarPaymentReturn } from "@/lib/calendarPaymentReturn";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

import { appUrl } from "@/lib/url";
import {
  CONTENT_WORKSPACE_PLANS,
  getContentWorkspacePlanCode,
  type ContentWorkspaceBillingCycle,
  type ContentWorkspacePlan,
} from "@/lib/contentWorkspaceEntitlements";

function resolvePlan(
  value: unknown
): ContentWorkspacePlan | null {
  if (value === "CREATOR" || value === "GROWTH" || value === "STUDIO" || value === "UNLIMITED") {
    return value;
  }

  return null;
}

function resolveBillingCycle(
  value: unknown
): ContentWorkspaceBillingCycle {
  return value === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

// POST — starts or restarts the account-level Marketing Workspace
// subscription.
//
// Billing belongs to the Marketing Workspace product as a whole,
// not to an individual calendar/workspace.
//
// Creator:
//   ₦4,900/month
//
// Studio:
//   ₦29,900/month
//
// AI is included in all plans.
export async function POST(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/subscribe/route.ts#POST@46")) { return await invokePublishingEntrypoint<never>("app/api/calendars/subscribe/route.ts#POST@46",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    plan?: unknown;
    activateOffer?: boolean;
    expectedQuote?: { amountNgn: number; offerId: string | null };
    billingCycle?: unknown;
  } = {};

  try {
    body = await req.json();
  } catch {
    // An empty body is allowed because the account may already
    // have a Marketing Workspace plan saved.
  }

  const creator = await db.creator.findUnique({
    where: {
      id: session.id,
    },
    select: {
      id: true,
      email: true,

      contentWorkspacePlan: true,
      contentWorkspaceBillingStatus: true,
      contentWorkspaceBillingCycle: true,
      contentWorkspaceTrialEndsAt: true,
      contentWorkspacePendingSubscriptionRef: true,

      ...complimentaryAccessSelect, isComped: true, compedUntil: true,

      // Temporary backwards compatibility for accounts created
      // under the previous Individual/Company Calendar billing.
      calendarAccountType: true,
    },
  });

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (workspaceComplimentaryPlan(creator) && body.activateOffer !== true) {
    return NextResponse.json(
      {
        error:
          "Your Marketing Workspace access is already provided by your account.",
      },
      { status: 400 }
    );
  }

  if (
    creator.contentWorkspaceBillingStatus === "ACTIVE" && body.activateOffer !== true
  ) {
    return NextResponse.json(
      {
        error:
          "Your Marketing Workspace subscription is already active",
      },
      { status: 400 }
    );
  }

  /*
   * Resolve the plan.
   *
   * New requests should send `plan`.
   * Existing accounts already have contentWorkspacePlan.
   *
   * As a temporary migration fallback:
   * INDIVIDUAL -> CREATOR
   * COMPANY    -> STUDIO
   */
  let plan =
    resolvePlan(body.plan) ??
    creator.contentWorkspacePlan;

  if (!plan) {
    if (creator.calendarAccountType === "INDIVIDUAL") {
      plan = "CREATOR";
    } else if (creator.calendarAccountType === "COMPANY") {
      plan = "STUDIO";
    }
  }

  if (!plan) {
    return NextResponse.json(
      {
        error:
          "Choose a Marketing Workspace plan first: Creator, Studio or Agency",
      },
      { status: 400 }
    );
  }

  /*
   * Resolve billing cycle.
   *
   * Monthly remains the default so existing callers that don't
   * provide a cycle continue to work.
   */
  const billingCycle = resolveBillingCycle(
    body.billingCycle ??
      creator.contentWorkspaceBillingCycle
  );

  if (body.activateOffer === true) {
    const quote = await offerQuote(creator.id, "CONTENT_WORKSPACE", plan, billingCycle);
    if (!quote.offer) return NextResponse.json({ error: "This offer is no longer available. Refresh billing to see your current options." }, { status: 409 });
    if (creator.contentWorkspaceBillingStatus === "ACTIVE" && creator.contentWorkspacePlan !== plan) return NextResponse.json({ error: "Switch to the selected plan from billing to activate this offer." }, { status: 409 });
  }

  const planConfig =
    CONTENT_WORKSPACE_PLANS[plan];

  let planCode: string;

  try {
    planCode = getContentWorkspacePlanCode(
      plan,
      billingCycle
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_QUOTE_CHANGED") return NextResponse.json({ error: "Your offer changed. Refresh the price and confirm again." }, { status: 409 });
    console.error(
      "Marketing Workspace Paystack plan configuration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Billing isn't configured yet — contact support",
      },
      { status: 500 }
    );
  }

  const amountNgn =
    billingCycle === "ANNUAL"
      ? planConfig.priceNgnAnnual
      : planConfig.priceNgnMonthly;

  const reference =
    `showwork_content_workspace_sub_${creator.id}_${randomUUID()}`;

  try {
    const result = await initializeOfferSubscription({
      expectedQuote: body.expectedQuote,
      email: creator.email,
      reference,

      callbackUrl:
        await calendarPaymentReturn(req, creator.id),

      planCode,

      // Paystack expects kobo.
      amount: amountNgn * 100,

      metadata: {
        creatorId: creator.id,
        contentWorkspacePlan: plan,
        billingCycle,
      },
    });

    await db.creator.update({
      where: {
        id: creator.id,
      },
      data: {
        contentWorkspacePlan: plan,
        contentWorkspaceBillingCycle: billingCycle,
        contentWorkspacePendingSubscriptionRef: reference,
      },
    });

    return NextResponse.json({
      authorizationUrl:
        result.data.authorization_url,
      plan,
      billingCycle,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_QUOTE_CHANGED") return NextResponse.json({ error: "Your offer changed. Refresh the price and confirm again." }, { status: 409 });
    console.error(
      "Marketing Workspace subscribe initialize error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to start payment — try again",
      },
      { status: 500 }
    );
  }
}
