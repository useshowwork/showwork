import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { initializeSubscription } from "@/lib/paystack";
import { appUrl } from "@/lib/url";
import { PORTFOLIO_YEARLY_NGN } from "@/lib/portfolioPricing";

const PORTFOLIO_PLAN_CODE = process.env.PAYSTACK_PORTFOLIO_PLAN_CODE;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlugFor(base: string): Promise<string> {
  let candidate = base || "portfolio";
  let suffix = 0;
  while (true) {
    const existing = await db.portfolio.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// POST — an agency creates a new client portfolio. The row is created
// immediately in a PENDING_SETUP state, then a single ₦5,000/year
// subscription checkout is started right away — no separate one-time
// fee. The portfolio only becomes usable once that first charge is
// confirmed (via the webhook, or the direct verify-subscription
// fallback for local development).
export async function POST(req: NextRequest) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (creator.accountType !== "AGENCY") {
    return NextResponse.json(
      { error: "Only agency accounts can create additional client portfolios" },
      { status: 403 }
    );
  }

  if (!PORTFOLIO_PLAN_CODE) {
    console.error("PAYSTACK_PORTFOLIO_PLAN_CODE is not set — cannot start portfolio subscription checkout.");
    return NextResponse.json({ error: "Billing isn't configured yet — contact support" }, { status: 500 });
  }

  const { companyName } = await req.json();
  if (!companyName || !companyName.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  const slug = await uniqueSlugFor(slugify(companyName));

  const portfolio = await db.portfolio.create({
    data: {
      creatorId: creator.id,
      companyName: companyName.trim(),
      slug,
      billingStatus: "PENDING_SETUP",
    },
  });

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

    return NextResponse.json({ authorizationUrl: result.data.authorization_url, portfolioId: portfolio.id });
  } catch (err) {
    console.error("Portfolio subscription initialize error:", err);
    // The portfolio row is left in place, still PENDING_SETUP with no
    // reference attached — the agency can retry from the list.
    return NextResponse.json({ error: "Failed to start payment — try again" }, { status: 500 });
  }
}