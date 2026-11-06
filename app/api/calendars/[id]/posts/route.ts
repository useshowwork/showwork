import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canAccessCalendarById,
  hasCalendarPermission,
} from "@/lib/calendarPermissions";
import { isAdminEmail } from "@/lib/admin";
import { publicUrlFor } from "@/lib/r2";
import type { SocialPlatform } from "@prisma/client";
import { calendarPostData, lockCalendar } from "@/lib/calendarPosts";

const VALID_PLATFORMS: SocialPlatform[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "FACEBOOK",
  "X",
  "LINKEDIN",
];
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return invokePublishingEntrypoint<Response>('app/api/calendars/[id]/posts/route.ts#GETcanonical',Array.from(arguments)); } /* end-canonical-integration-boundary */
  const creator = await getCurrentCreator();
  if (!creator)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "VIEW_ONLY"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Saved content remains readable when subscription access is locked.

  const posts = await db.calendarPost.findMany({
    where: { calendarId: id, deletedAt: null },
    orderBy: { postDate: "asc" },
    include: {
      assets: { orderBy: { displayOrder: "asc" } },
      videoComments: { orderBy: { videoTimestampSeconds: "asc" } },
      customFields: true,
    },
  });

  return NextResponse.json(
    {
      posts: posts.map((post) => ({
        id: post.id,
        updatedAt: post.updatedAt.toISOString(),
        creativeBrief: post.creativeBrief,
        creativeDevelopment: post.creativeDevelopment,
        postDate: post.postDate.toISOString(),
        platform: post.platform,
        postType: post.postType,
        category: post.category,
        hook: post.hook,
        script: post.script,
        caption: post.caption,
        contentIdea: post.contentIdea,
        cta: post.cta,
        hashtags: post.hashtags,
        taggedAccounts: post.taggedAccounts,
        linkUrl: post.linkUrl,
        approvalStatus: post.approvalStatus,
        internalReviewStatus: post.internalReviewStatus,
        internalReviewNote: post.internalReviewNote,
        internalReviewVersion: post.internalReviewVersion,
        internalReviewedAt: post.internalReviewedAt?.toISOString() ?? null,
        approvalNote: post.approvalNote,
        publishStatus: post.publishStatus,
        publishError: post.publishError,
        publishPermalink: post.publishPermalink,
        instagramPublishStatus: post.instagramPublishStatus,
        instagramPermalink: post.instagramPermalink,
        instagramPublishError: post.instagramPublishError,
        tikTokPublishStatus: post.tikTokPublishStatus,
        tikTokPrivacyLevel: post.tikTokPrivacyLevel,
        tikTokSettings: post.tikTokSettings,
        tikTokConsentAt: post.tikTokConsentAt?.toISOString() ?? null,
        tikTokInitStartedAt: post.tikTokInitStartedAt?.toISOString() ?? null,
        tikTokPublishId: post.tikTokPublishId,
        tikTokPublishError: post.tikTokPublishError,
        assets: post.assets.map((asset) => ({
          id: asset.id,
          fileKey: asset.fileKey,
          mediaType: asset.mediaType,
          contentUrl: publicUrlFor(asset.fileKey),
        posterUrl: asset.posterFileKey ? publicUrlFor(asset.posterFileKey) : null,
        })),
        videoComments: post.videoComments.map((comment) => ({
          id: comment.id,
          authorName: comment.authorName,
          authorEmail: comment.authorEmail,
          note: comment.note,
          videoTimestampSeconds: comment.videoTimestampSeconds,
        })),
        customFields: post.customFields.map((field) => ({
          id: field.id,
          label: field.label,
          value: field.value,
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isSocialPlatform(value: unknown): value is SocialPlatform {
  return (
    typeof value === "string" && (VALID_PLATFORMS as string[]).includes(value)
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/route.ts#POST@106",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();
  if (!creator)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { id } });
  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }
  if (!(await hasCalendarPermission(creator.id, id, "EDIT_CALENDAR"))) {
    return NextResponse.json(
      { error: "You don't have permission to add posts to this calendar" },
      { status: 403 },
    );
  }

  if (!isAdminEmail(creator.email) && !(await canAccessCalendarById(id))) {
    return NextResponse.json(
      { error: "This calendar isn't active" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  let data;
  try {
    body = await req.json();
    if (!body || typeof body !== "object")
      throw new Error("Invalid request body.");
    const platformList =
      Array.isArray(body.platforms) && body.platforms.length
        ? body.platforms
        : body.platform
          ? [body.platform]
          : [];
    if (
      !platformList.length ||
      platformList.some((value) => !isSocialPlatform(value))
    )
      throw new Error("At least one valid platform is required.");
    const platforms = [...new Set(platformList)] as SocialPlatform[];
    data = platforms.map((platform) => calendarPostData(id, body, platform));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request body.",
      },
      { status: 400 },
    );
  }
  const posts = await db.$transaction(
    async (tx) => {
      await lockCalendar(tx, id);
      const createdIds: string[] = [];
      for (const postData of data)
        createdIds.push(
          (await tx.calendarPost.create({ data: postData, select: { id: true } })).id,
        );
      // Fetch relations once for the batch instead of once per platform.
      const created = await tx.calendarPost.findMany({
        where: { id: { in: createdIds } },
        include: { assets: true, customFields: true },
      });
      const byId = new Map(created.map((post) => [post.id, post]));
      return createdIds.map((postId) => byId.get(postId)!);
    },
    // Multiple platforms and nested custom fields can exceed Prisma's 5s default.
    { maxWait: 10000, timeout: 30000 },
  );
  return NextResponse.json({ post: posts[0], posts });
}
