export function effectiveReferralStatus(row: { status: string; commissionEndsAt: Date | string | null }, now = new Date()) {
  return row.status === "ACTIVE" && row.commissionEndsAt && new Date(row.commissionEndsAt) <= now ? "EXPIRED" : row.status;
}
