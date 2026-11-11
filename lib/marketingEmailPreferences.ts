import { createHmac, timingSafeEqual } from "node:crypto";

/** Purpose-bound signature; grants only the right to stop promotional emails. */
export function marketingUnsubscribeToken(creatorId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for marketing email preferences.");
  return createHmac("sha256", secret)
    .update(JSON.stringify(["showwork-marketing-unsubscribe-v1", creatorId, email]))
    .digest("hex");
}

export function validMarketingUnsubscribeToken(creatorId: string, email: string, token: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = marketingUnsubscribeToken(creatorId, email);
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}
