import { removeWorkspaceContent, WorkspaceDeletionConflict } from "@/lib/workspaceDeletion";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { postContentEditError } from "@/lib/publishing/editGuard";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { publicUrlFor } from "@/lib/r2";

const VALID_PLATFORMS = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "FACEBOOK",
  "X",
  "LINKEDIN",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/[postId]/route.ts#PATCH@17",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, postId } = await params;

  if (
    !(await hasCalendarPermission(
      creator.id,
      id,
      "EDIT_CALENDAR"
    ))
  ) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to edit posts on this calendar",
      },
      { status: 403 }
    );
  }

  const post = await db.calendarPost.findUnique({
    where: { id: postId },
  });

  if (!post || post.calendarId !== id) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  const editError = await postContentEditError(postId, id);
  if (editError) return NextResponse.json({ error: editError }, { status: 409 });

  // Client approval is the permanent lock point for normal post editing.
  // NEEDS_REVISION deliberately remains editable.
  if (post.approvalStatus === "APPROVED") {
    return NextResponse.json(
      {
        error:
          "This post has been approved by the client and can no longer be edited. Ask the client to request a revision if something needs to change.",
        code: "POST_APPROVED_LOCKED",
      },
      { status: 409 }
    );
  }

 const {
  postDate,
  platform,
  postType,
  category,
  hook,
  script,
  caption,
  contentIdea,
  cta,
  hashtags,
  taggedAccounts,
  linkUrl,
  tikTokPrivacyLevel,
} = await req.json();

  if (
    platform &&
    !VALID_PLATFORMS.includes(platform)
  ) {
    return NextResponse.json(
      { error: "Invalid platform" },
      { status: 400 }
    );
  }

  if (tikTokPrivacyLevel !== undefined && tikTokPrivacyLevel !== null && !["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"].includes(tikTokPrivacyLevel)) {
    return NextResponse.json({ error: "Choose a valid TikTok privacy level." }, { status: 400 });
  }

  const updated = await db.calendarPost.update({
    where: { id: postId },
    data: {
      tikTokConsentAt: null, tikTokConsentHash: null, tikTokConsentBy: null, tikTokConsentAccountId: null, tikTokConsentVersion: null,
      ...(tikTokPrivacyLevel !== undefined ? { tikTokPrivacyLevel } : {}),
      ...(postDate
        ? { postDate: new Date(postDate) }
        : {}),
      ...(platform ? { platform } : {}),
      postType:
        postType !== undefined
          ? postType?.trim() || null
          : undefined,
     category:
  category !== undefined
    ? category?.trim() || null
    : undefined,
hook:
  hook !== undefined
    ? hook?.trim() || null
    : undefined,
script:
  script !== undefined
    ? script?.trim() || null
    : undefined,
caption:
  caption !== undefined
    ? caption?.trim() || null
    : undefined,
      contentIdea:
        contentIdea !== undefined
          ? contentIdea?.trim() || null
          : undefined,
      cta:
        cta !== undefined
          ? cta?.trim() || null
          : undefined,
      hashtags:
        hashtags !== undefined
          ? hashtags?.trim() || null
          : undefined,
      taggedAccounts:
        taggedAccounts !== undefined
          ? taggedAccounts?.trim() || null
          : undefined,
      linkUrl:
        linkUrl !== undefined
          ? linkUrl?.trim() || null
          : undefined,
    },
    include: {
      assets: {
        orderBy: {
          displayOrder: "asc",
        },
      },
      videoComments: {
        orderBy: {
          videoTimestampSeconds: "asc",
        },
      },
      customFields: true,
    },
  });

  return NextResponse.json({
    post: {
      ...updated,
      assets: updated.assets.map((a) => ({
        ...a,
        sizeBytes: Number(a.sizeBytes),
        contentUrl: publicUrlFor(a.fileKey),
        posterUrl: a.posterFileKey ? publicUrlFor(a.posterFileKey) : null,
      })),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/[postId]/route.ts#DELETE@181",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, postId } = await params;

  if (
    !(await hasCalendarPermission(
      creator.id,
      id,
      "EDIT_CALENDAR"
    ))
  ) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to delete posts on this calendar",
      },
      { status: 403 }
    );
  }

  const post = await db.calendarPost.findUnique({
    where: { id: postId },
    include: {
      assets: true,
    },
  });

  if (!post || post.calendarId !== id) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const removeBlocked = body?.confirmation === "DELETE" && body?.removeBlocked === true;
  if (removeBlocked) {
    const owner = await db.socialCalendar.findUnique({ where: { id }, select: { managerId: true } });
    if (owner?.managerId !== creator.id) return NextResponse.json({ error: "Only the workspace owner can remove protected posts." }, { status: 403 });
  }
  // Approved posts are protected from deletion as well as editing.
  if (post.approvalStatus === "APPROVED" && !removeBlocked) {
    return NextResponse.json(
      {
        error:
          "This post has been approved by the client and can no longer be deleted.",
        code: "POST_APPROVED_LOCKED",
      },
      { status: 409 }
    );
  }

  try {
    return NextResponse.json(await removeWorkspaceContent({ actorId: creator.id, mode: "post", calendarId: id, postId, removeBlocked }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceDeletionConflict ? error.message : "Unable to delete this post. Please retry.", ...(error instanceof WorkspaceDeletionConflict ? { blockingPosts: error.blockingPosts } : {}) }, { status: error instanceof WorkspaceDeletionConflict ? 409 : 500 });
  }
}
