import { db } from "@/lib/db";
import { fetchPartnerPaymentIssue } from "@/lib/paystack";

export function issueImpact(issues: { id?: string; kind: string; relatedIssueId?: string | null; state: string; amountKobo: number }[], paymentNgn: number, commissionNgn: number) {
  const refunds = issues.filter(i=>i.kind === "refund" && i.state === "LOSS").reduce((n,i)=>n+i.amountKobo,0);
  const disputes = issues.filter(i=>i.kind === "dispute" && i.state === "LOSS").reduce((n,i)=> {
    const linkedRefunds = issues.filter(r=>r.kind === "refund" && r.state === "LOSS" && r.relatedIssueId === i.id).reduce((sum,r)=>sum+r.amountKobo,0);
    return n + Math.max(0, i.amountKobo - linkedRefunds);
  },0);
  const loss = Math.min(paymentNgn * 100, refunds + disputes);
  return { onHold: issues.some(i=>i.state === "HOLD"), reversedAmountNgn: Math.min(commissionNgn, Math.ceil(commissionNgn * loss / (paymentNgn * 100))) };
}
export async function reconcilePartnerIssues(tx: import("@prisma/client").Prisma.TransactionClient, reference: string) {
  const payment = await tx.paymentRecord.findUnique({ where: { paystackReference: reference } });
  if (!payment || payment.revenueStatus !== "LIVE") return;
  const commission = await tx.referralCommission.findUnique({ where: { paymentRecordId: payment.id }, include: { payoutAllocation: { include: { payout: true } } } });
  if (!commission) return;
  const issues = await tx.partnerPaymentIssue.findMany({ where: { reference } });
  const impact = issueImpact(issues, commission.paymentAmountNgn, commission.commissionAmountNgn);
  // Never silently restore a financially settled reversal; a correction requires reconciliation.
  impact.reversedAmountNgn = Math.max(impact.reversedAmountNgn, commission.reversedAmountNgn);
  if (commission.onHold === impact.onHold && commission.reversedAmountNgn === impact.reversedAmountNgn) return;
  const allocation = commission.payoutAllocation;
  if (allocation && ["PENDING", "APPROVED"].includes(allocation.payout.status)) {
    await tx.partnerPayout.update({ where: { id: allocation.payoutId }, data: { status: "REJECTED", adminNote: "Automatically cancelled: referred payment changed. Resolve payment review and request a new payout." } });
    await tx.partnerPayoutCommission.deleteMany({ where: { payoutId: allocation.payoutId } });
    await tx.partnerAuditEvent.create({ data: { actorId: "paystack", targetId: allocation.payoutId, action: "PAYOUT_CANCELLED_PAYMENT_REVIEW", detail: { reference } } });
  }
  await tx.referralCommission.update({ where: { id: commission.id }, data: impact });
  await tx.partnerAuditEvent.create({ data: { actorId: "paystack", targetId: commission.id, action: "COMMISSION_PAYMENT_RECONCILED", detail: { reference, ...impact, recoveryRequired: commission.status === "PAID" && impact.reversedAmountNgn > commission.recoverySettledNgn } } });
}
export async function syncPartnerPaymentIssue(kind: "refund" | "dispute", id: string) {
  const data = await fetchPartnerPaymentIssue(kind, id);
  const transaction = data.transaction;
  const reference = transaction?.reference ?? data.transaction_reference ?? data.merchant_transaction_reference;
  if (typeof reference !== "string" || !reference) throw new Error("Provider payment issue has no transaction reference");
  if ((data.domain ?? transaction?.domain) !== "live" || (data.currency ?? transaction?.currency) !== "NGN") return;
  let state = "HOLD";
  let amountKobo = 0;
  if (kind === "refund") {
    if (data.status === "processed") { state = "LOSS"; amountKobo = Number(data.amount); }
    else if (data.status === "failed") state = "CLEAR";
  } else if (data.status === "resolved" && data.resolution === "merchant-accepted") {
    state = "LOSS"; amountKobo = Number(data.refund_amount);
  }
  // Declined disputes can still await a bank decision. Keep on hold until reviewed by admin.
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 0 || (state === "LOSS" && amountKobo === 0)) throw new Error("Invalid provider reversal amount");
  await db.$transaction(async tx => {
    const existing = await tx.partnerPaymentIssue.findUnique({ where: { id: `${kind}:${id}` } });
    if (kind === "dispute" && data.status === "resolved" && data.resolution === "declined" && existing?.state === "CLEAR") state = "CLEAR";
    if (existing && existing.reference !== reference) throw new Error("Provider issue transaction changed");
    if (existing?.state === "LOSS") { state = "LOSS"; amountKobo = Math.max(existing.amountKobo, amountKobo); }
    const relatedIssueId = kind === "refund" && data.dispute ? `dispute:${typeof data.dispute === "object" ? data.dispute.id : data.dispute}` : null;
    await tx.partnerPaymentIssue.upsert({ where: { id: `${kind}:${id}` }, create: { id: `${kind}:${id}`, reference, kind, state, amountKobo, relatedIssueId }, update: { state, amountKobo, relatedIssueId } });
    await reconcilePartnerIssues(tx, reference);
  }, { isolationLevel: "Serializable" });
}
