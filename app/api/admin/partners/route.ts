import { effectiveReferralStatus } from "@/lib/partnerLifecycle";
import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const creator = await getCurrentCreator();

    if (!creator) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isAdminEmail(creator.email)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const [
      partnerCount,
      activePartnerCount,
      referralCounts,
      commissionCounts,
      payoutCounts,
      commissionTotals,
      payoutTotals,
    ] = await Promise.all([
      db.partnerProfile.count(),

      db.partnerProfile.count({
        where: {
          isActive: true, status: "ACTIVE",
        },
      }),

      db.referral.findMany({ select: { status: true, commissionEndsAt: true } }),

      db.referralCommission.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
        _sum: {
          commissionAmountNgn: true, reversedAmountNgn: true,
        },
      }),

      db.partnerPayout.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
        _sum: {
          amountNgn: true,
        },
      }),

      db.referralCommission.aggregate({
        where: { status: { not: "VOIDED" } },
        _sum: {
          reversedAmountNgn: true, commissionAmountNgn: true,
        },
      }),

      db.partnerPayout.aggregate({
        where: { status: "PAID" },
        _sum: {
          amountNgn: true,
        },
      }),
    ]);

    const referrals = {
      pending: 0,
      active: 0,
      expired: 0,
      disqualified: 0,
    };

    for (const item of referralCounts) {
      referrals[effectiveReferralStatus(item).toLowerCase() as keyof typeof referrals] += 1;
    }

    const commissions = {
      pending: {
        count: 0,
        amountNgn: 0,
      },
      approved: {
        count: 0,
        amountNgn: 0,
      },
      paid: {
        count: 0,
        amountNgn: 0,
      },
      voided: {
        count: 0,
        amountNgn: 0,
      },
    };

    for (const item of commissionCounts) {
      const key =
        item.status.toLowerCase() as keyof typeof commissions;

      commissions[key] = {
        count: item._count._all,
        amountNgn: item.status === "PAID" ? item._sum.commissionAmountNgn ?? 0 : (item._sum.commissionAmountNgn ?? 0) - (item._sum.reversedAmountNgn ?? 0),
      };
    }

    const payouts = {
      pending: {
        count: 0,
        amountNgn: 0,
      },
      approved: {
        count: 0,
        amountNgn: 0,
      },
      paid: {
        count: 0,
        amountNgn: 0,
      },
      rejected: {
        count: 0,
        amountNgn: 0,
      },
    };

    for (const item of payoutCounts) {
      const key =
        item.status.toLowerCase() as keyof typeof payouts;

      if (key in payouts) {
        payouts[key] = {
          count: item._count._all,
          amountNgn: item._sum.amountNgn ?? 0,
        };
      }
    }

    const partners = await db.partnerProfile.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
  id: true,
  referralCode: true,
  commissionPercent: true, commissionMonths: true, discountPercent: true, discountMonths: true,
  status: true,
  isActive: true,
  createdAt: true,
  creator: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            referrals: true,
          },
        },
      },
    });

    return NextResponse.json({
      overview: {
        totalPartners: partnerCount,
        activePartners: activePartnerCount,

        activeReferrals: referrals.active,

        pendingCommissions: commissions.pending.amountNgn,

        pendingPayouts: payouts.pending.amountNgn,

        totalCommissions:
          (commissionTotals._sum.commissionAmountNgn ?? 0) - (commissionTotals._sum.reversedAmountNgn ?? 0),

        totalPayouts:
          payoutTotals._sum.amountNgn ?? 0,
      },

      referrals,

      commissions,

      payouts,

      partners,
    });
  } catch (error) {
    console.error(
      "Admin partner dashboard error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load partner program data.",
      },
      { status: 500 }
    );
  }
}