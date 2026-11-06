import { reviewPartnerPayout } from "@/lib/partnerFinance";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";
import { sendPartnerPayoutPaidEmail } from "@/lib/resend";

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

    const payouts = await db.partnerPayout.findMany({
      orderBy: {
        requestedAt: "desc",
      },
      include: {
    partner: {
  include: {
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    payoutAccount: {
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    },
  },
},
        payoutCommissions: {
          select: {
            id: true,
            commissionId: true,
            amountNgn: true,
            commission: {
              select: {
                id: true,
                paymentRecordId: true,
                paymentAmountNgn: true,
                commissionAmountNgn: true,
                earnedAt: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      payouts: payouts.map(payout => ({ ...payout, partner: { ...payout.partner, payoutAccount: payout.accountVerifiedAt ? { bankName: payout.bankName, bankCode: payout.bankCode, accountNumber: payout.accountNumber, accountName: payout.accountName } : null } })),
    });
  } catch (error) {
    console.error(
      "Admin partner payouts GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load partner payouts.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
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

    const body = await req.json();

    const payoutId =
      typeof body?.payoutId === "string"
        ? body.payoutId.trim()
        : "";

    const action =
      body?.action === "APPROVE" ||
      body?.action === "REJECT" ||
      body?.action === "MARK_PAID"
        ? body.action
        : null;

    const adminNote =
      typeof body?.adminNote === "string"
        ? body.adminNote.trim()
        : "";

    const payoutReference =
      typeof body?.payoutReference === "string"
        ? body.payoutReference.trim()
        : "";

    if (!payoutId || !action) {
      return NextResponse.json(
        {
          error:
            "Payout ID and a valid action are required.",
        },
        { status: 400 }
      );
    }

    if (
      action === "MARK_PAID" &&
      !payoutReference
    ) {
      return NextResponse.json(
        {
          error:
            "A payout reference is required when marking a payout as paid.",
        },
        { status: 400 }
      );
    }

    if (
      action === "MARK_PAID" &&
      payoutReference.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            "The payout reference is too long.",
        },
        { status: 400 }
      );
    }

    const payout = await db.$transaction(tx => reviewPartnerPayout(tx, payoutId, action, creator.id, adminNote, payoutReference), { isolationLevel: "Serializable" });

    if (payout.status === "PAID") {
  try {
    const partner = await db.partnerProfile.findUnique({
      where: {
        id: payout.partnerId,
      },
      select: {
        creator: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (partner) {
      await sendPartnerPayoutPaidEmail({
        to: partner.creator.email,
        partnerName: partner.creator.name,
        amountNgn: payout.amountNgn,
        payoutReference:
          payout.payoutReference ?? "",
      });
    }
  } catch (err) {
    console.error(
      `Failed to send partner payout-paid email for payout ${payout.id}:`,
      err
    );
  }
}

return NextResponse.json({
  ok: true,
  payout,
});
  } catch (error) {
    const conflict = ["P2034", "P2002"].includes((error as { code?: string }).code ?? "");
    return NextResponse.json({ error: conflict ? "This payout changed during review. Refresh and try again." : error instanceof Error ? error.message : "Could not update payout." }, { status: 409 });
  }
}
