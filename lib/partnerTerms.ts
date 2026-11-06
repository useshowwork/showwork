/** Existing agreements retain their original terms; new approvals must supply explicit terms. */
export type PartnerTerms = { commissionPercent: number; commissionMonths: number; discountPercent: number; discountMonths: number };
export function parsePartnerTerms(value: unknown): PartnerTerms {
  const input = value as Partial<PartnerTerms> | null;
  if (!input || !Number.isInteger(input.commissionPercent) || input.commissionPercent! < 0 || input.commissionPercent! > 100 ||
      !Number.isInteger(input.commissionMonths) || input.commissionMonths! < 1 || input.commissionMonths! > 120 ||
      !Number.isInteger(input.discountPercent) || input.discountPercent! < 0 || input.discountPercent! > 99 ||
      !Number.isInteger(input.discountMonths) || (input.discountPercent! > 0 ? input.discountMonths! < 1 || input.discountMonths! > 36 : input.discountMonths !== 0)) {
    throw new Error("Enter a commission of 0–100% for 1–120 months, and either no discount or a discount of 1–99% for 1–36 months.");
  }
  return { commissionPercent: input.commissionPercent!, commissionMonths: input.commissionMonths!, discountPercent: input.discountPercent!, discountMonths: input.discountMonths! };
}

export async function recordPartnerReferral(
  tx: import("@prisma/client").Prisma.TransactionClient,
  partner: PartnerTerms & { id: string; creatorId: string },
  creatorId: string,
) {
  const terms = parsePartnerTerms(partner);
  await tx.referral.create({ data: { partnerId: partner.id, referredCreatorId: creatorId, status: "PENDING", ...terms } });
  if (terms.discountPercent === 0) return;
  // One private offer per verified referral; eligibility cannot leak to other customers.
  // The checkout engine snapshots prices and restores them after the agreed cycles.
  await tx.billingOffer.create({ data: {
    title: `Partner referral · ${terms.discountPercent}% for ${terms.discountMonths} months`,
    product: "BOTH", audience: "SELECTED", percent: terms.discountPercent,
    durationMonths: terms.discountMonths, createdBy: partner.creatorId,
    recipients: { create: { creatorId } },
  } });
}
