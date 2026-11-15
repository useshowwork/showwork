import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { initializeOfferSubscription } from "@/lib/billingOffers";
import { calendarPaymentReturn } from "@/lib/calendarPaymentReturn";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import {
  getContentWorkspacePlanCode,
  CONTENT_WORKSPACE_PLANS,
  isHigherContentWorkspacePlan,
  type ContentWorkspacePlan,
  type ContentWorkspaceBillingCycle,
} from "@/lib/contentWorkspaceEntitlements";


function resolveBillingCycle(
  value: unknown,
  fallback: ContentWorkspaceBillingCycle | null
): ContentWorkspaceBillingCycle {
  if (value === "ANNUAL") {
    return "ANNUAL";
  }

  if (value === "MONTHLY") {
    return "MONTHLY";
  }

  return fallback === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

// POST — upgrades a Marketing Workspace account to Studio or Agency.
//
// If the account is still inside its valid 3-day trial, the switch can
// happen without immediate payment unless `payNow` is true.
//
// If the account is already paying, has an expired trial, is pending
// setup, or is offline, a new Studio subscription checkout is required.
export async function POST(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/upgrade-to-company/route.ts#POST@39")) { return await invokePublishingEntrypoint<never>("app/api/calendars/upgrade-to-company/route.ts#POST@39",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body?.plan !== undefined && !["CREATOR", "GROWTH", "STUDIO", "UNLIMITED"].includes(body.plan)) return NextResponse.json({ error: "Choose a Marketing Workspace plan." }, { status: 400 });
  const targetPlan: ContentWorkspacePlan = body?.plan ?? "STUDIO";

  const payNow =
    body?.payNow === true;

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

      contentWorkspacePaystackSubscriptionCode: true,
      contentWorkspacePaystackEmailToken: true,
    },
  });

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (creator.contentWorkspacePlan === targetPlan) {
    return NextResponse.json({
      ok: true,
      alreadyStudio: true,
    });
  }

  if (creator.contentWorkspacePlan && !isHigherContentWorkspacePlan(targetPlan, creator.contentWorkspacePlan)) {
    return NextResponse.json({ error: "Choose a higher plan to upgrade." }, { status: 400 });
  }

  /*
   * IMPORTANT:
   *
   * If the frontend explicitly sends a billing cycle,
   * that choice wins.
   *
   * Only fall back to the account's existing cycle when
   * no billing cycle was supplied.
   */
  const billingCycle =
    resolveBillingCycle(
      body?.billingCycle,
      creator.contentWorkspaceBillingCycle
    );

  const trialStillValid =
    creator.contentWorkspacePlan !== "ENGAGE" && creator.contentWorkspaceBillingStatus === "TRIAL" &&
    !!creator.contentWorkspaceTrialEndsAt &&
    creator.contentWorkspaceTrialEndsAt.getTime() >
      Date.now();

  /*
   * During an active trial, changing from Creator to Studio
   * does not require immediate payment unless the user
   * explicitly chooses `payNow`.
   */
  if (trialStillValid && !payNow) {
    await db.creator.update({ where: { id: creator.id }, data: {
      contentWorkspacePlan: targetPlan, contentWorkspaceBillingCycle: billingCycle,
    } });
    return NextResponse.json({
      ok: true,
      requiresPayment: false,
      stillInTrial: true,
      plan: targetPlan,
      billingCycle,
    });
  }

  /*
   * Resolve the Paystack plan using the EXACT billing cycle
   * selected by the customer.
   */
  let studioPlanCode: string;

  try {
    studioPlanCode = getContentWorkspacePlanCode(
      targetPlan,
      billingCycle
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_QUOTE_CHANGED") return NextResponse.json({ error: "Your offer changed. Refresh the price and confirm again." }, { status: 409 });
    console.error(
      "Marketing Workspace Studio Paystack plan code is not configured:",
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

  // The subscription webhook cancels the previous subscription after payment.

  const reference =
    `showwork_content_workspace_sub_${creator.id}_${randomUUID()}`;

  const amount =
    billingCycle === "ANNUAL"
      ? CONTENT_WORKSPACE_PLANS[targetPlan].priceNgnAnnual
      : CONTENT_WORKSPACE_PLANS[targetPlan].priceNgnMonthly;

  try {
    const result = await initializeOfferSubscription({
      expectedQuote: body.expectedQuote,
      email: creator.email,
      reference,

      callbackUrl:
        await calendarPaymentReturn(req, creator.id),

      planCode: studioPlanCode,

      // Paystack expects kobo.
      amount: amount * 100,

      metadata: {
        creatorId: creator.id,
        contentWorkspacePlan: targetPlan,
        billingCycle,
      },
    });

    await db.creator.update({
      where: {
        id: creator.id,
      },
      data: {
        contentWorkspacePendingSubscriptionRef: reference,
        contentWorkspaceBillingCycle: billingCycle,
      },
    });

    return NextResponse.json({
      authorizationUrl:
        result.data.authorization_url,
      requiresPayment: true,
      plan: targetPlan,
      billingCycle,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_QUOTE_CHANGED") return NextResponse.json({ error: "Your offer changed. Refresh the price and confirm again." }, { status: 409 });
    console.error(
      "Marketing Workspace Studio upgrade checkout initialize error:",
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