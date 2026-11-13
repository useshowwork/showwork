import { assertWorkspaceFileAttachable, WorkspaceDeletionConflict } from "@/lib/workspaceStorageCleanup";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { postContentEditError } from "@/lib/publishing/editGuard";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentCreator } from "@/lib/auth";
import { publicUrlFor } from "@/lib/r2";
import { hasCalendarPermission } from "@/lib/calendarPermissions";

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; postId: string }>;
  }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/[postId]/attach-asset/route.ts#POST@9",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: calendarId, postId } = await params;

  /*
   * Attaching an existing asset is still an "add content" action.
   * The same permission used for normal uploads therefore applies.
   */
  if (
    !(await hasCalendarPermission(
      creator.id,
      calendarId,
      "ADD_CONTENT"
    ))
  ) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to add content to this calendar",
      },
      { status: 403 }
    );
  }

  const editError = await postContentEditError(postId, calendarId);
  if (editError) return NextResponse.json({ error: editError }, { status: 409 });

  let body: {
    sourcePostId?: unknown;
    fileKey?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { sourcePostId, fileKey } = body;

  if (
    typeof sourcePostId !== "string" ||
    !sourcePostId ||
    typeof fileKey !== "string" ||
    !fileKey
  ) {
    return NextResponse.json(
      {
        error: "sourcePostId and fileKey are required",
      },
      { status: 400 }
    );
  }

  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SocialCalendar" WHERE id=${calendarId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "CalendarPost" WHERE "calendarId"=${calendarId} AND id IN (${postId},${sourcePostId}) ORDER BY id FOR UPDATE`;
      await assertWorkspaceFileAttachable(tx, fileKey);
      const editError = await postContentEditError(postId, calendarId, tx);
      if (editError) return NextResponse.json({ error: editError }, { status: 409 });
  /*
   * Confirm that the destination post belongs to this calendar.
   */
  const destinationPost = await tx.calendarPost.findUnique({
    where: {
      id: postId,
    },
    select: {
      id: true,
      calendarId: true,
    },
  });

  if (
    !destinationPost ||
    destinationPost.calendarId !== calendarId
  ) {
    return NextResponse.json(
      { error: "Destination post not found" },
      { status: 404 }
    );
  }

  /*
   * Find the already-uploaded source asset.
   *
   * We deliberately require the source post to belong to the same
   * calendar. This prevents somebody from using this endpoint to
   * attach an asset from another client's workspace.
   */
  const sourcePost = await tx.calendarPost.findUnique({
    where: {
      id: sourcePostId,
    },
    select: {
      id: true,
      calendarId: true,
    },
  });

  if (
    !sourcePost ||
    sourcePost.calendarId !== calendarId
  ) {
    return NextResponse.json(
      { error: "Source post not found" },
      { status: 404 }
    );
  }

  /*
   * Find the actual completed asset.
   *
   * The asset must already exist in the database. That means the
   * original R2 upload has already completed and its storage has
   * already been accounted for.
   */
  const sourceAsset = await tx.calendarPostAsset.findFirst({
    where: {
      postId: sourcePostId,
      fileKey,
    },
    select: {
      id: true,
      fileKey: true,
      mediaType: true,
      sizeBytes: true,
      posterFileKey: true,
    },
  });

  if (!sourceAsset) {
    return NextResponse.json(
      {
        error:
          "The source file could not be found. Please upload the file first.",
      },
      { status: 404 }
    );
  }

  /*
   * Do not create the same asset twice on the destination post.
   */
  const existingAsset = await tx.calendarPostAsset.findFirst({
    where: {
      postId,
      fileKey,
    },
    select: {
      id: true,
    },
  });

  if (existingAsset) {
    const existingPost =
      await tx.calendarPost.findUniqueOrThrow({
        where: {
          id: postId,
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
        ...existingPost,
        assets: existingPost.assets.map((asset) => ({
          ...asset,
          sizeBytes:
            typeof asset.sizeBytes === "bigint"
              ? asset.sizeBytes.toString()
              : asset.sizeBytes,
          contentUrl: publicUrlFor(asset.fileKey),
        posterUrl: asset.posterFileKey ? publicUrlFor(asset.posterFileKey) : null,
        })),
      },
    });
  }

  /*
   * Put the asset at the end of the destination post's existing
   * asset list.
   */
  const existingCount =
    await tx.calendarPostAsset.count({
      where: {
        postId,
      },
    });

  /*
   * Create another database reference to the SAME R2 object.
   *
   * This does NOT upload the file again.
   *
   * It also does NOT increase storage usage because the physical
   * file already exists and has already been counted.
   */
  await tx.calendarPostAsset.create({
    data: {
      postId,
      fileKey: sourceAsset.fileKey,
      mediaType: sourceAsset.mediaType,
      sizeBytes: sourceAsset.sizeBytes,
      posterFileKey: sourceAsset.posterFileKey,
      displayOrder: existingCount,
    },
  });

  /*
   * Attaching new content means the destination post needs fresh
   * client review, just like a normal upload.
   */
  const updatedPost = await tx.calendarPost.update({
    where: {
      id: postId,
    },
    data: {
      internalReviewStatus: "PENDING",
      internalReviewNote: null,
      internalReviewedAt: null,
      internalReviewedBy: null,
      internalReviewVersion: { increment: 1 },
      approvalStatus: "PENDING",
      approvalNote: null,
      reviewedAt: null,
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
      ...updatedPost,
      assets: updatedPost.assets.map((asset) => ({
        ...asset,
        sizeBytes:
          typeof asset.sizeBytes === "bigint"
            ? asset.sizeBytes.toString()
            : asset.sizeBytes,
        contentUrl: publicUrlFor(asset.fileKey),
        posterUrl: asset.posterFileKey ? publicUrlFor(asset.posterFileKey) : null,
      })),
    },
  });
    }, { maxWait: 15000, timeout: 15000 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceDeletionConflict ? error.message : "Unable to attach this file. Please retry." }, { status: error instanceof WorkspaceDeletionConflict ? 409 : 500 });
  }
}
