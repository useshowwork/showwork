import { workspaceRemovalBlock } from "@/lib/publishing/removalGuard";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { workspaceVideoPosterKey } from "@/lib/workspaceVideoPosterKey";
import { deleteObject } from "@/lib/r2";
import { publishingRetentionRequired } from "@/lib/publishing/applicationBoundary";

type Tx = Prisma.TransactionClient;
type Candidate = { fileKey: string; bytes: bigint };
type Job = {
  id: string;
  fileKey: string;
  creatorId: string;
  calendarId: string;
  bytes: bigint;
  state: string;
  notBefore: Date;
  usageReleasedAt: Date | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
};
export type BlockingCalendarPost = { id: string; title: string; platform: string; postDate: string; reason: string };
export class WorkspaceDeletionConflict extends Error {
  constructor(message: string, public readonly blockingPosts: BlockingCalendarPost[] = []) { super(message); }
}

export async function lockWorkspaceFileKeys(tx: Tx, keys: string[]) {
  const sorted = [...new Set(keys)].sort();
  if (!sorted.length) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('workspace-file:' || key, 0))::text
    FROM (SELECT unnest(${sorted}::text[]) AS key ORDER BY 1) ordered_keys`;
}

/** Reference creation and orphan cleanup serialize on the same object key. */
export async function assertWorkspaceFileAttachable(tx: Tx, fileKey: string) {
  await lockWorkspaceFileKeys(tx, [fileKey]);
  const jobs = await tx.$queryRaw<
    Job[]
  >`SELECT * FROM "WorkspaceStorageCleanup" WHERE "fileKey"=${fileKey} FOR UPDATE`;
  if (jobs[0] && (jobs[0].usageReleasedAt || jobs[0].state !== "PENDING")) {
    throw new WorkspaceDeletionConflict(
      "This file was removed. Upload it again rather than reattaching its old reference.",
    );
  }
}

async function publishingPinnedKeys(tx: Tx, keys: string[]) {
  if (!keys.length) return new Set<string>();
  if (publishingRetentionRequired()) return new Set(keys);
  const tables = await tx.$queryRaw<
    { name: string | null }[]
  >`SELECT to_regclass('"PublishingMediaSnapshot"')::text AS name`;
  if (!tables[0]?.name) return new Set<string>();
  const pins = await tx.$queryRaw<
    { sourceKey: string; blobKey: string }[]
  >`SELECT "sourceKey","blobKey" FROM "PublishingMediaSnapshot"
    WHERE "sourceKey"=ANY(${keys}::text[]) OR "blobKey"=ANY(${keys}::text[])`;
  return new Set(pins.flatMap((pin) => [pin.sourceKey, pin.blobKey]));
}

async function referenced(tx: Tx, key: string) {
  const rows = await tx.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM "CalendarPostAsset" WHERE "fileKey"=${key})
      OR EXISTS(SELECT 1 FROM "CalendarBusinessDocument" WHERE "fileKey"=${key})
      OR EXISTS(SELECT 1 FROM "SocialCalendar" WHERE "headerBannerDesktopUrl"=${key} OR "headerBannerMobileUrl"=${key}) AS present`;
  // Installed retention policy remains authoritative; do not bypass publishing evidence.
  return rows[0].present || (await publishingPinnedKeys(tx, [key])).has(key);
}

async function releaseUsage(tx: Tx, job: Job) {
  if (job.usageReleasedAt || (await referenced(tx, job.fileKey))) return false;
  if (job.bytes > BigInt(0)) {
    const changed = await tx.contentWorkspaceUsage.updateMany({
      where: { creatorId: job.creatorId, storageBytes: { gte: job.bytes } },
      data: { storageBytes: { decrement: job.bytes } },
    });
    if (changed.count !== 1)
      throw new WorkspaceDeletionConflict(
        "Storage accounting needs reconciliation. Nothing was removed; please retry or contact support.",
      );
  }
  await tx.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET "usageReleasedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=${job.id}`;
  return true;
}

