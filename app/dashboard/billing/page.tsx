import BillingBenefits from "@/components/billing/BillingBenefits";
import { billingPriceQuotes } from "@/lib/billingOffers";
import { workspaceComplimentaryPlan, workspaceComplimentaryEndsAt, complimentaryAccessSelect } from "@/lib/complimentaryAccess";
import { resolveDeliveryPlan, recordOfferPayment, offerSubscriptionId } from "@/lib/billingOffers";
import { syncContentWorkspaceRenewal } from "@/lib/syncContentWorkspaceRenewal";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCreatorUsage } from "@/lib/subscriptionUsage";
import {
  type BillingCycle,
} from "@/lib/subscriptionTiers";
import {
  verifyTransaction,
  fetchCustomerSubscriptions,
  cancelSubscription,
} from "@/lib/paystack";
import BillingSubscriptions from "./BillingSubscriptions";
import BillingHistory from "./BillingHistory";
import { Suspense } from "react";
import { syncVerifiedPayment } from "@/lib/paymentSync";
import { extractPaystackPlanCode } from "@/lib/paystackPlan";
import { processReferralCommission } from "@/lib/partnerCommissions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment?: string;
    reference?: string;
    trxref?: string;

    product?: string;

    tier?: string;
    cycle?: string;
    historyPage?: string;
  }>;
}) {
  const {
    payment,
    reference,
    trxref,
    product: productParam,
    tier: selectedTierParam,
    cycle: cycleParam,
    historyPage,
  } = await searchParams;

  /*
   * ------------------------------------------------------------
   * PRODUCT CONTEXT
   * ------------------------------------------------------------
   *
   * delivery
   * content-workspace
   *
   * The product query parameter lets every CTA return the user
   * to the exact subscription they were trying to purchase.
   */
  /*
   * ------------------------------------------------------------
   * BILLING CYCLE
   * ------------------------------------------------------------
   *
   * Monthly is the default; explicit annual links keep their selection.
   */
  const selectedCycle: BillingCycle =
    cycleParam === "ANNUAL" ? "ANNUAL" : "MONTHLY";

  /*
   * ------------------------------------------------------------
   * AUTH
   * ------------------------------------------------------------
   *
   * If someone arrives at Billing while logged out, preserve:
   *
   * - product
   * - tier
   * - billing cycle
   *
   * through login.
   *
   * This is what makes:
   *
   * Subscribe
   * → Login
   * → return to exact subscription
   *
   * work correctly.
   */
  let creator = await getCurrentCreator();
  const selectedProduct =
    productParam === "delivery" || productParam === "content-workspace" ||
    productParam === "engage" || productParam === "portfolio"
      ? productParam
      : selectedTierParam === "ENGAGE" || creator?.contentWorkspacePlan === "ENGAGE"
        ? "engage"
        : "delivery";

  if (!creator) {
    const params = new URLSearchParams();

    params.set("product", selectedProduct);

    if (selectedTierParam) {
      params.set("tier", selectedTierParam);
    }

    params.set("cycle", selectedCycle);

    const nextUrl = `/dashboard/billing?${params.toString()}`;

    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  /*
   * ------------------------------------------------------------
   * PROJECT DELIVERY PAYMENT CALLBACK
   * ------------------------------------------------------------
   *
   * Paystack returns here after checkout.
   *
   * The webhook remains the normal source of truth, but this
   * callback gives us a fallback confirmation path, especially
   * useful during local development.
   */
  const ref = reference ?? trxref;

  let paymentVerified = false;
  if (selectedProduct === "delivery" && payment === "callback" && ref &&
      ref.startsWith(`showwork_sub_${creator.id}_`)) {
    try {
      const verification = await verifyTransaction(ref);

      const isSuccessful =
        verification?.data?.status === "success";

      const planCode = extractPaystackPlanCode(verification?.data);

      const match = planCode
        ? await resolveDeliveryPlan(planCode, creator.id)
        : null;
        console.log("Showwork subscription callback verification:", {
  reference: ref,
  verificationStatus: verification?.data?.status ?? null,
  planCode,
  match,
  customerCode: verification?.data?.customer?.customer_code ?? null,
});

      const customerCode =
        verification?.data?.customer?.customer_code;

      const paidAt = verification?.data?.paid_at;
      const alreadyProcessed = paidAt && creator.currentCycleStart &&
        new Date(paidAt).getTime() < creator.currentCycleStart.getTime();

      if (isSuccessful && match && customerCode) {
        const { payment: paymentRecord } = await syncVerifiedPayment(ref, verification, { expectedCreatorId: creator.id });
        await recordOfferPayment(ref, verification);
        await processReferralCommission(paymentRecord);
      }

      if (isSuccessful && match && customerCode && alreadyProcessed) {
        paymentVerified = true;
      }

      if (isSuccessful && match && customerCode && !alreadyProcessed) {
        const { tier, cycle } = match;

        const subs =
          await fetchCustomerSubscriptions(customerCode);

        const matchingSub = subs?.data?.find(
          (subscription: any) =>
            (typeof subscription.plan === "string"
              ? subscription.plan
              : subscription.plan?.plan_code) === planCode
        );

        /*
         * If the user switched Project Delivery plans,
         * cancel the previous Paystack subscription so they
         * don't get charged twice.
         */
        if (
          creator.paystackSubscriptionCode &&
          creator.paystackEmailToken &&
          matchingSub?.subscription_code &&
          creator.paystackSubscriptionCode !==
            matchingSub.subscription_code
        ) {
          try {
            await cancelSubscription(
              creator.paystackSubscriptionCode,
              creator.paystackEmailToken
            );
          } catch (error) {
            console.error(
              "Failed to cancel previous subscription during switch:",
              error
            );
          }
        }

        creator = await db.creator.update({
          where: {
            id: creator.id,
          },

          data: {
            deliveryOfferSubscriptionId: planCode ? await offerSubscriptionId(planCode, creator.id) : null,
            subscriptionActive: true,
            subscriptionTier: tier,
            subscriptionCycle: cycle,

            paystackCustomerCode: customerCode,

            paystackSubscriptionCode:
              matchingSub?.subscription_code ?? null,

            paystackEmailToken:
              matchingSub?.email_token ?? null,

            subscriptionRenewsAt:
              matchingSub?.next_payment_date
                ? new Date(
                    matchingSub.next_payment_date
                  )
                : null,

            currentCycleStart: new Date(),
          },
        });
        paymentVerified = true;
      }
    } catch (error) {
      console.error(
        "Subscription callback verification error:",
        error
      );
    }
  }

  // Remove the transaction from the URL so refreshes and cancellation cannot
  // replay an old checkout and restore the previous plan.
  if (paymentVerified) {
    redirect(`/dashboard/billing?product=delivery&cycle=${creator.subscriptionCycle ?? selectedCycle}`);
  }

  /*
   * ------------------------------------------------------------
   * FETCH CURRENT BILLING STATE
   * ------------------------------------------------------------
   */

  const [
    usage,
    workspaceBilling,
    offerPrices,
  ] = await Promise.all([
    getCreatorUsage(creator),

    db.creator.findUnique({
      where: {
        id: creator.id,
      },

      select: {
  contentWorkspacePlan: true,
  contentWorkspaceBillingStatus: true,
  contentWorkspaceBillingCycle: true,
  contentWorkspaceTrialUsedAt: true,
  contentWorkspaceTrialEndsAt: true,
  contentWorkspaceSubscriptionRenewsAt: true,
  ...complimentaryAccessSelect, isComped: true,
  compedUntil: true,
},
    }),

    billingPriceQuotes(creator.id),
  ]);

  if (workspaceBilling?.contentWorkspaceBillingStatus === "ACTIVE") {
    workspaceBilling.contentWorkspaceSubscriptionRenewsAt = await syncContentWorkspaceRenewal(creator.id);
  }

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  const [currentWorkspaceOffer, deliveryOffer, details, workspaceSeatsUsed] = await Promise.all([
    creator.workspaceOfferSubscriptionId
      ? db.billingOfferSubscription.findUnique({ where: { id: creator.workspaceOfferSubscriptionId } })
      : null,
    creator.deliveryOfferSubscriptionId
      ? db.billingOfferSubscription.findUnique({ where: { id: creator.deliveryOfferSubscriptionId } })
      : null,
    db.accountBillingDetails?.findUnique({ where: { creatorId: creator.id } }).catch(() => undefined),
    (selectedProduct === "content-workspace" || selectedProduct === "engage") && creator.contentWorkspacePlan
      ? db.calendarCollaborator.count({ where: { calendar: { managerId: creator.id } } }).then(count => count + 1).catch(() => null)
      : null,
  ]);
  const requestedPage = Number(historyPage);
  const paymentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return (
    <BillingSubscriptions
      creator={{
        name: creator.name,
        email: creator.email,
        avatarUrl: creator.avatarUrl,
      }}
      benefits={<BillingBenefits creator={creator} showManageLink={false} />}
      account={{
        deliveryActive: creator.subscriptionActive,
        deliveryTier: creator.subscriptionTier,
        deliveryCycle: creator.subscriptionCycle,
        deliveryRenewsAt: creator.subscriptionRenewsAt,
        deliveryAmount: deliveryOffer ? (deliveryOffer.restoredAt ? deliveryOffer.standardPriceNgn : deliveryOffer.discountedPriceNgn) : null,
        deliveryCard: !!creator.paystackSubscriptionCode && (creator.subscriptionActive || creator.subscriptionTier !== "FREE"),
        workspacePlan: creator.contentWorkspacePlan,
        workspaceCard: !!creator.contentWorkspacePaystackSubscriptionCode,
        seatsUsed: workspaceSeatsUsed,
        detailsAvailable: details !== undefined,
        details: {
          name: details ? details.name ?? "" : creator.companyName ?? creator.name ?? "",
          email: details ? details.email ?? "" : creator.email,
          address: details?.address ?? "",
          taxId: details?.taxId ?? "",
        },
      }}
      history={<Suspense fallback={<p role="status" className="p-5 text-sm text-slate-600">Loading billing history…</p>}><BillingHistory creatorId={creator.id} page={paymentPage} href={`/dashboard/billing?product=${selectedProduct}&cycle=${selectedCycle}`} /></Suspense>}
      offerPrices={offerPrices}
      usage={usage}
      workspaceBilling={workspaceBilling ? {
        ...workspaceBilling,
        recurringPriceNgn: currentWorkspaceOffer && workspaceBilling.contentWorkspaceBillingStatus === "ACTIVE" ? (currentWorkspaceOffer.restoredAt ? currentWorkspaceOffer.standardPriceNgn : currentWorkspaceOffer.discountedPriceNgn) : undefined,
        isComped: !!workspaceComplimentaryPlan(workspaceBilling),
        compedUntil: workspaceComplimentaryEndsAt(workspaceBilling),
        contentWorkspacePlan: workspaceComplimentaryPlan(workspaceBilling) &&
          (workspaceBilling.contentWorkspaceBillingStatus !== "ACTIVE" || !workspaceBilling.contentWorkspacePlan ||
           ["CREATOR", "GROWTH", "STUDIO", "UNLIMITED"].indexOf(workspaceComplimentaryPlan(workspaceBilling)!) > ["CREATOR", "GROWTH", "STUDIO", "UNLIMITED"].indexOf(workspaceBilling.contentWorkspacePlan))
          ? workspaceComplimentaryPlan(workspaceBilling) : workspaceBilling.contentWorkspacePlan,
      } : null}
      selectedProduct={selectedProduct}
      selectedTier={selectedTierParam ?? null}
      selectedCycle={selectedCycle}
    />
  );
}
