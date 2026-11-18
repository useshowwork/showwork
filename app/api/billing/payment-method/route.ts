import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { getSubscriptionCard, getSubscriptionManagementLink } from "@/lib/paystack";

async function paymentMethod(request: Request) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to manage payment methods." }, { status: 401 });

  const product = new URL(request.url).searchParams.get("product");
  const workspaceMatches = !!creator.contentWorkspacePlan &&
    (product === "engage" ? creator.contentWorkspacePlan === "ENGAGE" :
      product === "content-workspace" && creator.contentWorkspacePlan !== "ENGAGE");

  const code = product === "delivery" && (creator.subscriptionActive || creator.subscriptionTier !== "FREE") ? creator.paystackSubscriptionCode :
    workspaceMatches ? creator.contentWorkspacePaystackSubscriptionCode : null;
  if (!code) {
    return request.method === "POST"
      ? NextResponse.json({ error: "There is no payment method to update for this product." }, { status: 404 })
      : NextResponse.json({ card: null, canUpdate: false });
  }

  try {
    if (request.method === "POST") {
      if (request.headers.get("content-type") !== "application/json") {
        return NextResponse.json({ error: "Invalid request." }, { status: 415 });
      }
      return NextResponse.json({ url: await getSubscriptionManagementLink(code) });
    }
    return NextResponse.json({ card: await getSubscriptionCard(code), canUpdate: true });
  } catch {
    return NextResponse.json({ error: "Paystack is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}

export { paymentMethod as GET, paymentMethod as POST };