/** Call in the SAME transaction, after removing references, before losing their byte metadata. */
export async function queueWorkspaceStorageCleanup(
  tx: Tx,
  ownerId: string,
  calendarId: string,
  candidates: Candidate[],
) {
  const unique = new Map<string, bigint>();
  for (const item of candidates) {
    if (!item.fileKey?.startsWith("calendars/")) continue;
    unique.set(
      item.fileKey,
      item.bytes > (unique.get(item.fileKey) ?? BigInt(0))
        ? item.bytes
        : (unique.get(item.fileKey) ?? BigInt(0)),
    );
  }
  const keys = [...unique.keys()].sort();
  if (!keys.length) return;
  await lockWorkspaceFileKeys(tx, keys);
  const receipts = await tx.$queryRaw<
    {
      id: string;
      fileKey: string;
      bytes: bigint;
      status: string;
      expiresAt: Date;
    }[]
  >`
    SELECT id,"fileKey",bytes,status,"expiresAt" FROM "ContentWorkspaceStorageReservation"
    WHERE "fileKey"=ANY(${keys}::text[]) AND "creatorId"=${ownerId} ORDER BY id FOR UPDATE`;
  const pending = receipts
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.bytes, BigInt(0));
  if (pending > BigInt(0)) {
    const released = await tx.contentWorkspaceUsage.updateMany({
      where: { creatorId: ownerId, storageReservedBytes: { gte: pending } },
      data: { storageReservedBytes: { decrement: pending } },
    });
    if (released.count !== 1)
      throw new WorkspaceDeletionConflict(
        "Reserved storage needs reconciliation. Nothing was removed.",
      );
    await tx.$executeRaw`UPDATE "ContentWorkspaceStorageReservation" SET status='RELEASED',"releasedAt"=clock_timestamp()
      WHERE "fileKey"=ANY(${keys}::text[]) AND "creatorId"=${ownerId} AND status='PENDING'`;
  }
  const rows = keys.map((key) => {
    const matches = receipts.filter((r) => r.fileKey === key);
    const completed = matches.filter((r) => r.status === "COMPLETED");
    const bytes = completed.length
      ? completed.reduce((n, r) => n + r.bytes, BigInt(0))
      : matches.length
        ? BigInt(0)
        : unique.get(key)!;
    return {
      id: createHash("sha256").update(`${ownerId}:${key}`).digest("hex"),
      fileKey: key,
      creatorId: ownerId,
      calendarId,
      bytes: bytes.toString(),
      notBefore: new Date(
        Math.max(Date.now(), ...matches.map((r) => r.expiresAt.getTime())) +
          60000,
      ).toISOString(),
    };
  });
  await tx.$executeRaw`INSERT INTO "WorkspaceStorageCleanup"(id,"fileKey","creatorId","calendarId",bytes,"notBefore","updatedAt")
    SELECT j.id,j."fileKey",j."creatorId",j."calendarId",j.bytes::bigint,j."notBefore"::timestamp,clock_timestamp()
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS j(id text,"fileKey" text,"creatorId" text,"calendarId" text,bytes text,"notBefore" text)
    ON CONFLICT ("fileKey") DO NOTHING`;
  const jobs = await tx.$queryRaw<
    Job[]
  >`SELECT * FROM "WorkspaceStorageCleanup" WHERE "fileKey"=ANY(${keys}::text[]) ORDER BY "fileKey" FOR UPDATE`;
  if (jobs.some((job) => job.creatorId !== ownerId))
    throw new WorkspaceDeletionConflict(
      "Shared storage ownership needs reconciliation.",
    );
  if (publishingRetentionRequired()) return;
  const orphaned = await tx.$queryRaw<
    { id: string; bytes: bigint; fileKey: string }[]
  >`SELECT j.id,j.bytes,j."fileKey" FROM "WorkspaceStorageCleanup" j
    WHERE j."fileKey"=ANY(${keys}::text[]) AND j."usageReleasedAt" IS NULL AND j.state='PENDING'
    AND NOT EXISTS(SELECT 1 FROM "CalendarPostAsset" a WHERE a."fileKey"=j."fileKey")
    AND NOT EXISTS(SELECT 1 FROM "CalendarBusinessDocument" d WHERE d."fileKey"=j."fileKey")
    AND NOT EXISTS(SELECT 1 FROM "SocialCalendar" c WHERE c."headerBannerDesktopUrl"=j."fileKey" OR c."headerBannerMobileUrl"=j."fileKey")`;
  const pins = await publishingPinnedKeys(
    tx,
    orphaned.map((job) => job.fileKey),
  );
  const eligible = orphaned.filter((job) => !pins.has(job.fileKey));
  const bytes = eligible.reduce((sum, job) => sum + job.bytes, BigInt(0));
  if (bytes > BigInt(0)) {
    const released = await tx.contentWorkspaceUsage.updateMany({
      where: { creatorId: ownerId, storageBytes: { gte: bytes } },
      data: { storageBytes: { decrement: bytes } },
    });
    if (released.count !== 1)
      throw new WorkspaceDeletionConflict(
        "Storage accounting needs reconciliation. Nothing was removed; please retry or contact support.",
      );
  }
  if (eligible.length) {
    const ids = eligible.map((job) => job.id);
    await tx.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET "usageReleasedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=ANY(${ids}::text[])`;
  }
}

export async function assertWorkspacePostsNotPublishing(
  tx: Tx,
  calendarId: string,
  postId?: string,
  allowUnsentScheduled = false,
  excludeRemoved = false,
) {
  const posts = await tx.calendarPost.findMany({
    where: { calendarId, ...(postId ? { id: postId } : {}), ...(excludeRemoved ? { deletedAt: null } : {}) },
  });
  const blockingPosts = posts.flatMap(post => {
    const reason = workspaceRemovalBlock(post, allowUnsentScheduled);
    return reason ? [{ id: post.id, title: (post.hook || post.contentIdea || post.caption || "Untitled post").slice(0, 140), platform: post.platform, postDate: post.postDate.toISOString(), reason }] : [];
  });
  if (blockingPosts.length) throw new WorkspaceDeletionConflict("These posts are holding up the reset. Open a post to check publishing, or remove it from the calendar below.", blockingPosts);
}

