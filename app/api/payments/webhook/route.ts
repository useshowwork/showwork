import { syncPartnerPaymentIssue } from "@/lib/partnerPaymentIssues";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { syncVerifiedPayment } from "@/lib/paymentSync";
import { extractPaystackPlanCode } from "@/lib/paystackPlan";
import {
  resolveDeliveryPlan,
  resolveWorkspacePlan,
  recordOfferPayment,
  offerSubscriptionId,
} from "@/lib/billingOffers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyWebhookSignature,
  verifyTransaction,
  cancelSubscription,
} from "@/lib/paystack";
import {
  type ContentWorkspacePlan,
  type ContentWorkspaceBillingCycle,
} from "@/lib/contentWorkspaceEntitlements";
import { processReferralCommission } from "@/lib/partnerCommissions";
import {
  sendPortfolioPaymentFailedEmail,
  sendCalendarPaymentFailedEmail,
  sendPartnerCommissionEarnedEmail,
} from "@/lib/resend";

const PORTFOLIO_PLAN_CODE = process.env.PAYSTACK_PORTFOLIO_PLAN_CODE;

// -----------------------------------------------------------------------------
// LEGACY CALENDAR BILLING
// -----------------------------------------------------------------------------
// These are intentionally retained for existing legacy subscriptions.
// New Marketing Workspace subscriptions do NOT use these plan codes.
const CALENDAR_INDIVIDUAL_PLAN_CODE =
  process.env.PAYSTACK_CALENDAR_INDIVIDUAL_PLAN_CODE;

const CALENDAR_COMPANY_PLAN_CODE =
  process.env.PAYSTACK_CALENDAR_COMPANY_PLAN_CODE;

// -----------------------------------------------------------------------------
// LEGACY AI ASSISTANT BILLING
// -----------------------------------------------------------------------------
// Retained for existing legacy AI subscriptions.
const AI_ASSISTANT_PLAN_CODE = process.env.PAYSTACK_AI_ASSISTANT_PLAN_CODE;

function isCalendarPlanCode(planCode: string | null): boolean {
  return (
    !!planCode &&
    (planCode === CALENDAR_INDIVIDUAL_PLAN_CODE ||
      planCode === CALENDAR_COMPANY_PLAN_CODE)
  );
}

function isAiAssistantPlanCode(planCode: string | null): boolean {
  return !!planCode && planCode === AI_ASSISTANT_PLAN_CODE;
}

function extractPlanCode(data: any): string | null {
  return extractPaystackPlanCode(data);
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  return email.trim().toLowerCase();
}

async function getContentWorkspacePlanFromData(data: any): Promise<{
  plan: ContentWorkspacePlan;
  cycle: ContentWorkspaceBillingCycle;
} | null> {
  const planCode = extractPlanCode(data);

  if (!planCode) return null;

  return resolveWorkspacePlan(planCode);
}

function getSubscriptionCode(data: any): string | null {
  return (
    data?.subscription?.subscription_code ?? data?.subscription_code ?? null
  );
}

function getCreatorIdFromMetadata(data: any): string | null {
  const creatorId = data?.metadata?.creatorId;

  return typeof creatorId === "string" ? creatorId : null;
}

function getContentWorkspacePlanFromMetadata(
  data: any,
): ContentWorkspacePlan | null {
  const value = data?.metadata?.contentWorkspacePlan;

  if (value === "CREATOR" || value === "GROWTH" || value === "STUDIO" || value === "UNLIMITED") {
    return value;
  }

  return null;
}

function getContentWorkspaceCycleFromMetadata(
  data: any,
): ContentWorkspaceBillingCycle | null {
  const value = data?.metadata?.billingCycle;

  if (value === "MONTHLY" || value === "ANNUAL") {
    return value;
  }

  return null;
}

