import { resolveNigerianAccount } from "@/lib/paystack";
import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
      return NextResponse.json(
        {
          error:
            "You need to join the Partner Program first.",
        },
        { status: 403 }
      );
    }

    if (partner.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "You do not currently have access to the Partner Program.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      payoutAccount: partner.payoutAccount,
    });
  } catch (error) {
    console.error(
      "Partner payout account GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load payout account. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
      },
    });

    if (!partner) {
      return NextResponse.json(
        {
          error:
            "You need to join the Partner Program first.",
        },
        { status: 403 }
      );
    }

    if (partner.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "You do not currently have access to the Partner Program.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const bankCode = normalize(body.bankCode);
    const accountNumber = normalize(body.accountNumber);


    if (!bankCode) {
      return NextResponse.json(
        {
          error: "Select a bank.",
        },
        { status: 400 }
      );
    }

    if (!accountNumber) {
      return NextResponse.json(
        {
          error: "Account number is required.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid 10-digit Nigerian bank account number.",
        },
        { status: 400 }
      );
    }

    let verified;
    try { verified = await resolveNigerianAccount(bankCode, accountNumber); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 422 }); }

    const payoutAccount = await db.$transaction(async tx => {
      const account = await tx.partnerPayoutAccount.upsert({
        where: {
          partnerId: partner.id,
        },
        create: {
          partnerId: partner.id,
          ...verified,
        },
        update: {
          ...verified,
        },
        select: {
          id: true,
          bankName: true, bankCode: true, verifiedAt: true,
          accountNumber: true,
          accountName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.partnerAuditEvent.create({ data: { actorId: creator.id, targetId: partner.id, action: "BANK_VERIFIED", detail: { bankCode, lastFour: accountNumber.slice(-4) } } });
      return account;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({
      ok: true,
      payoutAccount,
    });
  } catch (error) {
    if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "")) return NextResponse.json({ error: "Account changed. Refresh and retry verification." }, { status: 409 });
    console.error(
      "Partner payout account PUT error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to save payout account. Please try again.",
      },
      { status: 500 }
    );
  }
}