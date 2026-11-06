import { workspaceRemovalBlock } from "@/lib/publishing/removalGuard";
import { db } from "@/lib/db";
import { postContentEditError } from "@/lib/publishing/editGuard";
import {
  assertWorkspacePostsNotPublishing,
  queueWorkspaceStorageCleanup,
  WorkspaceDeletionConflict,
} from "@/lib/workspaceStorageCleanup";

export { WorkspaceDeletionConflict };
/** API authorization remains at the entrypoint. Never perform storage I/O inside this transaction. */
export async function removeWorkspaceContent(input: {
  calendarId: string;
  actorId: string;
  mode: "asset" | "document" | "post" | "reset" | "workspace";
  postId?: string;
  assetId?: string;
  documentId?: string;
  removeBlocked?: boolean;
}) {
  return db.$transaction(
    async (tx) => {
      const { calendarId, mode } = input;
      await tx.$queryRaw`SELECT id FROM "SocialCalendar" WHERE id=${calendarId} FOR UPDATE`;
      const calendar = await tx.socialCalendar.findUnique({
        where: { id: calendarId },
        select: {
          managerId: true,
          headerBannerDesktopUrl: true,
          headerBannerMobileUrl: true,
        },
      });
      if (!calendar) return { ok: true, deletedCount: 0, cleanupQueued: true };
      if (
        (mode === "workspace" || mode === "reset") &&
        calendar.managerId !== input.actorId
      ) {
        throw new WorkspaceDeletionConflict(
          "Only the current workspace owner can perform this action.",
        );
      }
      if (mode !== "document") {
        if (input.postId)
          await tx.$queryRaw`SELECT id FROM "CalendarPost" WHERE id=${input.postId} AND "calendarId"=${calendarId} FOR UPDATE`;
        else
          await tx.$queryRaw`SELECT id FROM "CalendarPost" WHERE "calendarId"=${calendarId} ORDER BY id FOR UPDATE`;
        // Post row locks above serialize reset with worker claims. Unsent queued
        // posts can be deleted atomically; active/unknown attempts still block.
        if (!input.removeBlocked) await assertWorkspacePostsNotPublishing(tx, calendarId, input.postId, mode === "reset", mode === "reset");
        else if (calendar.managerId !== input.actorId || !["post", "reset"].includes(mode)) throw new WorkspaceDeletionConflict("Only the workspace owner can remove protected posts.");
      }
      const candidates: { fileKey: string; bytes: bigint }[] = [];
      let deletedCount = 0;
      if (mode === "asset") {
        const asset = await tx.calendarPostAsset.findFirst({
          where: {
            id: input.assetId,
            postId: input.postId,
            post: { calendarId },
          },
        });
        if (!asset) return { ok: true, deletedCount: 0, cleanupQueued: true };
        const guard = await postContentEditError(input.postId!, calendarId, tx);
        if (guard) throw new WorkspaceDeletionConflict(guard);
        candidates.push({ fileKey: asset.fileKey, bytes: asset.sizeBytes });
        await tx.calendarPostAsset.delete({ where: { id: asset.id } });
        deletedCount = 1;
      } else if (mode === "document") {
        const document = await tx.calendarBusinessDocument.findFirst({
          where: { id: input.documentId, calendarId },
        });
        if (!document)
          return { ok: true, deletedCount: 0, cleanupQueued: true };
        if (document.fileKey)
          candidates.push({
            fileKey: document.fileKey,
            bytes: document.sizeBytes,
          });
        await tx.calendarBusinessDocument.delete({
          where: { id: document.id },
        });
        await tx.socialCalendar.update({
          where: { id: calendarId },
          data: {
            aiBusinessSummary: null,
            aiBusinessSummarySourceHash: null,
            aiBusinessSummaryUpdatedAt: null,
          },
        });
        deletedCount = 1;
      } else {
        if (mode === "post") {
          const post = await tx.calendarPost.findFirst({
            where: { id: input.postId, calendarId },
          });
          if (!post) return { ok: true, deletedCount: 0, cleanupQueued: true };
          if (post.approvalStatus === "APPROVED" && !input.removeBlocked)
            throw new WorkspaceDeletionConflict(
              "This post has been approved by the client and can no longer be deleted.",
            );
        }
        // Keep live-operation evidence and media until the provider outcome is known.
        // The deletedAt marker removes these rows from all calendar views and new sends.
        const retaining = ["reset", "post"].includes(mode) ? (await tx.calendarPost.findMany({ where: { calendarId, ...(input.postId ? { id: input.postId } : {}) } })).filter(post => (input.removeBlocked || post.deletedAt) && workspaceRemovalBlock(post, true)) : [];
        const retainedIds = retaining.map(post => post.id);
        const newlyRetainedCount = retaining.filter(post => !post.deletedAt).length;
        if (retainedIds.length) await tx.calendarPost.updateMany({ where: { calendarId, id: { in: retainedIds }, deletedAt: null }, data: { deletedAt: new Date() } });
        const removable = { calendarId, ...(input.postId ? { id: input.postId } : {}), ...(retainedIds.length ? { id: input.postId ? { equals: input.postId, notIn: retainedIds } : { notIn: retainedIds } } : {}) };
        const assets = await tx.calendarPostAsset.findMany({
          where: {
            post: removable,
          },
          select: { fileKey: true, sizeBytes: true },
        });
        candidates.push(
          ...assets.map((a) => ({ fileKey: a.fileKey, bytes: a.sizeBytes })),
        );
        const receipts = await tx.contentWorkspaceStorageReservation.findMany({
          where: {
            calendarId,
            ...(mode === "workspace"
              ? {}
              : input.postId
                ? {
                    fileKey: {
                      startsWith: `calendars/${calendarId}/${input.postId}/`,
                    },
                  }
                : {
                    NOT: [
                      {
                        fileKey: {
                          startsWith: `calendars/${calendarId}/business-documents/`,
                        },
                      },
                      {
                        fileKey: {
                          startsWith: `calendars/${calendarId}/banner-`,
                        },
                      },
                    ],
                  }),
          },
          select: { fileKey: true },
        });
        const retainedPrefixes = retainedIds.map(id => `calendars/${calendarId}/${id}/`);
        candidates.push(
          ...receipts.filter(r => !retainedPrefixes.some(prefix => r.fileKey.startsWith(prefix))).map((r) => ({ fileKey: r.fileKey, bytes: BigInt(0) })),
        );
        if (mode === "workspace") {
          const docs = await tx.calendarBusinessDocument.findMany({
            where: { calendarId },
            select: { fileKey: true, sizeBytes: true },
          });
          candidates.push(
            ...docs
              .filter((d) => d.fileKey)
              .map((d) => ({ fileKey: d.fileKey!, bytes: d.sizeBytes })),
          );
          for (const key of [
            calendar.headerBannerDesktopUrl,
            calendar.headerBannerMobileUrl,
          ])
            if (key) candidates.push({ fileKey: key, bytes: BigInt(0) });
          // Persist receipt sizes/expiry and release pending reservations BEFORE cascading them away.
          await queueWorkspaceStorageCleanup(
            tx,
            calendar.managerId,
            calendarId,
            candidates,
          );
          deletedCount = await tx.calendarPost.count({ where: { calendarId } });
          await tx.socialCalendar.delete({ where: { id: calendarId } });
        } else {
          const removed = await tx.calendarPost.deleteMany({
            where: removable,
          });
          deletedCount = removed.count + newlyRetainedCount;
          if (mode === "reset") {
            await tx.calendarImport.deleteMany({ where: { calendarId } });
            await tx.socialCalendar.update({
              where: { id: calendarId },
              data: {
                planStatus: "BUILDING",
                planSubmittedAt: null,
                planApprovedAt: null,
                planApprovalNote: null,
              },
            });
          }
        }
      }
      await queueWorkspaceStorageCleanup(
        tx,
        calendar.managerId,
        calendarId,
        candidates,
      );
      return { ok: true, deletedCount, cleanupQueued: true };
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
