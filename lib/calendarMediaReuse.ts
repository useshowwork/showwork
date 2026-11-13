import type { CalendarPostData } from "@/components/calendars/CalendarGrid";

type Post = CalendarPostData;
export function mediaDestinationLocked(post: Post) {
  return post.approvalStatus === "APPROVED" || [post.publishStatus, post.instagramPublishStatus, post.tikTokPublishStatus].some(status => status && ["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(status));
}

// Match the calendar's local date grouping, including posts near UTC midnight.
export function sameDayMediaDestinations(source: Post, posts: Post[]) {
  return posts.filter(post => post.id !== source.id && !post.isAiDraft && new Date(post.postDate).toDateString() === new Date(source.postDate).toDateString()).sort((a, b) => new Date(a.postDate).getTime() - new Date(b.postDate).getTime());
}

export async function reusePostMedia({ calendarId, source, destination, fileKeys, replace, canReplace, request, onUpdated }: {
  calendarId: string; source: Post; destination: Post; fileKeys: string[];
  replace: boolean; canReplace: boolean;
  request: (url: string, init: RequestInit) => Promise<Response>;
  onUpdated: (post: Post) => void;
}) {
  if (mediaDestinationLocked(destination)) throw new Error("This post is locked. Request a revision first.");
  if (source.id === destination.id) throw new Error("Choose another post.");
  const assets = source.assets.filter(asset => fileKeys.includes(asset.fileKey));
  if (!assets.length || new Set(fileKeys).size !== new Set(assets.map(asset => asset.fileKey)).size) throw new Error("Choose files that are still on the source post.");
  if (replace && !canReplace) throw new Error("You need edit permission to replace existing media.");
  let current = destination;
  for (const asset of assets) {
    if (current.assets.some(existing => existing.fileKey === asset.fileKey)) continue;
    const response = await request(`/api/calendars/${calendarId}/posts/${destination.id}/attach-asset`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcePostId: source.id, fileKey: asset.fileKey }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to reuse this file.");
    current = { ...data.post, assets: data.post.assets ?? [], videoComments: data.post.videoComments ?? [], customFields: data.post.customFields ?? [] };
    onUpdated(current);
  }
  // Keep existing media until every selected file is attached successfully.
  if (replace) {
    for (const old of destination.assets.filter(asset => !fileKeys.includes(asset.fileKey))) {
      const response = await request(`/api/calendars/${calendarId}/posts/${destination.id}/assets/${old.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "New files were added, but existing media could not be removed.");
      }
      current = { ...current, assets: current.assets.filter(asset => asset.id !== old.id) };
      onUpdated(current);
    }
  }
  return current;
}
