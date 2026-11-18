import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { billingPaymentDescription } from "@/lib/billingHistory";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return new Response("Sign in to download a receipt.", { status: 401 });
  const { id } = await params;
  if (!/^[\w-]{1,80}$/.test(id)) return new Response("Receipt not found.", { status: 404 });

  const payment = await db.paymentRecord.findFirst({
    where: { id, creatorId: creator.id, revenueStatus: "LIVE", paystackReference: { not: null } },
    select: { paystackReference: true, amountNgn: true, createdAt: true, type: true, tier: true, contentWorkspacePlan: true },
  });
  if (!payment) return new Response("Receipt not found.", { status: 404 });

  const receipt = [
    "Showwork payment receipt",
    "",
    `Reference: ${payment.paystackReference}`,
    `Payment date: ${payment.createdAt.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "long" })}`,
    `Description: ${billingPaymentDescription(payment)}`,
    `Amount paid: ₦${payment.amountNgn.toLocaleString("en-NG")}`,
    "Status: Paid",
    "",
  ].join("\n");
  return new Response(receipt, { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="showwork-receipt-${id}.txt"`,
    "Cache-Control": "private, no-store",
  } });
}
