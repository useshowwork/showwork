/** Refresh server snapshots; local text edits live in the editor and reconcile separately. */
export function mergeDraftSnapshots<
  T extends { id: string; updatedAt?: string },
>(current: T[], incoming: T[], removed = new Set<string>()): T[] {
  const byId = new Map(
    incoming.filter((row) => !removed.has(row.id)).map((row) => [row.id, row]),
  );
  return [
    ...current
      .filter((row) => byId.has(row.id))
      .map((row) => {
        const next = byId.get(row.id)!;
        byId.delete(row.id);
        return row.updatedAt &&
          next.updatedAt &&
          new Date(row.updatedAt) > new Date(next.updatedAt)
          ? row
          : { ...row, ...next };
      }),
    ...byId.values(),
  ];
}
export function draftTitle(post: {
  creativeBrief?: { title?: string } | null;
  caption?: string | null;
  hook?: string | null;
  contentIdea?: string | null;
  postType?: string | null;
}) {
  const title = post.creativeBrief?.title?.trim();
  if (
    title &&
    title !== post.postType &&
    ![
      "Content",
      "Reel",
      "Carousel",
      "Video",
      "Story",
      "Static graphic",
      "Text post",
    ].includes(title)
  )
    return title;
  return (post.hook || post.caption || post.contentIdea || "Untitled post")
    .split("\n")[0]
    .slice(0, 100);
}
/** Bounded parallel confirmation preserves successful work when another request fails. */
export async function reviewDraftBatch(
  ids: string[],
  confirm: (id: string) => Promise<void>,
  onConfirmed: (id: string) => void,
  concurrency = 4,
) {
  let cursor = 0;
  const failures: { id: string; message: string }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        try {
          await confirm(id);
          onConfirmed(id);
        } catch (error) {
          failures.push({
            id,
            message:
              error instanceof Error
                ? error.message
                : "Could not review this post",
          });
        }
      }
    }),
  );
  return failures;
}
