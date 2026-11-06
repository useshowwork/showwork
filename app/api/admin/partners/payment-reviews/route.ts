import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";
import { syncPartnerPaymentIssue, reconcilePartnerIssues } from "@/lib/partnerPaymentIssues";
import { fetchPartnerPaymentIssue } from "@/lib/paystack";
async function admin() { const user = await getCurrentCreator(); return user && isAdminEmail(user.email) ? user : null; }
export async function GET() {
  if (!await admin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [issues, recoveries] = await Promise.all([
    db.partnerPaymentIssue.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    db.referralCommission.findMany({ where: { status: "PAID", reversedAmountNgn: { gt: 0 } }, include: { referral: { include: { partner: { include: { creator: { select: { name: true, email: true } } } } } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({ issues, recoveries: recoveries.filter(row=>row.reversedAmountNgn > row.recoverySettledNgn) });
}
export async function POST(req: Request) {
  const user = await admin(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    if (body.action === "SYNC" && ["refund", "dispute"].includes(body.kind)) {
      await syncPartnerPaymentIssue(body.kind, String(body.id)); return NextResponse.json({ ok: true });
    }
    if (body.action === "CLEAR_DISPUTE") {
      if (typeof body.reason !== "string" || body.reason.trim().length < 10) throw new Error("Record the bank outcome and supporting reference (at least 10 characters).");
      const data = await fetchPartnerPaymentIssue("dispute", String(body.id));
      if (data.status !== "resolved" || data.resolution !== "declined" || (data.domain ?? data.transaction?.domain) !== "live") throw new Error("Only a provider-resolved, declined live dispute can be cleared after confirming the bank outcome.");
      await db.$transaction(async tx => {
        const row = await tx.partnerPaymentIssue.findUniqueOrThrow({ where: { id: `dispute:${body.id}` } });
        if (row.state !== "HOLD") throw new Error("This issue is no longer on hold.");
        await tx.partnerPaymentIssue.update({ where: { id: row.id }, data: { state: "CLEAR" } });
        await reconcilePartnerIssues(tx, row.reference);
        await tx.partnerAuditEvent.create({ data: { actorId: user.id, targetId: row.id, action: "DISPUTE_CLEARED_AFTER_BANK_REVIEW", detail: { reason: body.reason.trim() } } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "RECORD_RECOVERY") {
      if (typeof body.reference !== "string" || body.reference.trim().length < 4 || body.reference.length > 200 || !Number.isSafeInteger(body.amountNgn) || body.amountNgn < 1) throw new Error("Enter the recovered amount and actual transfer reference.");
      await db.$transaction(async tx => {
        const row = await tx.referralCommission.findUniqueOrThrow({ where: { id: body.commissionId } });
        if (row.status !== "PAID" || body.amountNgn > row.reversedAmountNgn - row.recoverySettledNgn) throw new Error("Recovery exceeds the outstanding paid commission reversal.");
        const duplicate = await tx.partnerAuditEvent.findFirst({ where: { action: "RECOVERY_RECEIVED", detail: { path: ["reference"], equals: body.reference.trim() } } });
        if (duplicate) throw new Error("This recovery reference was already recorded.");
        await tx.referralCommission.update({ where: { id: row.id }, data: { recoverySettledNgn: { increment: body.amountNgn } } });
        await tx.partnerAuditEvent.create({ data: { actorId: user.id, targetId: row.id, action: "RECOVERY_RECEIVED", detail: { amountNgn: body.amountNgn, reference: body.reference.trim() } } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: ["P2034", "P2002"].includes((error as { code?: string }).code ?? "") ? "Financial record changed. Refresh and retry." : (error as Error).message }, { status: 409 }); }
}
