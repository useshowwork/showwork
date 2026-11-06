type RemovalPost = {
  publishStatus?: string | null;
  instagramPublishStatus?: string | null;
  tikTokPublishStatus?: string | null;
  publishWorkerStartedAt?: Date | null;
  tikTokInitStartedAt?: Date | null;
  tikTokPublishId?: string | null;
  platformPostId?: string | null;
  instagramMediaId?: string | null;
};
/** Unsent scheduled rows may be removed only by a reset holding the post locks. */
export function workspaceRemovalBlock(post: RemovalPost, allowUnsentScheduled = false): string | null {
  const states = [post.publishStatus, post.instagramPublishStatus, post.tikTokPublishStatus];
  const scheduled = states.includes("SCHEDULED");
  const settled = states.includes("PUBLISHED");
  const hasAttempt = !!(post.publishWorkerStartedAt || post.tikTokInitStartedAt || post.tikTokPublishId || post.platformPostId || post.instagramMediaId);
  if (states.includes("PUBLISHING")) return "A post is publishing right now. Let it finish, then try resetting again. If it stays stuck, open the post’s Publishing tab and check its status.";
  if (hasAttempt && (!settled || scheduled)) return "A post has an unfinished publishing attempt. Open its Publishing tab and confirm the result on the social platform before resetting.";
  if (scheduled && !allowUnsentScheduled) return "This content is scheduled. Cancel its schedule in the post’s Publishing tab before removing it.";
  return null;
}
