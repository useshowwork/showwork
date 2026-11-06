import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { complimentaryAccessSelect, workspaceComplimentaryPlan } from "@/lib/complimentaryAccess";
import { initializeOfferSubscription } from "@/lib/billingOffers";
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

// POST — restarts Marketing Workspace checkout for an account whose
// subscription isn't currently active.
//
// Billing is account-level, so payment activates the entire Content
// Workspace subscription and therefore all workspaces owned by the
// creator that fall within the plan's workspace limit.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/[id]/retry-payment/route.ts#POST@38")) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/retry-payment/route.ts#POST@38",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const calendar =
    await db.socialCalendar.findUnique({
      where: {
        id,
      },
    });

  if (!calendar) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 }
    );
  }

  if (calendar.managerId !== session.id) {
    return NextResponse.json(
      {
        error:
          "Only the calendar's manager can complete payment",
      },
      { status: 403 }
    );
  }

  let body: {
    plan?: unknown;
    billingCycle?: unknown;
  } = {};

  try {
    body = await req.json();
  } catch {
    // Existing callers may send no body. In that case we use the
    // plan and billing cycle already saved on the account.
  }

  const creator =
    await db.creator.findUnique({
      where: {
        id: session.id,
      },
      select: {
        id: true,
        email: true,

        contentWorkspacePlan: true,
        contentWorkspaceBillingStatus: true,
        contentWorkspaceBillingCycle: true,
        contentWorkspacePendingSubscriptionRef: true,

        ...complimentaryAccessSelect, isComped: true, compedUntil: true,

        // Temporary migration fallback for legacy accounts.
        calendarAccountType: true,
      },
    });

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (workspaceComplimentaryPlan(creator)) {
    return NextResponse.json(
      {
        error:
          "Your Marketing Workspace access is already provided by your account.",
      },
      { status: 400 }
    );
  }

  if (
    creator.contentWorkspaceBillingStatus ===
    "ACTIVE"
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
   * Resolve plan from:
   * 1. Request body
   * 2. Existing Marketing Workspace plan
   * 3. Legacy Calendar account type
   *
   * Legacy mapping:
   * INDIVIDUAL -> CREATOR
   * COMPANY    -> STUDIO
   */
  let plan =
    resolvePlan(body.plan) ??
    creator.contentWorkspacePlan;

  if (!plan) {
    if (
      creator.calendarAccountType ===
      "INDIVIDUAL"
    ) {
      plan = "CREATOR";
    } else if (
      creator.calendarAccountType ===
      "COMPANY"
    ) {
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

  const billingCycle =
    resolveBillingCycle(
      body.billingCycle ??
        creator.contentWorkspaceBillingCycle
    );

  const planConfig =
    CONTENT_WORKSPACE_PLANS[plan];

  let planCode: string;

  try {
    planCode =
      getContentWorkspacePlanCode(
        plan,
        billingCycle
      );
  } catch (error) {
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
    const result =
      await initializeOfferSubscription({
        email: creator.email,
        reference,

        callbackUrl:
          `${appUrl()}/dashboard/calendars` +
          `?subscriptionPayment=callback` +
          `&calendarId=${calendar.id}`,

        planCode,

        // Paystack expects kobo.
        amount: amountNgn * 100,

        metadata: {
          creatorId: creator.id,
          calendarId: calendar.id,
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
        contentWorkspaceBillingCycle:
          billingCycle,
        contentWorkspacePendingSubscriptionRef:
          reference,
      },
    });

    return NextResponse.json({
      authorizationUrl:
        result.data.authorization_url,
      plan,
      billingCycle,
    });
  } catch (error) {
    console.error(
      "Marketing Workspace retry-payment initialize error:",
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
