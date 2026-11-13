import { internalReviewError } from "./calendarInternalReview";

type ReviewPost = {
  id: string; approvalStatus: string; isAiDraft?: boolean;
  internalReviewStatus?: string; internalReviewVersion?: number; internalReviewNote?: string | null;
  platform?: string; caption?: string | null; assets?: readonly unknown[];
  publishStatus?: string; instagramPublishStatus?: string; tikTokPublishStatus?: string;
};
export function canBulkApproveInternal(post: ReviewPost) {
  return post.internalReviewStatus !== "APPROVED" && !internalReviewError(post, "APPROVED");
}
export function canBulkApproveClient(post: ReviewPost) {
  return ["PENDING", "NEEDS_REVISION"].includes(post.approvalStatus) && !post.isAiDraft
    && (post.internalReviewStatus === undefined || post.internalReviewStatus === "APPROVED")
    && ![post.publishStatus, post.instagramPublishStatus, post.tikTokPublishStatus].some(status => status && ["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(status))
    && (!!post.assets?.length || (["FACEBOOK", "LINKEDIN", "X"].includes(post.platform ?? "") && !!post.caption?.trim()));
}

export async function approveCalendarPosts<T extends ReviewPost>({ posts, mode, calendarKey, request, onUpdated, onProgress }: {
  posts: readonly T[]; mode: "internal" | "client"; calendarKey: string;
  request: (url: string, init: RequestInit) => Promise<Response>;
  onUpdated: (post: T) => void;
  onProgress?: (completed: number, total: number) => void;
}) {
  // Snapshot the intended set: posts added while this runs are never approved implicitly.
  const targets = posts.filter(mode === "internal" ? canBulkApproveInternal : canBulkApproveClient);
  const failures: { id: string; message: string }[] = [];
  let approved = 0, completed = 0, cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const post = targets[cursor++];
      try {
        const url = mode === "internal"
          ? `/api/calendars/${encodeURIComponent(calendarKey)}/posts/${encodeURIComponent(post.id)}/internal-review`
          : `/api/social-calendar/${encodeURIComponent(calendarKey)}/posts/${encodeURIComponent(post.id)}/review`;
        const body = mode === "internal" ? { action: "approve", version: post.internalReviewVersion ?? 0, note: post.internalReviewNote ?? null } : { action: "approve" };
        const response = await request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok || !data.post) throw new Error(data.error || "Approval could not be confirmed. Refresh and retry.");
        onUpdated(data.post);
        approved++;
      } catch (error) {
        failures.push({ id: post.id, message: error instanceof Error ? error.message : "Unable to approve this post." });
      }
      onProgress?.(++completed, targets.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
  return { approved, failures, total: targets.length };
}
