import { reconcilePartnerIssues } from "@/lib/partnerPaymentIssues";
import { db } from "@/lib/db";

const QUALIFYING_PAYMENT_TYPES = new Set([
  "SUBSCRIPTION_INITIAL",
  "SUBSCRIPTION_RENEWAL",
  "CONTENT_WORKSPACE_SUBSCRIPTION_INITIAL",
  "CONTENT_WORKSPACE_SUBSCRIPTION_RENEWAL",
]);

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  // Clamp leap-day anniversaries to February's last day, in UTC.
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

type PaymentForCommission = {
  id: string;
  creatorId: string;
  amountNgn: number;
  type: string;
  createdAt: Date;
  revenueStatus?: string;
};

export async function processReferralCommission(
  payment: PaymentForCommission
): Promise<void> {
  if (payment.revenueStatus !== "LIVE" ||
      !QUALIFYING_PAYMENT_TYPES.has(payment.type) ||
      !Number.isSafeInteger(payment.amountNgn) || payment.amountNgn <= 0) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.$transaction(async (tx) => {
        const referral = await tx.referral.findUnique({
          where: { referredCreatorId: payment.creatorId },
          select: { id: true, status: true, startedAt: true, commissionEndsAt: true, commissionPercent: true, commissionMonths: true },
        });
        if (!referral || !["PENDING", "ACTIVE"].includes(referral.status)) return;

        const percent = referral.commissionPercent ?? 10; // Legacy agreement fallback.
        const months = referral.commissionMonths ?? 12;

        const existing = await tx.referralCommission.findUnique({
          where: { paymentRecordId: payment.id }, select: { id: true },
        });
        if (existing) {
          const record = await tx.paymentRecord.findUnique({ where: { id: payment.id }, select: { paystackReference: true } });
          if (record?.paystackReference) await reconcilePartnerIssues(tx, record.paystackReference);
          return;
        }

        if (referral.status === "PENDING") {
          await tx.referral.update({
            where: { id: referral.id },
            data: {
              status: "ACTIVE", startedAt: payment.createdAt,
              commissionEndsAt: addMonths(payment.createdAt, months),
            },
          });
        } else if (!referral.startedAt || !referral.commissionEndsAt ||
                   payment.createdAt < referral.startedAt ||
                   payment.createdAt >= referral.commissionEndsAt) {
          return;
        }

        if (percent === 0) return;

        // Stopping new referrals does not cancel existing customers' eligibility.
        await tx.referralCommission.create({
          data: {
            referralId: referral.id, paymentRecordId: payment.id,
            paymentAmountNgn: payment.amountNgn,
            commissionPercent: percent,
            commissionAmountNgn: Math.floor(payment.amountNgn * percent / 100),
            status: "PENDING", earnedAt: payment.createdAt,
          },
        });
        const record = await tx.paymentRecord.findUnique({ where: { id: payment.id }, select: { paystackReference: true } });
        if (record?.paystackReference) await reconcilePartnerIssues(tx, record.paystackReference);
      }, { isolationLevel: "Serializable" });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Concurrent payments must re-read the window; duplicate deliveries are harmless.
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      throw error;
    }
  }
}
