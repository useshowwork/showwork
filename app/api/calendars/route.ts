import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { complimentaryAccessSelect, workspaceComplimentaryPlan } from "@/lib/complimentaryAccess";
import { initializeOfferSubscription } from "@/lib/billingOffers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentCreator, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

import { appUrl } from "@/lib/url";
import {
  CONTENT_WORKSPACE_PLANS,
  CONTENT_WORKSPACE_TRIAL_DAYS,
  getContentWorkspacePlanCode,
  type ContentWorkspaceBillingCycle,
  type ContentWorkspacePlan,
} from "@/lib/contentWorkspaceEntitlements";
import {
  canCreateContentWorkspace,
  canAccessContentWorkspace,
  getContentWorkspacePlan,
  isComplimentaryAccessActive,
  type ContentWorkspaceAccount,
} from "@/lib/contentWorkspaceUsage";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateAccessCode(): string {
  const chars =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

  let code = "";

  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

async function uniqueSlugFor(base: string): Promise<string> {
  let candidate = base || "calendar";
  let suffix = 2;

  while (
    await db.socialCalendar.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }

  return candidate;
}

function resolvePlanFromLegacyAccountType(
  accountType: unknown
): ContentWorkspacePlan | null {
  if (accountType === "INDIVIDUAL") return "CREATOR";
  if (accountType === "COMPANY") return "STUDIO";

  return null;
}

function resolveBillingCycle(
  value: unknown
): ContentWorkspaceBillingCycle {
  return value === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

// GET — every calendar this creator owns, most recent first.
export async function GET() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const calendars = await db.socialCalendar.findMany({
    where: {
      managerId: creator.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  return NextResponse.json({ calendars });
}

// POST — creates a new Marketing Workspace.
//
// Billing is account-level:
// - Creator: 1 active workspace
// - Studio: 10 active workspaces
//
// Every account gets one 7-day trial, ever.
// The trial is attached to the Marketing Workspace subscription,
// not to an individual calendar/workspace.
//
// `accountType` is accepted temporarily for backwards compatibility
// with the existing frontend:
// - INDIVIDUAL -> Creator
// - COMPANY -> Studio
//
// New frontend code should send `plan` instead.
export async function POST(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/route.ts#POST@122")) { return await invokePublishingEntrypoint<never>("app/api/calendars/route.ts#POST@122",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    clientName?: unknown;
    plan?: unknown;
    accountType?: unknown;
    billingCycle?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const clientName =
    typeof body.clientName === "string"
      ? body.clientName.trim()
      : "";

  if (!clientName) {
    return NextResponse.json(
      { error: "Client name is required" },
      { status: 400 }
    );
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
      contentWorkspaceTrialUsedAt: true,
      contentWorkspaceTrialEndsAt: true,
      contentWorkspacePendingSubscriptionRef: true,

      ...complimentaryAccessSelect, isComped: true,
      compedUntil: true,

      // Kept temporarily because older accounts may still have this
      // value from the previous Calendar billing system.
      calendarAccountType: true,
    },
  });

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  /*
   * Determine the Marketing Workspace plan.
   *
   * Existing accounts that previously selected:
   *   INDIVIDUAL -> CREATOR
   *   COMPANY    -> STUDIO
   *
   * New accounts should provide `plan`.
   *
   * Once a Marketing Workspace plan exists on the account, it is used
   * as the source of truth.
   */
  let plan: ContentWorkspacePlan | null =
    creator.contentWorkspacePlan ?? workspaceComplimentaryPlan(creator);

  if (!plan) {
    if (
      body.plan === "CREATOR" ||
      body.plan === "GROWTH" || body.plan === "STUDIO" || body.plan === "UNLIMITED"
    ) {
      plan = body.plan;
    } else {
      plan = resolvePlanFromLegacyAccountType(
        body.accountType
      );
    }

    if (!plan) {
      plan = resolvePlanFromLegacyAccountType(
        creator.calendarAccountType
      );
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
   * Build the account shape expected by the centralized
   * Marketing Workspace entitlement service.
   */
  const account: ContentWorkspaceAccount = {
  billingComplimentaryGrants: creator.billingComplimentaryGrants,
  workspaceCompedPlan: creator.workspaceCompedPlan,
  workspaceCompedUntil: creator.workspaceCompedUntil,
  id: creator.id,
  contentWorkspacePlan: plan,
  contentWorkspaceBillingStatus: creator.contentWorkspaceBillingStatus,
  contentWorkspaceBillingCycle: creator.contentWorkspaceBillingCycle,
  contentWorkspaceTrialUsedAt: creator.contentWorkspaceTrialUsedAt,
  contentWorkspaceTrialEndsAt: creator.contentWorkspaceTrialEndsAt,
  isComped: creator.isComped,
  compedUntil: creator.compedUntil,
};

  /*
   * IMPORTANT:
   * Check the workspace entitlement BEFORE creating the database row.
   *
   * This enforces:
   * Creator -> maximum 5 active workspace
   * Studio  -> maximum 15 active workspaces
   */
  const creationCheck = await canCreateContentWorkspace(account);

  if (!creationCheck.allowed) {
    return NextResponse.json(
      {
        error:
          creationCheck.reason ??
          "You cannot create another Marketing Workspace.",
        usage: creationCheck.usage,
      },
      { status: 403 }
    );
  }

  /*
   * Persist the selected Marketing Workspace plan if this is the
   * account's first Marketing Workspace setup.
   *
   * This does NOT touch the main Showwork subscription fields.
   */
  if (!creator.contentWorkspacePlan) {
    await db.creator.update({
      where: {
        id: creator.id,
      },
      data: {
        contentWorkspacePlan: plan,
      },
    });
  }

  /*
   * Generate the workspace credentials.
   */
  const slug = await uniqueSlugFor(slugify(clientName));
  const accessCode = generateAccessCode();
  const passwordHash = await hashPassword(accessCode);

  /*
   * Create the workspace.
   *
   * There are deliberately no billing fields on SocialCalendar.
   * Billing belongs to the creator's Marketing Workspace subscription.
   */
  const creation = await db.$transaction(async tx => {
    // Serialize account-level limits and the first trial start across requests.
    await tx.$queryRaw`SELECT "id" FROM "Creator" WHERE "id" = ${creator.id} FOR UPDATE`;
    const owner = await tx.creator.findUniqueOrThrow({ where: { id: creator.id } });
    const selectedPlan = owner.contentWorkspacePlan ?? plan!;
    const startsTrial = !owner.contentWorkspaceTrialUsedAt && !isComplimentaryAccessActive(owner);
    const effectivePlan = startsTrial ? "UNLIMITED" : getContentWorkspacePlan(owner);
    if ((!startsTrial && !canAccessContentWorkspace(owner)) || !effectivePlan) return null;
    const count = await tx.socialCalendar.count({ where: { managerId: creator.id } });
    if (count >= CONTENT_WORKSPACE_PLANS[effectivePlan].activeWorkspaces) return null;
    const trialEndsAt = startsTrial ? new Date(Date.now() + CONTENT_WORKSPACE_TRIAL_DAYS * 86400000) : owner.contentWorkspaceTrialEndsAt;
    if (startsTrial) {
      await tx.creator.update({ where: { id: creator.id }, data: {
        contentWorkspaceTrialUsedAt: new Date(), contentWorkspaceTrialEndsAt: trialEndsAt,
        ...(owner.contentWorkspaceBillingStatus === "ACTIVE" ? {} : {
          contentWorkspaceBillingStatus: "TRIAL", contentWorkspaceBillingCycle: null,
        }),
        contentWorkspaceWentOfflineAt: null,
      } });
    }
    const calendar = await tx.socialCalendar.create({ data: {
      slug, clientName, passwordHash, accessCode, managerId: creator.id,
      setupVersion: 1, autoPublishEnabled: false,
    } });
    return { calendar, startsTrial, trialEndsAt, owner, selectedPlan };
  });
  if (!creation) return NextResponse.json({ error: "Your workspace allowance is full or your subscription is inactive. Upgrade to add a workspace. Existing data is preserved." }, { status: 403 });
  const { calendar } = creation;
  Object.assign(creator, creation.owner);
  plan = creation.selectedPlan;

  /*
 * COMPLIMENTARY ACCESS:
 *
 * If the creator has active complimentary access, the new
 * Marketing Workspace is already covered.
 *
 * Do not start the trial.
 * Do not initialize Paystack.
 */
if (
  !!workspaceComplimentaryPlan(creator)
) {
  return NextResponse.json({
    calendarId: calendar.id,
    complimentary: true,
    plan,
  });
}

  /*
   * FIRST-EVER MARKETING WORKSPACE:
   *
   * Start the 7-day free trial.
   *
   * No payment is requested.
   * No Paystack subscription is created.
   */
  if (creation.startsTrial) {
    return NextResponse.json({ calendarId: calendar.id, trial: true, plan, trialEndsAt: creation.trialEndsAt });
  }

  /*
   * Existing active subscription:
   *
   * The new workspace is immediately covered by the same
   * Marketing Workspace subscription.
   */
  if (
    creator.contentWorkspaceBillingStatus === "ACTIVE"
  ) {
    return NextResponse.json({
      calendarId: calendar.id,
      alreadyActive: true,
      plan,
    });
  }

  /*
   * Existing trial is still active:
   *
   * The new workspace is covered by the current trial.
   */
  if (
    creator.contentWorkspaceBillingStatus === "TRIAL" &&
    creator.contentWorkspaceTrialEndsAt &&
    creator.contentWorkspaceTrialEndsAt.getTime() > Date.now()
  ) {
    return NextResponse.json({
      calendarId: calendar.id,
      trial: true,
      plan,
      trialEndsAt: creator.contentWorkspaceTrialEndsAt,
    });
  }

  /*
   * Trial has ended or the subscription is offline/pending.
   *
   * Start the Marketing Workspace subscription checkout.
   */
  const billingCycle = resolveBillingCycle(
    body.billingCycle ??
      creator.contentWorkspaceBillingCycle
  );

  const planConfig = CONTENT_WORKSPACE_PLANS[plan];

  let planCode: string;

  try {
    planCode = getContentWorkspacePlanCode(
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
    const result = await initializeOfferSubscription({
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
        contentWorkspaceBillingCycle: billingCycle,
        contentWorkspacePendingSubscriptionRef: reference,
      },
    });

    return NextResponse.json({
      authorizationUrl:
        result.data.authorization_url,
      calendarId: calendar.id,
      plan,
      billingCycle,
    });
  } catch (error) {
    console.error(
      "Marketing Workspace subscription initialize error:",
      error
    );

    /*
     * Leave the workspace row in place.
     *
     * It remains inaccessible until the account has an active
     * Marketing Workspace subscription or valid trial.
     */
    return NextResponse.json(
      {
        error:
          "Failed to start payment — try again",
      },
      { status: 500 }
    );
  }
}
