import { createHmac, timingSafeEqual } from "node:crypto";

export function uploadNoticeBatchId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function signature(calendarId: string, actorId: string, batchId: string, postId: string, expiresAt: number) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(JSON.stringify(["calendar-upload-notice", calendarId, actorId, batchId, postId, expiresAt])).digest("hex");
}

export function uploadNoticeReceipt(calendarId: string, actorId: string, batchId: string, postId: string) {
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const proof = signature(calendarId, actorId, batchId, postId, expiresAt);
  return proof ? { postId, expiresAt, proof } : undefined;
}

export function verifiedUploadNoticePosts(calendarId: string, actorId: string, batchId: string, receipts: unknown) {
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > 50) return null;
  const posts = new Set<string>();
  for (const receipt of receipts) {
    if (!receipt || typeof receipt.postId !== "string" || receipt.postId.length > 90 ||
        typeof receipt.expiresAt !== "number" || receipt.expiresAt <= Date.now() ||
        typeof receipt.proof !== "string" || !/^[0-9a-f]{64}$/.test(receipt.proof)) return null;
    const expected = signature(calendarId, actorId, batchId, receipt.postId, receipt.expiresAt);
    if (!expected || !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(receipt.proof, "hex"))) return null;
    posts.add(receipt.postId);
  }
  return [...posts];
}
