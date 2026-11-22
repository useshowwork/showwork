import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { initializeSubscription } from "@/lib/paystack";
import { appUrl } from "@/lib/url";
import { PORTFOLIO_YEARLY_NGN } from "@/lib/portfolioPricing";

const PORTFOLIO_PLAN_CODE = process.env.PAYSTACK_PORTFOLIO_PLAN_CODE;

// POST — for a portfolio that already exists but never completed its
// first ₦5,000/year charge (checkout was abandoned, failed, or the
// browser closed mid-flow). Starts a fresh checkout for the same
// portfolio rather than creating a duplicate one.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!PORTFOLIO_PLAN_CODE) {
    console.error("PAYSTACK_PORTFOLIO_PLAN_CODE is not set — cannot start portfolio subscription checkout.");
    return NextResponse.json({ error: "Billing isn't configured yet — contact support" }, { status: 500 });
  }

  const { id } = await params;
  const portfolio = await db.portfolio.findUnique({ where: { id } });

  if (!portfolio || portfolio.creatorId !== creator.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (portfolio.billingStatus === "ACTIVE" && portfolio.paystackSubscriptionCode) {
    return NextResponse.json({ error: "This portfolio is already paid and active" }, { status: 400 });
  }

  const reference = `showwork_portfolio_sub_${portfolio.id}_${randomUUID()}`;

  try {
    const result = await initializeSubscription({
      email: creator.email,
      reference,
      callbackUrl: `${appUrl()}/dashboard/portfolio?subscriptionPayment=callback&portfolioId=${portfolio.id}`,
      planCode: PORTFOLIO_PLAN_CODE,
      amount: PORTFOLIO_YEARLY_NGN * 100,
      metadata: { portfolioId: portfolio.id },
    });

    await db.portfolio.update({
      where: { id: portfolio.id },
      data: { pendingSubscriptionRef: reference },
    });

    return NextResponse.json({ authorizationUrl: result.data.authorization_url });
  } catch (err) {
    console.error("Portfolio subscription retry error:", err);
    return NextResponse.json({ error: "Failed to start payment — try again" }, { status: 500 });
  }
}