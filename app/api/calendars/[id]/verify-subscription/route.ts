import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { extractPaystackPlanCode } from "@/lib/paystackPlan";
import { syncVerifiedPayment } from "@/lib/paymentSync";
import { resolveWorkspacePlan, recordOfferPayment, offerSubscriptionId } from "@/lib/billingOffers";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import {
  type ContentWorkspacePlan,
  type ContentWorkspaceBillingCycle,
} from "@/lib/contentWorkspaceEntitlements";

// POST — called after Paystack redirects back from the Content
// Workspace subscription checkout.
//
// Billing belongs to the creator's Marketing Workspace subscription,
// not to an individual calendar. This route therefore activates the
// account-level subscription so every workspace owned by the creator
// becomes usable.
//
// The webhook remains the primary source of subscription data.
// This direct verification is a fallback for the case where Paystack
// has confirmed payment but the webhook has not reached us yet.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/[id]/verify-subscription/route.ts#POST@24")) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/verify-subscription/route.ts#POST@24",Array.from(arguments)); } } /* end-canonical-integration-boundary */

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

  if (
    !calendar ||
    calendar.managerId !== session.id
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const creator =
    await db.creator.findUnique({
      where: {
        id: session.id,
      },
      select: {
        id: true,

        contentWorkspacePlan: true,
        contentWorkspaceBillingStatus: true,
        contentWorkspaceBillingCycle: true,
        contentWorkspacePaystackCustomerCode: true,
        contentWorkspacePaystackSubscriptionCode: true,
        contentWorkspacePaystackEmailToken: true,
        contentWorkspacePendingSubscriptionRef: true,
      },
    });

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  /*
   * If the webhook already activated the subscription,
   * there is nothing else to do.
   */
  if (
    creator.contentWorkspaceBillingStatus ===
      "ACTIVE" &&
    creator.contentWorkspacePaystackSubscriptionCode
  ) {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
    });
  }

  if (
    !creator.contentWorkspacePendingSubscriptionRef
  ) {
    return NextResponse.json(
      {
        error:
          "No payment has been started for this account yet",
      },
      { status: 400 }
    );
  }

  const pendingReference =
    creator.contentWorkspacePendingSubscriptionRef;

  try {
    const verification =
      await verifyTransaction(
        pendingReference
      );

    const isActuallySuccessful =
      verification?.data?.status === "success" &&
      verification?.data?.reference ===
        pendingReference;

    if (!isActuallySuccessful) {
      return NextResponse.json(
        {
          error:
            "Payment not yet confirmed by Paystack",
          verifiedStatus:
            verification?.data?.status ?? null,
        },
        { status: 402 }
      );
    }

    /*
     * Determine the plan from the Paystack transaction.
     *
     * The transaction's plan code is the authoritative billing
     * identifier. Metadata is used as a fallback because the
     * checkout route also sends the Marketing Workspace plan.
     */
    await syncVerifiedPayment(pendingReference, verification, { expectedCreatorId: creator.id });

    const transactionPlanCode = extractPaystackPlanCode(verification?.data);

    await recordOfferPayment(pendingReference, verification);

    const planFromPaystack =
      transactionPlanCode
        ? await resolveWorkspacePlan(
            transactionPlanCode, creator.id
          )
        : null;

    const metadata =
      verification?.data?.metadata;

    const metadataPlan =
      metadata?.contentWorkspacePlan ===
        "CREATOR" ||
      metadata?.contentWorkspacePlan ===
        "STUDIO" || metadata?.contentWorkspacePlan === "GROWTH" || metadata?.contentWorkspacePlan === "ENGAGE" || metadata?.contentWorkspacePlan ===
        "UNLIMITED"
        ? (metadata.contentWorkspacePlan as ContentWorkspacePlan)
        : null;

    const metadataCycle =
      metadata?.billingCycle === "MONTHLY" ||
      metadata?.billingCycle === "ANNUAL"
        ? (metadata.billingCycle as ContentWorkspaceBillingCycle)
        : null;

    const plan =
      planFromPaystack?.plan ?? metadataPlan;

    const cycle =
      planFromPaystack?.cycle ??
      metadataCycle ??
      creator.contentWorkspaceBillingCycle ??
      "MONTHLY";

    /*
     * We should never activate a Marketing Workspace subscription
     * without being able to identify its plan.
     */
    if (!plan) {
      console.error(
        "Marketing Workspace payment verified but plan could not be determined",
        {
          creatorId: creator.id,
          reference: pendingReference,
          transactionPlanCode,
          metadataPlan,
        }
      );

      return NextResponse.json(
        {
          error:
            "Payment was received, but the Marketing Workspace plan could not be identified. Contact support.",
        },
        { status: 500 }
      );
    }

    /*
     * Activate the account-level Marketing Workspace subscription.
     *
     * The webhook will subsequently populate the subscription code
     * and email token when subscription.create arrives.
     */
    await db.creator.update({
      where: {
        id: creator.id,
      },
      data: {
        workspaceOfferSubscriptionId: transactionPlanCode ? await offerSubscriptionId(transactionPlanCode, creator.id) : null,
        contentWorkspacePlan: plan,

        contentWorkspaceBillingStatus:
          "ACTIVE",

        contentWorkspaceBillingCycle:
          cycle,

        contentWorkspacePaystackCustomerCode:
          verification?.data?.customer
            ?.customer_code ?? null,

        contentWorkspaceWentOfflineAt:
          null,
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyActive: false,
      plan,
      billingCycle: cycle,
    });
  } catch (err) {
    console.error(
      "Direct Marketing Workspace subscription verification failed:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Couldn't verify payment — try again",
      },
      { status: 500 }
    );
  }
}