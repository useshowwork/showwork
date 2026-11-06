import { NextRequest, NextResponse } from "next/server";
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

    const commissions =
      await db.referralCommission.findMany({
        orderBy: {
          earnedAt: "desc",
        },
        include: {
          referral: {
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
                },
              },
              referredCreator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          payoutAllocation: {
            select: {
              id: true,
              payoutId: true,
              amountNgn: true,
            },
          },
        },
      });

    return NextResponse.json({
      commissions,
    });
  } catch (error) {
    console.error(
      "Admin partner commissions GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load partner commissions.",
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

    const commissionId =
      typeof body?.commissionId === "string"
        ? body.commissionId.trim()
        : "";

    const action =
      body?.action === "APPROVE" ||
      body?.action === "VOID"
        ? body.action
        : null;

    if (!commissionId || !action) {
      return NextResponse.json(
        {
          error:
            "Commission ID and a valid action are required.",
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(
      async (tx) => {
        const commission =
          await tx.referralCommission.findUnique({
            where: {
              id: commissionId,
            },
            select: {
              id: true,
              status: true, onHold: true, reversedAmountNgn: true,
              payoutAllocation: {
                select: {
                  id: true,
                  payoutId: true,
                },
              },
            },
          });

        if (!commission) {
          throw new Error(
            "Commission not found."
          );
        }

        if (commission.onHold) throw new Error("Payment is under review. Resolve it first.");
        if (commission.status !== "PENDING") {
          throw new Error(
            "This commission has already been reviewed."
          );
        }

        if (commission.payoutAllocation) {
          throw new Error(
            "This commission is already allocated to a payout."
          );
        }

        const changed = await tx.referralCommission.updateMany({ where: { id: commission.id, status: "PENDING", onHold: false }, data: { status: action === "APPROVE" ? "APPROVED" : "VOIDED", ...(action === "APPROVE" ? { approvedAt: new Date() } : {}) } });
        if (changed.count !== 1) throw new Error("Commission changed during review.");
        await tx.partnerAuditEvent.create({ data: { actorId: creator.id, targetId: commission.id, action: `COMMISSION_${action}`, detail: {} } });
        return tx.referralCommission.findUnique({ where: { id: commission.id } });
      }, { isolationLevel: "Serializable" });

    return NextResponse.json({
      ok: true,
      commission: result,
    });
  } catch (error) {
    if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "")) return NextResponse.json({ error: "Commission changed. Refresh and retry." }, { status: 409 });
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update commission.";

    console.error(
      "Admin partner commission PATCH error:",
      error
    );

    if (
      message === "Commission not found."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    if (
      message === "Payment is under review. Resolve it first." || message === "Commission changed during review." ||
      message ===
        "This commission has already been reviewed." ||
      message ===
        "This commission is already allocated to a payout."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Failed to update commission.",
      },
      { status: 500 }
    );
  }
}