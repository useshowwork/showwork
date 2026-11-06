import type { CalendarPost, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { publishingStatus } from "./state";
/** Approved content must stay identical to the content the client reviewed. */
export async function postContentEditError(postId: string, calendarId: string, client: Pick<Prisma.TransactionClient, "calendarPost"> = db) {
  const post = await client.calendarPost.findFirst({ where: { id: postId, calendarId } });
  return postContentEditErrorFromState(post);
}

/** Reuse a freshly fetched/locked row; never cache approval or publishing state. */
export function postContentEditErrorFromState(post: Pick<CalendarPost, "deletedAt" | "approvalStatus" | "platform" | "instagramPublishStatus" | "tikTokPublishStatus" | "publishStatus" | "tikTokPublishId" | "platformPostId"> | null) {
  if (!post || post.deletedAt) return "Post not found in this workspace.";
  if (post.approvalStatus === "APPROVED" || ["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(publishingStatus(post))) return "This post is approved or publishing. Request a revision before changing its content.";
  if (post.tikTokPublishId || post.platformPostId) return "This post already has a platform operation in progress. Reconcile it before changing content, or create a new post.";
  return null;
}