/** Capture expired cancelled/abandoned tickets without touching active uploads. */
export async function discoverReleasedWorkspaceUploads() {
  const rows = await db.$queryRaw<
    { creatorId: string; calendarId: string; fileKey: string }[]
  >`
    SELECT r."creatorId",r."calendarId",r."fileKey" FROM "ContentWorkspaceStorageReservation" r
    LEFT JOIN "WorkspaceStorageCleanup" j ON j."fileKey"=r."fileKey"
    WHERE r.status='RELEASED' AND r."expiresAt"<=clock_timestamp() AND j.id IS NULL
    AND r."fileKey" LIKE 'calendars/%' ORDER BY r."expiresAt",r.id LIMIT 100`;
  for (const row of rows)
    await db.$transaction((tx) =>
      queueWorkspaceStorageCleanup(tx, row.creatorId, row.calendarId, [
        { fileKey: row.fileKey, bytes: BigInt(0) },
      ]),
    );
  return { discovered: rows.length };
}

/** Durable, bounded retries. Quota release and object deletion are independently idempotent. */
export async function processWorkspaceStorageCleanup(limit = 25) {
  // Once a removed post has a settled outcome, release its retained media
  // through the same reference-aware cleanup used for ordinary deletion.
  const removed = await db.calendarPost.findMany({ where: { deletedAt: { not: null }, OR: [{ publishStatus: "PUBLISHED" }, { instagramPublishStatus: "PUBLISHED" }, { tikTokPublishStatus: "PUBLISHED" }, { publishStatus: "NOT_SCHEDULED", instagramPublishStatus: "NOT_SCHEDULED", tikTokPublishStatus: "NOT_SCHEDULED", publishWorkerStartedAt: null, tikTokInitStartedAt: null, tikTokPublishId: null, platformPostId: null, instagramMediaId: null }] }, include: { calendar: { select: { managerId: true } } }, take: Math.max(1, Math.min(25, limit)) });
  for (const post of removed) {
    if (workspaceRemovalBlock(post, true)) continue;
    try {
      const { removeWorkspaceContent } = await import("@/lib/workspaceDeletion");
      await removeWorkspaceContent({ calendarId: post.calendarId, actorId: post.calendar.managerId, mode: "post", postId: post.id, removeBlocked: true });
    } catch { /* A changed or still-active attempt stays retained for the next run. */ }
  }
  const jobs = await db.$queryRaw<Job[]>`SELECT * FROM "WorkspaceStorageCleanup"
    WHERE (state='PENDING' AND "notBefore"<=clock_timestamp()) OR (state='DELETING' AND "leaseUntil"<clock_timestamp())
    ORDER BY "notBefore",id LIMIT ${Math.max(1, Math.min(100, limit))}`;
  let deleted = 0,
    deferred = 0,
    failed = 0;
  for (const candidate of jobs) {
    const token = randomUUID();
    try {
      const claimed = await db.$transaction(
        async (tx) => {
          await lockWorkspaceFileKeys(tx, [candidate.fileKey]);
          const [job] = await tx.$queryRaw<
            Job[]
          >`SELECT * FROM "WorkspaceStorageCleanup" WHERE id=${candidate.id} FOR UPDATE`;
          if (
            !job ||
            job.state === "COMPLETE" ||
            (job.state === "PENDING" && job.notBefore > new Date()) ||
            (job.state === "DELETING" &&
              job.leaseUntil &&
              job.leaseUntil > new Date())
          )
            return false;
          if (await referenced(tx, job.fileKey)) {
            await tx.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET state='PENDING',"notBefore"=clock_timestamp()+interval '1 hour',"leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=clock_timestamp() WHERE id=${job.id}`;
            return false;
          }
          await releaseUsage(tx, job);
          await tx.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET state='DELETING',"leaseToken"=${token},"leaseUntil"=clock_timestamp()+interval '5 minutes',attempts=attempts+1,"updatedAt"=clock_timestamp() WHERE id=${job.id}`;
          return true;
        },
        { maxWait: 15000, timeout: 15000 },
      );
      if (!claimed) {
        deferred++;
        continue;
      }
      const posterKey = workspaceVideoPosterKey(candidate.fileKey);
      if (posterKey) await deleteObject(posterKey);
      await deleteObject(candidate.fileKey);
      await db.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET state='COMPLETE',"completedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseUntil"=NULL,"lastError"=NULL,"updatedAt"=clock_timestamp() WHERE id=${candidate.id} AND "leaseToken"=${token}`;
      deleted++;
    } catch {
      failed++;
      await db.$executeRaw`UPDATE "WorkspaceStorageCleanup" SET state='PENDING',"notBefore"=clock_timestamp()+interval '10 minutes',"leaseToken"=NULL,"leaseUntil"=NULL,"lastError"='Storage cleanup will retry',"updatedAt"=clock_timestamp() WHERE id=${candidate.id} AND ("leaseToken"=${token} OR (state='PENDING' AND "leaseToken" IS NULL))`.catch(
        () => {},
      );
    }
  }
  return { processed: jobs.length, deleted, deferred, failed };
}
