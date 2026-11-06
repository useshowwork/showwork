import { effectiveReferralStatus } from "@/lib/partnerLifecycle";
import { netCommission, outstandingRecovery } from "@/lib/partnerFinance";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentCreator } from "@/lib/auth";

const MINIMUM_PAYOUT_NGN = 5000;

export async function GET() {
  try {
    const creator = await getCurrentCreator();

    if (!creator) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const partner = await db.partnerProfile.findUnique({
      where: {
        creatorId: creator.id,
      },
      select: {
        id: true,
        status: true,
        referralCode: true,
        commissionPercent: true, commissionMonths: true, discountPercent: true, discountMonths: true,
        isActive: true,
        createdAt: true,
        referrals: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            commissionEndsAt: true,
            createdAt: true,
            commissions: {
              select: {
                id: true,
                paymentRecordId: true,
                paymentAmountNgn: true,
                commissionPercent: true,
                commissionAmountNgn: true, reversedAmountNgn: true, onHold: true, recoverySettledNgn: true,
                status: true,
                earnedAt: true,
                approvedAt: true,
                paidAt: true,
                payoutReference: true,
                payoutAllocation: {
                  select: {
                    id: true,
                    payoutId: true,
                    amountNgn: true,
                    payout: {
                      select: {
                        status: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                earnedAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        payouts: {
          select: {
            id: true,
            amountNgn: true,
            status: true,
            requestedAt: true,
            approvedAt: true,
            paidAt: true,
            payoutReference: true,
            adminNote: true,
            _count: {
              select: {
                payoutCommissions: true,
              },
            },
          },
          orderBy: {
            requestedAt: "desc",
          },
          take: 20,
        },
        payoutAccount: {
          select: {
            id: true,
            bankName: true, bankCode: true, verifiedAt: true,
            accountNumber: true,
            accountName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({
        enrolled: false,
      });
    }

    /*
     * Partner Program access is controlled by status.
     *
     * Only ACTIVE partners can access referral,
     * commission, and payout information.
     */
    if (partner.status !== "ACTIVE") {
      return NextResponse.json({
        enrolled: false,
        access: partner.status,
      });
    }

    const referrals = partner.referrals.map(row => ({ ...row, status: effectiveReferralStatus(row) }));

    const commissions = referrals.flatMap(
      (referral) => referral.commissions
    );

    const totalEarnedNgn = commissions.filter((commission) => commission.status !== "VOIDED").reduce(
      (total, commission) =>
        total + netCommission(commission),
      0
    );

    const pendingNgn = commissions
      .filter((commission) => commission.status === "PENDING")
      .reduce(
        (total, commission) =>
          total + netCommission(commission),
        0
      );

    const approvedNgn = commissions
      .filter((commission) => commission.status === "APPROVED")
      .reduce(
        (total, commission) =>
          total + netCommission(commission),
        0
      );

    const paidNgn = commissions
      .filter((commission) => commission.status === "PAID")
      .reduce(
        (total, commission) =>
          total + commission.commissionAmountNgn,
        0
      );

    const voidedNgn = commissions
      .filter((commission) => commission.status === "VOIDED")
      .reduce(
        (total, commission) =>
          total + netCommission(commission),
        0
      );

    /*
     * A commission is available for payout only when:
     * - it has been approved
     * - it has not already been allocated to a payout
     *
     * This prevents commissions that are already part of a
     * pending/approved/paid payout from being counted again.
     */
    const availableCommissions = commissions.filter(
      (commission) =>
        commission.status === "APPROVED" && !commission.onHold &&
        !commission.payoutAllocation
    );

    const availableNgn = availableCommissions.reduce(
      (total, commission) =>
        total + netCommission(commission),
      0
    );

    const recoveryDueNgn = commissions.reduce((sum,row)=>sum+outstandingRecovery(row),0);
    const paymentUnderReview = commissions.some(row=>row.onHold);
    const canRequestPayout = availableNgn >= MINIMUM_PAYOUT_NGN && recoveryDueNgn === 0 && !paymentUnderReview && Boolean(partner.payoutAccount?.verifiedAt) && !partner.payouts.some(row => ["PENDING", "APPROVED"].includes(row.status));

    const activePayout =
      partner.payouts.find(
        (payout) =>
          payout.status === "PENDING" ||
          payout.status === "APPROVED"
      ) ?? null;

    const pendingReferrals = referrals.filter(
      (referral) => referral.status === "PENDING"
    ).length;

    const activeReferrals = referrals.filter(
      (referral) => referral.status === "ACTIVE"
    ).length;

    const expiredReferrals = referrals.filter(
      (referral) => referral.status === "EXPIRED"
    ).length;

    const disqualifiedReferrals = referrals.filter(
      (referral) => referral.status === "DISQUALIFIED"
    ).length;

    return NextResponse.json({
      enrolled: true,

      partner: {
        id: partner.id,
        status: partner.status,
        referralCode: partner.referralCode,
        commissionPercent: partner.commissionPercent, commissionMonths: partner.commissionMonths,
        discountPercent: partner.discountPercent, discountMonths: partner.discountMonths,
        isActive: partner.isActive,
        createdAt: partner.createdAt,
      },

      referralLink: `/signup?ref=${partner.referralCode}`,

      referrals: {
        total: referrals.length,
        pending: pendingReferrals,
        active: activeReferrals,
        expired: expiredReferrals,
        disqualified: disqualifiedReferrals,
      },

      commissions: {
        totalEarnedNgn,
        pendingNgn,
        approvedNgn,
        paidNgn,
        voidedNgn,
        totalCount: commissions.length,
        reversedNgn: commissions.filter(row=>row.status !== "VOIDED").reduce((sum,row)=>sum+row.reversedAmountNgn,0),
      },

      payout: {
        minimumPayoutNgn: MINIMUM_PAYOUT_NGN, recoveryDueNgn, paymentUnderReview,
        availableNgn,
        canRequestPayout,
        activePayout: activePayout
          ? {
              id: activePayout.id,
              amountNgn: activePayout.amountNgn,
              status: activePayout.status,
              requestedAt: activePayout.requestedAt,
              approvedAt: activePayout.approvedAt,
              paidAt: activePayout.paidAt,
              payoutReference:
                activePayout.payoutReference,
              adminNote: activePayout.adminNote,
              commissionCount:
                activePayout._count.payoutCommissions,
            }
          : null,

        payoutHistory: partner.payouts.map(
          (payout) => ({
            id: payout.id,
            amountNgn: payout.amountNgn,
            status: payout.status,
            requestedAt: payout.requestedAt,
            approvedAt: payout.approvedAt,
            paidAt: payout.paidAt,
            payoutReference:
              payout.payoutReference,
            adminNote: payout.adminNote,
            commissionCount:
              payout._count.payoutCommissions,
          })
        ),
      },

      payoutAccount: partner.payoutAccount,

      commissionHistory: commissions.map((commission) => {
        const referral = referrals.find(
          (item) =>
            item.commissions.some(
              (itemCommission) =>
                itemCommission.id === commission.id
            )
        );

        return {
          id: commission.id,
          referralId: referral?.id ?? null,
          paymentRecordId: commission.paymentRecordId,
          paymentAmountNgn: commission.paymentAmountNgn,
          commissionPercent: commission.commissionPercent,
          commissionAmountNgn: netCommission(commission),
          originalCommissionAmountNgn: commission.commissionAmountNgn, reversedAmountNgn: commission.reversedAmountNgn, onHold: commission.onHold,
          status: commission.status,
          earnedAt: commission.earnedAt,
          approvedAt: commission.approvedAt,
          paidAt: commission.paidAt,
          payoutReference:
            commission.payoutReference,
        };
      }),
    });
  } catch (error) {
    console.error(
      "Partner dashboard API error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load partner dashboard" },
      { status: 500 }
    );
  }
}