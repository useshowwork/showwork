import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { offerQuote } from "@/lib/billingOffers";
import { PAID_TIER_ORDER } from "@/lib/subscriptionTiers";
export async function GET(req: NextRequest) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const product = req.nextUrl.searchParams.get("product");
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  const cycle = req.nextUrl.searchParams.get("cycle");
  if ((product !== "DELIVERY" && product !== "CONTENT_WORKSPACE") || (cycle !== "MONTHLY" && cycle !== "ANNUAL") ||
    !(product === "DELIVERY" ? PAID_TIER_ORDER : ["CREATOR", "GROWTH", "STUDIO", "UNLIMITED"]).includes(plan as any)) return NextResponse.json({ error: "Invalid subscription selection" }, { status: 400 });
  try {
    const quote = await offerQuote(creator.id, product, plan, cycle);
    return NextResponse.json({ product, plan, cycle, standardPriceNgn: quote.standardPriceNgn, amountNgn: quote.discountedPriceNgn,
      offer: quote.offer ? { id: quote.offer.id, title: quote.offer.title, percent: quote.offer.percent, durationMonths: quote.offer.durationMonths,
        remainingCycles: quote.remainingCycles, discountEndsAt: quote.discountEndsAt } : null });
  } catch (error) {
    console.error("Billing quote failed", error);
    return NextResponse.json({ error: "Could not confirm your price. Please try again." }, { status: 503 });
  }
}
