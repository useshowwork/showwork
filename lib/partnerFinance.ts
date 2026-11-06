import type { Prisma } from "@prisma/client";
export function netCommission(row: { commissionAmountNgn: number; reversedAmountNgn?: number }) {
  return Math.max(0, row.commissionAmountNgn - (row.reversedAmountNgn ?? 0));
}
export function outstandingRecovery(row: { status: string; reversedAmountNgn?: number; recoverySettledNgn?: number }) {
  return row.status === "PAID" ? Math.max(0, (row.reversedAmountNgn ?? 0) - (row.recoverySettledNgn ?? 0)) : 0;
}
export async function assertPartnerPayable(tx: Prisma.TransactionClient, partnerId: string) {
  const rows = await tx.referralCommission.findMany({ where: { referral: { partnerId } }, select: { status: true, onHold: true, reversedAmountNgn: true, recoverySettledNgn: true } });
  if (rows.some(row => row.onHold)) throw new Error("A referred payment is under review. Resolve it before processing payouts.");
  if (rows.some(row => outstandingRecovery(row) > 0)) throw new Error("A refunded commission needs recovery reconciliation before another payout.");
}
export async function reviewPartnerPayout(tx: Prisma.TransactionClient, id: string, action: "APPROVE" | "REJECT" | "MARK_PAID", actorId: string, note: string, reference: string) {
  const row = await tx.partnerPayout.findUnique({ where: { id }, include: { payoutCommissions: { include: { commission: true } } } });
  if (!row) throw new Error("Payout not found.");
  const expected = action === "REJECT" && row.status === "APPROVED" ? "APPROVED" : action === "MARK_PAID" ? "APPROVED" : "PENDING";
  if (row.paidAt || row.status !== expected) throw new Error(`Only ${expected.toLowerCase()} payouts can receive this action. Paid payouts are final.`);
  if (action !== "REJECT") {
    if (!row.accountVerifiedAt || !row.accountNumber || !row.bankCode || !row.accountName) throw new Error("This payout has no verified bank snapshot. Reject a pending request and ask the partner to verify their account and request again.");
    const partner = await tx.partnerProfile.findUnique({ where: { id: row.partnerId }, select: { status: true } });
    if (partner?.status !== "ACTIVE") throw new Error("Resume this partner before processing a payout.");
    await assertPartnerPayable(tx, row.partnerId);
    if (!row.payoutCommissions.length || row.payoutCommissions.some(a => a.commission.status !== "APPROVED" || a.commission.onHold || a.amountNgn !== netCommission(a.commission)) || row.payoutCommissions.reduce((n,a)=>n+a.amountNgn,0) !== row.amountNgn) throw new Error("Payout allocations no longer match approved earnings.");
  }
  if (action === "MARK_PAID" && !reference) throw new Error("A bank transfer reference is required.");
  const status = action === "MARK_PAID" ? "PAID" : action === "APPROVE" ? "APPROVED" : "REJECTED";
  const now = new Date();
  const changed = await tx.partnerPayout.updateMany({ where: { id, status: expected }, data: { status, ...(note ? { adminNote: note } : {}), ...(status === "PAID" ? { paidAt: now, payoutReference: reference } : status === "APPROVED" ? { approvedAt: now } : {}) } });
  if (changed.count !== 1) throw new Error("Payout changed during review. Refresh and retry.");
  if (action === "REJECT") await tx.partnerPayoutCommission.deleteMany({ where: { payoutId: id } });
  if (action === "MARK_PAID") {
    const paid = await tx.referralCommission.updateMany({ where: { id: { in: row.payoutCommissions.map(a=>a.commissionId) }, status: "APPROVED", onHold: false }, data: { status: "PAID", paidAt: now, payoutReference: reference } });
    if (paid.count !== row.payoutCommissions.length) throw new Error("Commission changed during settlement. Refresh and retry.");
  }
  await tx.partnerAuditEvent.create({ data: { actorId, targetId: id, action: `PAYOUT_${action}`, detail: { from: expected, to: status, note, reference } } });
  return tx.partnerPayout.findUniqueOrThrow({ where: { id } });
}