export async function POST(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/payments/webhook/route.ts#POST@115")) { return await invokePublishingEntrypoint<never>("app/api/payments/webhook/route.ts#POST@115",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Paystack webhook: invalid signature, rejecting");

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  async function sendPartnerCommissionEmailForPayment(paymentRecordId: string) {
    try {
      const commission = await db.referralCommission.findUnique({
        where: {
          paymentRecordId,
        },
        select: {
          paymentAmountNgn: true,
          commissionAmountNgn: true,
          referral: {
            select: {
              partner: {
                select: {
                  creator: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!commission) {
        return;
      }

      await sendPartnerCommissionEarnedEmail({
        to: commission.referral.partner.creator.email,
        partnerName: commission.referral.partner.creator.name,
        paymentAmountNgn: commission.paymentAmountNgn,
        commissionAmountNgn: commission.commissionAmountNgn,
        paymentType: "QUALIFYING_PAYMENT",
      });
    } catch (err) {
      console.error(
        `Failed to send partner commission email for payment ${paymentRecordId}:`,
        err,
      );
    }
  }

  let event: any;

  try {
    event = JSON.parse(rawBody);
  } catch {
    console.warn("Paystack webhook: invalid JSON payload");

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (typeof event.event === "string" && (event.event.startsWith("refund.") || event.event.startsWith("charge.dispute."))) {
    try {
      const kind = event.event.startsWith("refund.") ? "refund" : "dispute";
      await syncPartnerPaymentIssue(kind, String(event.data?.id ?? ""));
      return NextResponse.json({ received: true });
    } catch { return NextResponse.json({ error: "Payment review verification failed; retry required." }, { status: 503 }); }
  }

  console.log(`Paystack webhook received: ${event.event}`, {
    reference: event.data?.reference,
    email: event.data?.customer?.email,
    planCode: extractPlanCode(event.data),
  });

  let syncedCharge: Awaited<ReturnType<typeof syncVerifiedPayment>> | null =
    null;

  // Persist every successful charge before product-specific state updates or acknowledgements.
  // This also repairs duplicate events and charges whose subscription.create had no reference.
  if (event.event === "charge.success") {
    try {
      const reference =
        typeof event.data?.reference === "string"
          ? event.data.reference.trim()
          : "";
      if (!reference) throw new Error("Charge has no payment reference");
      syncedCharge = await syncVerifiedPayment(reference);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No account matches the verified payment"
      ) {
        const reference =
          typeof event.data?.reference === "string"
            ? event.data.reference.trim()
            : "";
        const retained = reference
          ? await db.paymentRevenueReceipt.findUnique({ where: { reference } })
          : null;
        if (retained)
          return NextResponse.json({
            received: true,
            retainedForUnavailableAccount: true,
          });
      }
      console.error("Verified payment sync failed; webhook must retry", error);
      return NextResponse.json(
        { error: "Payment sync requires retry" },
        { status: 503 },
      );
    }
  }

  // ===========================================================================
  // ONE-TIME PAYMENTS
  // ===========================================================================
  if (event.event === "charge.success" && !extractPlanCode(event.data)) {
    const reference: string = event.data.reference;

    const verification = await verifyTransaction(reference);

    const isActuallySuccessful =
      verification?.data?.status === "success" &&
      verification?.data?.reference === reference;

    if (!isActuallySuccessful) {
      console.warn(
        `Paystack webhook: charge.success for ${reference} failed re-verification`,
        {
          verifiedStatus: verification?.data?.status,
        },
      );
    } else {
      const project = await db.project.findUnique({
        where: {
          paystackRef: reference,
        },
      });

      if (project) {
        if (project.paid) {
          console.log(
            `Paystack webhook: project ${project.id} already marked paid, skipping (likely a retried webhook)`,
          );
        } else {
          await db.project.update({
            where: {
              id: project.id,
            },
            data: {
              paid: true,
              paidAt: new Date(),
              badgeVisible: false,
            },
          });

          try {
            syncedCharge!.payment;
          } catch (err) {
            console.error(
              `Paystack webhook: failed to create PaymentRecord for reference ${reference}`,
              err,
            );
          }
        }
      } else {
        console.warn(
          `Paystack webhook: no project found for reference ${reference}`,
        );
      }
    }
  }

  if (event.event === "subscription.create") {
    const privateCode = extractPlanCode(event.data);
    if (privateCode && typeof event.data?.subscription_code === "string") {
      await db.billingOfferSubscription.updateMany({
        where: { paystackPlanCode: privateCode },
        data: { subscriptionCode: event.data.subscription_code },
      });
    }
  }

  // ===========================================================================
  // SUBSCRIPTION CREATED
  // ===========================================================================
  if (event.event === "subscription.create") {
    const data = event.data;
    const customerEmail = normalizeEmail(data?.customer?.email);

    const planCode = extractPlanCode(data);

    // -------------------------------------------------------------------------
    // MARKETING WORKSPACE
    // -------------------------------------------------------------------------
    const contentWorkspacePlan = await getContentWorkspacePlanFromData(data);

    if (contentWorkspacePlan) {
      const creatorId = getCreatorIdFromMetadata(data);

      const creator = creatorId
        ? await db.creator.findUnique({
            where: {
              id: creatorId,
            },
          })
        : customerEmail
          ? await db.creator.findFirst({
              where: {
                email: {
                  equals: customerEmail,
                  mode: "insensitive",
                },
              },
            })
          : null;

      if (!creator) {
        console.error(
          "Paystack webhook: Marketing Workspace subscription.create with no matching creator",
          {
            creatorId,
            customerEmail,
          },
        );
      } else {
        /*
         * Safety net:
         *
         * If this account already has a different Marketing Workspace
         * subscription, cancel it before accepting the new one.
         *
         * This protects against duplicate active subscriptions when
         * a plan is changed or checkout is accidentally initiated twice.
         */
        if (
          creator.contentWorkspacePaystackSubscriptionCode &&
          creator.contentWorkspacePaystackEmailToken &&
          data.subscription_code &&
          creator.contentWorkspacePaystackSubscriptionCode !==
            data.subscription_code
        ) {
          try {
            await cancelSubscription(
              creator.contentWorkspacePaystackSubscriptionCode,
              creator.contentWorkspacePaystackEmailToken,
            );
          } catch (err) {
            console.error(
              "Failed to cancel previous Marketing Workspace subscription during switch:",
              err,
            );
          }
        }

        const metadataPlan = getContentWorkspacePlanFromMetadata(data);

        const metadataCycle = getContentWorkspaceCycleFromMetadata(data);

        const plan = metadataPlan ?? contentWorkspacePlan.plan;

        const cycle = metadataCycle ?? contentWorkspacePlan.cycle;

        const updated = await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            workspaceOfferSubscriptionId: planCode
              ? await offerSubscriptionId(planCode, creator.id)
              : null,
            contentWorkspacePlan: plan,
            contentWorkspaceBillingStatus: "ACTIVE",
            contentWorkspaceBillingCycle: cycle,

            contentWorkspacePaystackCustomerCode:
              data.customer?.customer_code ?? null,

            contentWorkspacePaystackSubscriptionCode:
              data.subscription_code ?? null,

            contentWorkspacePaystackEmailToken: data.email_token ?? null,

            contentWorkspaceSubscriptionRenewsAt: data.next_payment_date
              ? new Date(data.next_payment_date)
              : null,

            contentWorkspacePendingSubscriptionRef: null,

            contentWorkspaceWentOfflineAt: null,
          },
        });

        try {
          const reference =
            typeof data.reference === "string" && data.reference.trim()
              ? data.reference.trim()
              : null;

          if (!reference) {
            console.error(
              `Paystack webhook: Marketing Workspace subscription.create for creator ${updated.id} has no payment reference — PaymentRecord not created`,
            );
          } else {
            const existingPaymentRecord = await db.paymentRecord.findUnique({
              where: {
                paystackReference: reference,
              },
            });

            if (existingPaymentRecord) {
              await processReferralCommission(existingPaymentRecord);
              console.log(
                `Paystack webhook: PaymentRecord already exists for reference ${reference}, skipping duplicate`,
              );
            } else {
              const paymentRecord = await db.paymentRecord.create({
                data: {
                  creatorId: updated.id,
                  amountNgn: Math.round((data.amount ?? 0) / 100),
                  type: "CONTENT_WORKSPACE_SUBSCRIPTION_INITIAL",
                  contentWorkspacePlan: plan,
                  paystackReference: reference,
                },
              });

              await processReferralCommission(paymentRecord);

              await sendPartnerCommissionEmailForPayment(paymentRecord.id);
            }
          }
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for Marketing Workspace subscription.create (creator ${updated.id})`,
            err,
          );
        }
        console.log(
          "Paystack webhook: Marketing Workspace subscription activated",
          {
            creatorId: updated.id,
            plan,
            cycle,
            subscriptionCode: data.subscription_code,
          },
        );
      }
    }

    // -------------------------------------------------------------------------
    // PORTFOLIO
    // -------------------------------------------------------------------------
    else if (PORTFOLIO_PLAN_CODE && planCode === PORTFOLIO_PLAN_CODE) {
      const portfolioId = data?.metadata?.portfolioId ?? null;

      const portfolio = portfolioId
        ? await db.portfolio.findUnique({
            where: {
              id: portfolioId,
            },
          })
        : null;

      if (!portfolio) {
        console.error(
          `Paystack webhook: portfolio subscription.create with no matching portfolio (metadata.portfolioId: ${portfolioId})`,
        );
      } else {
        await db.portfolio.update({
          where: {
            id: portfolio.id,
          },
          data: {
            billingStatus: "ACTIVE",
            paystackCustomerCode: data.customer?.customer_code ?? null,
            paystackSubscriptionCode: data.subscription_code ?? null,
            paystackEmailToken: data.email_token ?? null,
            subscriptionRenewsAt: data.next_payment_date
              ? new Date(data.next_payment_date)
              : null,
          },
        });

        try {
          await db.paymentRecord.create({
            data: {
              creatorId: portfolio.creatorId,
              amountNgn: Math.round((data.amount ?? 0) / 100),
              type: "PORTFOLIO_SUBSCRIPTION_INITIAL",
              portfolioId: portfolio.id,
              paystackReference: data.reference ?? null,
            },
          });
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for portfolio subscription.create (portfolio ${portfolio.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY CALENDAR
    // -------------------------------------------------------------------------
    else if (isCalendarPlanCode(planCode)) {
      const creatorId = data?.metadata?.creatorId ?? null;

      const creator = creatorId
        ? await db.creator.findUnique({
            where: {
              id: creatorId,
            },
          })
        : customerEmail
          ? await db.creator.findFirst({
              where: {
                email: {
                  equals: customerEmail,
                  mode: "insensitive",
                },
              },
            })
          : null;

      if (!creator) {
        console.error(
          `Paystack webhook: calendar subscription.create with no matching creator (metadata.creatorId: ${creatorId}, email: ${customerEmail})`,
        );
      } else {
        if (
          creator.calendarPaystackSubscriptionCode &&
          creator.calendarPaystackEmailToken &&
          data.subscription_code &&
          creator.calendarPaystackSubscriptionCode !== data.subscription_code
        ) {
          try {
            await cancelSubscription(
              creator.calendarPaystackSubscriptionCode,
              creator.calendarPaystackEmailToken,
            );
          } catch (err) {
            console.error(
              "Failed to cancel previous calendar subscription during switch:",
              err,
            );
          }
        }

        await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            calendarBillingStatus: "ACTIVE",
            calendarPaystackCustomerCode: data.customer?.customer_code ?? null,
            calendarPaystackSubscriptionCode: data.subscription_code ?? null,
            calendarPaystackEmailToken: data.email_token ?? null,
            calendarSubscriptionRenewsAt: data.next_payment_date
              ? new Date(data.next_payment_date)
              : null,
            calendarWentOfflineAt: null,
            calendarLastPaymentReminderSentAt: null,
          },
        });

        try {
          await db.paymentRecord.create({
            data: {
              creatorId: creator.id,
              amountNgn: Math.round((data.amount ?? 0) / 100),
              type: "CALENDAR_SUBSCRIPTION_INITIAL",
              calendarId: data?.metadata?.calendarId ?? null,
              paystackReference: data.reference ?? null,
            },
          });
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for calendar subscription.create (creator ${creator.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY AI ASSISTANT
    // -------------------------------------------------------------------------
    else if (isAiAssistantPlanCode(planCode)) {
      const creatorId = data?.metadata?.creatorId ?? null;

      const creator = creatorId
        ? await db.creator.findUnique({
            where: {
              id: creatorId,
            },
          })
        : customerEmail
          ? await db.creator.findFirst({
              where: {
                email: {
                  equals: customerEmail,
                  mode: "insensitive",
                },
              },
            })
          : null;

      if (!creator) {
        console.error(
          `Paystack webhook: AI assistant subscription.create with no matching creator (metadata.creatorId: ${creatorId}, email: ${customerEmail})`,
        );
      } else {
        await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            aiAssistantBillingStatus: "ACTIVE",
            aiAssistantPaystackCustomerCode:
              data.customer?.customer_code ?? null,
            aiAssistantPaystackSubscriptionCode: data.subscription_code ?? null,
            aiAssistantPaystackEmailToken: data.email_token ?? null,
            aiAssistantSubscriptionRenewsAt: data.next_payment_date
              ? new Date(data.next_payment_date)
              : null,
            aiAssistantWentOfflineAt: null,
          },
        });

        try {
          await db.paymentRecord.create({
            data: {
              creatorId: creator.id,
              amountNgn: Math.round((data.amount ?? 0) / 100),
              type: "AI_ASSISTANT_SUBSCRIPTION_INITIAL",
              paystackReference: data.reference ?? null,
            },
          });
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for AI assistant subscription.create (creator ${creator.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // MAIN SHOWWORK SUBSCRIPTION
    // -------------------------------------------------------------------------
    else {
      const match = planCode ? await resolveDeliveryPlan(planCode) : null;

      if (!customerEmail) {
        console.error(
          "Paystack webhook: subscription.create had no customer email",
          { data },
        );
      } else if (!match) {
        console.error(
          `Paystack webhook: subscription.create with unrecognized plan code "${planCode}" — no matching tier, nothing was updated. Check that this plan code exists in tierFromPlanCode.`,
          {
            planCode,
            rawPlan: data?.plan,
          },
        );
      } else {
        const { tier, cycle } = match;

        const existing = await db.creator.findFirst({
          where: {
            email: {
              equals: customerEmail,
              mode: "insensitive",
            },
          },
        });

        if (!existing) {
          console.error(
            `Paystack webhook: subscription.create for unknown email "${customerEmail}" — no matching Creator account.`,
          );
        } else {
          if (
            existing.paystackSubscriptionCode &&
            existing.paystackEmailToken &&
            data.subscription_code &&
            existing.paystackSubscriptionCode !== data.subscription_code
          ) {
            try {
              await cancelSubscription(
                existing.paystackSubscriptionCode,
                existing.paystackEmailToken,
              );
            } catch (err) {
              console.error(
                "Failed to cancel previous subscription during switch:",
                err,
              );
            }
          }

          const updated = await db.creator.update({
            where: {
              id: existing.id,
            },
            data: {
              deliveryOfferSubscriptionId: planCode
                ? await offerSubscriptionId(planCode, existing.id)
                : null,
              subscriptionActive: true,
              subscriptionTier: tier,
              subscriptionCycle: cycle,
              paystackCustomerCode: data.customer?.customer_code ?? null,
              paystackSubscriptionCode: data.subscription_code ?? null,
              paystackEmailToken: data.email_token ?? null,
              subscriptionRenewsAt: data.next_payment_date
                ? new Date(data.next_payment_date)
                : null,
              currentCycleStart: new Date(),
            },
          });

          try {
            const reference =
              typeof data.reference === "string" && data.reference.trim()
                ? data.reference.trim()
                : null;

            if (!reference) {
              console.error(
                `Paystack webhook: subscription.create for creator ${updated.id} has no payment reference — PaymentRecord not created`,
              );
            } else {
              const existingPaymentRecord = await db.paymentRecord.findUnique({
                where: {
                  paystackReference: reference,
                },
              });

              if (existingPaymentRecord) {
                await processReferralCommission(existingPaymentRecord);
                console.log(
                  `Paystack webhook: PaymentRecord already exists for reference ${reference}, skipping duplicate`,
                );
              } else {
                const paymentRecord = await db.paymentRecord.create({
                  data: {
                    creatorId: updated.id,
                    amountNgn: Math.round((data.amount ?? 0) / 100),
                    type: "SUBSCRIPTION_INITIAL",
                    tier,
                    cycle,
                    paystackReference: reference,
                  },
                });

                await processReferralCommission(paymentRecord);
              }
            }
          } catch (err) {
            console.error(
              `Paystack webhook: failed to create PaymentRecord for subscription.create (creator ${updated.id})`,
              err,
            );
          }
        }
      }
    }
  }

  // ===========================================================================
  // RENEWAL CHARGE SUCCEEDED
  // ===========================================================================
  if (event.event === "charge.success" && extractPlanCode(event.data)) {
    const planCode = extractPlanCode(event.data);

    const offerCheckout = planCode
      ? await db.billingOfferSubscription.findUnique({
          where: { paystackPlanCode: planCode },
        })
      : null;
    // -------------------------------------------------------------------------
    // MARKETING WORKSPACE
    // -------------------------------------------------------------------------
    const contentWorkspacePlan = planCode
      ? await resolveWorkspacePlan(planCode)
      : null;

    if (contentWorkspacePlan) {
      const subscriptionCode = getSubscriptionCode(event.data);

      const creator = subscriptionCode
        ? await db.creator.findFirst({
            where: {
              contentWorkspacePaystackSubscriptionCode: subscriptionCode,
            },
          })
        : offerCheckout
          ? await db.creator.findUnique({
              where: { id: offerCheckout.creatorId },
            })
          : null;

      if (!creator) {
        console.error(
          `Paystack webhook: Marketing Workspace renewal charge.success with no matching account (subscription_code: ${subscriptionCode})`,
        );
      } else {
        await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            contentWorkspaceBillingStatus: "ACTIVE",
            contentWorkspaceBillingCycle: contentWorkspacePlan.cycle,
            contentWorkspaceWentOfflineAt: null,
          },
        });

        try {
          const reference =
            typeof event.data.reference === "string" &&
            event.data.reference.trim()
              ? event.data.reference.trim()
              : null;

          if (!reference) {
            console.error(
              `Paystack webhook: Marketing Workspace renewal for creator ${creator.id} has no payment reference — PaymentRecord not created`,
            );
          } else {
            const existingPaymentRecord = await db.paymentRecord.findUnique({
              where: {
                paystackReference: reference,
              },
            });

            if (existingPaymentRecord) {
              await processReferralCommission(existingPaymentRecord);
              console.log(
                `Paystack webhook: PaymentRecord already exists for reference ${reference}, skipping duplicate`,
              );
            } else {
              const paymentRecord = syncedCharge!.payment;

              await processReferralCommission(paymentRecord);
            }
          }
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for Marketing Workspace renewal (creator ${creator.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // PORTFOLIO
    // -------------------------------------------------------------------------
    else if (PORTFOLIO_PLAN_CODE && planCode === PORTFOLIO_PLAN_CODE) {
      const subscriptionCode = getSubscriptionCode(event.data);

      const portfolio = subscriptionCode
        ? await db.portfolio.findFirst({
            where: {
              paystackSubscriptionCode: subscriptionCode,
            },
          })
        : null;

      if (!portfolio) {
        console.error(
          `Paystack webhook: portfolio renewal charge.success with no matching portfolio (subscription_code: ${subscriptionCode})`,
        );
      } else {
        await db.portfolio.update({
          where: {
            id: portfolio.id,
          },
          data: {
            billingStatus: "ACTIVE",
            wentOfflineAt: null,
            lastPaymentReminderSentAt: null,
          },
        });

        try {
          syncedCharge!.payment;
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for portfolio renewal (portfolio ${portfolio.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY CALENDAR
    // -------------------------------------------------------------------------
    else if (isCalendarPlanCode(planCode)) {
      const subscriptionCode = getSubscriptionCode(event.data);

      const creator = subscriptionCode
        ? await db.creator.findFirst({
            where: {
              calendarPaystackSubscriptionCode: subscriptionCode,
            },
          })
        : null;

      if (!creator) {
        console.error(
          `Paystack webhook: calendar renewal charge.success with no matching account (subscription_code: ${subscriptionCode})`,
        );
      } else {
        await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            calendarBillingStatus: "ACTIVE",
            calendarWentOfflineAt: null,
            calendarLastPaymentReminderSentAt: null,
          },
        });

        try {
          syncedCharge!.payment;
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for calendar renewal (creator ${creator.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY AI ASSISTANT
    // -------------------------------------------------------------------------
    else if (isAiAssistantPlanCode(planCode)) {
      const subscriptionCode = getSubscriptionCode(event.data);

      const creator = subscriptionCode
        ? await db.creator.findFirst({
            where: {
              aiAssistantPaystackSubscriptionCode: subscriptionCode,
            },
          })
        : null;

      if (!creator) {
        console.error(
          `Paystack webhook: AI assistant renewal charge.success with no matching account (subscription_code: ${subscriptionCode})`,
        );
      } else {
        await db.creator.update({
          where: {
            id: creator.id,
          },
          data: {
            aiAssistantBillingStatus: "ACTIVE",
            aiAssistantWentOfflineAt: null,
          },
        });

        try {
          syncedCharge!.payment;
        } catch (err) {
          console.error(
            `Paystack webhook: failed to create PaymentRecord for AI assistant renewal (creator ${creator.id})`,
            err,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // MAIN SHOWWORK SUBSCRIPTION
    // -------------------------------------------------------------------------
    else {
      const customerEmail = normalizeEmail(event.data?.customer?.email);

      const match = planCode ? await resolveDeliveryPlan(planCode) : null;

      if (!customerEmail) {
        console.error(
          "Paystack webhook: renewal charge.success had no customer email",
          {
            data: event.data,
          },
        );
      } else if (!match) {
        console.error(
          `Paystack webhook: renewal charge.success with unrecognized plan code "${planCode}" — nothing was updated.`,
          { planCode },
        );
      } else {
        const { tier, cycle } = match;

        const existing = await db.creator.findFirst({
          where: {
            email: {
              equals: customerEmail,
              mode: "insensitive",
            },
          },
        });

        if (!existing) {
          console.error(
            `Paystack webhook: renewal charge.success for unknown email "${customerEmail}" — no matching Creator account.`,
          );
        } else {
          const updated = await db.creator.update({
            where: {
              id: existing.id,
            },
            data: {
              subscriptionActive: true,
              subscriptionTier: tier,
              subscriptionCycle: cycle,
              currentCycleStart: new Date(),
            },
          });

          try {
            const reference =
              typeof event.data.reference === "string"
                ? event.data.reference.trim()
                : "";
            if (!reference)
              throw new Error("Delivery charge has no payment reference");
            const paymentRecord = syncedCharge!.payment;
            await processReferralCommission(paymentRecord);
          } catch (err) {
            console.error(
              "Paystack webhook: failed to record Delivery charge",
              err,
            );
            // Acknowledge only once the verified receipt is durable; Paystack can retry.
            return NextResponse.json(
              { error: "Payment recording failed" },
              { status: 503 },
            );
          }
        }
      }
    }
  }

  // ===========================================================================
  // RENEWAL PAYMENT FAILED
  // ===========================================================================
  if (event.event === "invoice.payment_failed") {
    const planCode =
      extractPlanCode(event.data) ?? extractPlanCode(event.data?.subscription);

    // -------------------------------------------------------------------------
    // MARKETING WORKSPACE
    // -------------------------------------------------------------------------
    const contentWorkspacePlan = planCode
      ? await resolveWorkspacePlan(planCode)
      : null;

    if (contentWorkspacePlan) {
      const subscriptionCode = getSubscriptionCode(event.data);

      if (subscriptionCode) {
        const creator = await db.creator.findFirst({
          where: {
            contentWorkspacePaystackSubscriptionCode: subscriptionCode,
          },
        });

        if (creator) {
          await db.creator.update({
            where: {
              id: creator.id,
            },
            data: {
              contentWorkspaceBillingStatus: "OFFLINE",
              contentWorkspaceWentOfflineAt: new Date(),
            },
          });

          try {
            await sendCalendarPaymentFailedEmail({
              to: creator.email,
              name: creator.name,
            });
          } catch (err) {
            console.error(
              `Failed to send Marketing Workspace payment-failed email (creator ${creator.id})`,
              err,
            );
          }
        } else {
          console.error(
            `Paystack webhook: Marketing Workspace invoice.payment_failed with no matching account (subscription_code: ${subscriptionCode})`,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // PORTFOLIO
    // -------------------------------------------------------------------------
    else if (PORTFOLIO_PLAN_CODE && planCode === PORTFOLIO_PLAN_CODE) {
      const subscriptionCode = getSubscriptionCode(event.data);

      if (subscriptionCode) {
        const portfolio = await db.portfolio.findFirst({
          where: {
            paystackSubscriptionCode: subscriptionCode,
          },
        });

        if (portfolio) {
          await db.portfolio.update({
            where: {
              id: portfolio.id,
            },
            data: {
              billingStatus: "OFFLINE",
              wentOfflineAt: new Date(),
            },
          });

          try {
            const creator = await db.creator.findUnique({
              where: {
                id: portfolio.creatorId,
              },
            });

            if (creator) {
              await sendPortfolioPaymentFailedEmail({
                to: creator.email,
                name: creator.name,
                portfolioName: portfolio.companyName,
              });
            }
          } catch (err) {
            console.error(
              `Failed to send portfolio payment-failed email (portfolio ${portfolio.id})`,
              err,
            );
          }
        } else {
          console.error(
            `Paystack webhook: portfolio invoice.payment_failed with no matching portfolio (subscription_code: ${subscriptionCode})`,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY CALENDAR
    // -------------------------------------------------------------------------
    else if (isCalendarPlanCode(planCode)) {
      const subscriptionCode = getSubscriptionCode(event.data);

      if (subscriptionCode) {
        const creator = await db.creator.findFirst({
          where: {
            calendarPaystackSubscriptionCode: subscriptionCode,
          },
        });

        if (creator) {
          await db.creator.update({
            where: {
              id: creator.id,
            },
            data: {
              calendarBillingStatus: "OFFLINE",
              calendarWentOfflineAt: new Date(),
            },
          });

          try {
            await sendCalendarPaymentFailedEmail({
              to: creator.email,
              name: creator.name,
            });
          } catch (err) {
            console.error(
              `Failed to send calendar payment-failed email (creator ${creator.id})`,
              err,
            );
          }
        } else {
          console.error(
            `Paystack webhook: calendar invoice.payment_failed with no matching account (subscription_code: ${subscriptionCode})`,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // LEGACY AI ASSISTANT
    // -------------------------------------------------------------------------
    else if (isAiAssistantPlanCode(planCode)) {
      const subscriptionCode = getSubscriptionCode(event.data);

      if (subscriptionCode) {
        const creator = await db.creator.findFirst({
          where: {
            aiAssistantPaystackSubscriptionCode: subscriptionCode,
          },
        });

        if (creator) {
          await db.creator.update({
            where: {
              id: creator.id,
            },
            data: {
              aiAssistantBillingStatus: "OFFLINE",
              aiAssistantWentOfflineAt: new Date(),
            },
          });

          console.warn(
            `AI assistant payment failed for creator ${creator.id} — no notification email sent yet (not built).`,
          );
        } else {
          console.error(
            `Paystack webhook: AI assistant invoice.payment_failed with no matching account (subscription_code: ${subscriptionCode})`,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // MAIN SHOWWORK SUBSCRIPTION
    // -------------------------------------------------------------------------
    else {
      const customerEmail = normalizeEmail(event.data?.customer?.email);

      if (customerEmail) {
        await db.creator.updateMany({
          where: {
            email: {
              equals: customerEmail,
              mode: "insensitive",
            },
          },
          data: {
            subscriptionActive: false,
          },
        });
      }
    }
  }

  // ===========================================================================
  // SUBSCRIPTION CANCELLED / DISABLED
  // ===========================================================================
  if (event.event === "subscription.disable") {
    const data = event.data;
    const subscriptionCode = data?.subscription_code;

    if (subscriptionCode) {
      // -----------------------------------------------------------------------
      // PORTFOLIO
      // -----------------------------------------------------------------------
      const portfolio = await db.portfolio.findFirst({
        where: {
          paystackSubscriptionCode: subscriptionCode,
        },
      });

      // -----------------------------------------------------------------------
      // MARKETING WORKSPACE
      // -----------------------------------------------------------------------
      const contentWorkspaceAccount = !portfolio
        ? await db.creator.findFirst({
            where: {
              contentWorkspacePaystackSubscriptionCode: subscriptionCode,
            },
          })
        : null;

      // -----------------------------------------------------------------------
      // LEGACY CALENDAR
      // -----------------------------------------------------------------------
      const calendarAccount =
        !portfolio && !contentWorkspaceAccount
          ? await db.creator.findFirst({
              where: {
                calendarPaystackSubscriptionCode: subscriptionCode,
              },
            })
          : null;

      // -----------------------------------------------------------------------
      // LEGACY AI ASSISTANT
      // -----------------------------------------------------------------------
      const aiAssistantAccount =
        !portfolio && !contentWorkspaceAccount && !calendarAccount
          ? await db.creator.findFirst({
              where: {
                aiAssistantPaystackSubscriptionCode: subscriptionCode,
              },
            })
          : null;

      if (portfolio) {
        await db.portfolio.update({
          where: {
            id: portfolio.id,
          },
          data: {
            billingStatus: "OFFLINE",
            wentOfflineAt: new Date(),
          },
        });
      } else if (contentWorkspaceAccount) {
        await db.creator.update({
          where: {
            id: contentWorkspaceAccount.id,
          },
          data: {
            contentWorkspaceBillingStatus: "OFFLINE",
            contentWorkspaceWentOfflineAt: new Date(),
          },
        });
      } else if (calendarAccount) {
        await db.creator.update({
          where: {
            id: calendarAccount.id,
          },
          data: {
            calendarBillingStatus: "OFFLINE",
            calendarWentOfflineAt: new Date(),
          },
        });
      } else if (aiAssistantAccount) {
        await db.creator.update({
          where: {
            id: aiAssistantAccount.id,
          },
          data: {
            aiAssistantBillingStatus: "OFFLINE",
            aiAssistantWentOfflineAt: new Date(),
          },
        });
      } else {
        await db.creator.updateMany({
          where: {
            paystackSubscriptionCode: subscriptionCode,
          },
          data: {
            subscriptionActive: false,
          },
        });
      }
    }
  }

  if (
    event.event === "charge.success" &&
    typeof event.data?.reference === "string"
  ) {
    try {
      await recordOfferPayment(event.data.reference);
    } catch (error) {
      console.error("Offer payment reconciliation failed", error);
      return NextResponse.json(
        { error: "Offer reconciliation requires retry" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    received: true,
  });
}
