import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { extractPaystackPlanCode } from "@/lib/paystackPlan";
import { syncVerifiedPayment } from "@/lib/paymentSync";
import { resolveWorkspacePlan, recordOfferPayment, offerSubscriptionId } from "@/lib/billingOffers";
import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTransaction, fetchCustomerSubscriptions, cancelSubscription } from "@/lib/paystack";
import {
  getContentWorkspacePlanCode,
  type ContentWorkspacePlan,
  type ContentWorkspaceBillingCycle,
} from "@/lib/contentWorkspaceEntitlements";

// POST — called after Paystack redirects back from the Content
// Workspace subscription checkout.
//
// Marketing Workspace billing belongs to the creator account,
// not to an individual calendar.
//
// The webhook remains the primary source of subscription data.
// This direct verification is a fallback for the case where Paystack
// has confirmed payment but the webhook has not reached us yet.
export async function POST() {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/calendars/verify-subscription/route.ts#POST@23")) { return await invokePublishingEntrypoint<never>("app/api/calendars/verify-subscription/route.ts#POST@23",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const creator = await db.creator.findUnique({
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
    creator.contentWorkspaceBillingStatus === "ACTIVE" &&
    creator.contentWorkspacePaystackSubscriptionCode &&
    !creator.contentWorkspacePendingSubscriptionRef
  ) {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
    });
  }

  if (!creator.contentWorkspacePendingSubscriptionRef) {
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
    const verification = await verifyTransaction(
      pendingReference
    );

    const isActuallySuccessful =
      verification?.data?.status === "success" &&
      verification?.data?.reference === pendingReference;

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

    const metadata = verification?.data?.metadata;

    const metadataPlan =
      metadata?.contentWorkspacePlan === "CREATOR" ||
      metadata?.contentWorkspacePlan === "GROWTH" || metadata?.contentWorkspacePlan === "STUDIO" || metadata?.contentWorkspacePlan === "UNLIMITED"
        ? (metadata.contentWorkspacePlan as ContentWorkspacePlan)
        : null;

    const metadataCycle =
      metadata?.billingCycle === "MONTHLY" ||
      metadata?.billingCycle === "ANNUAL"
        ? (metadata.billingCycle as ContentWorkspaceBillingCycle)
        : null;

    const plan =
      planFromPaystack?.plan ??
      metadataPlan ??
      creator.contentWorkspacePlan;

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

    const customerCode = verification?.data?.customer?.customer_code;
    let matchedSubscription: any = null;
    if (customerCode) {
      try {
        const subscriptions = await fetchCustomerSubscriptions(customerCode);
        matchedSubscription = subscriptions.data?.find((sub: any) =>
          sub.status === "active" && sub.plan?.plan_code === (transactionPlanCode ?? getContentWorkspacePlanCode(plan, cycle)) &&
          sub.subscription_code !== creator.contentWorkspacePaystackSubscriptionCode
        ) ?? null;
      } catch (error) {
        console.error("Could not fetch verified workspace subscription", error);
      }
    }

    if (matchedSubscription && creator.contentWorkspacePaystackSubscriptionCode && creator.contentWorkspacePaystackEmailToken && matchedSubscription.subscription_code !== creator.contentWorkspacePaystackSubscriptionCode) {
      await cancelSubscription(creator.contentWorkspacePaystackSubscriptionCode, creator.contentWorkspacePaystackEmailToken);
    }

    /*
     * Activate the account-level Marketing Workspace subscription.
     */
    await db.creator.update({
      where: {
        id: creator.id,
      },
      data: {
        workspaceOfferSubscriptionId: transactionPlanCode ? await offerSubscriptionId(transactionPlanCode, creator.id) : null,
        contentWorkspacePlan: plan,
        contentWorkspaceBillingStatus: "ACTIVE",
        contentWorkspaceBillingCycle: cycle,
        contentWorkspacePaystackCustomerCode:
          verification?.data?.customer?.customer_code ?? null,
        ...(matchedSubscription ? {
          contentWorkspacePaystackSubscriptionCode: matchedSubscription.subscription_code,
          contentWorkspacePaystackEmailToken: matchedSubscription.email_token,
          contentWorkspaceSubscriptionRenewsAt: matchedSubscription.next_payment_date ? new Date(matchedSubscription.next_payment_date) : null,
        } : {}),
        contentWorkspaceWentOfflineAt: null,
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