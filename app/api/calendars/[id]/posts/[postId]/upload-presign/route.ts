import { measureUploadStage, timeWorkspaceUpload } from "@/lib/workspaceUploadTiming";
import { randomUUID } from "node:crypto";
import { resolveFileContentType } from "@/lib/mediaFileTypes";
import { postContentEditErrorFromState } from "@/lib/publishing/editGuard";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPresignedUploadUrl, isAllowedContentType } from "@/lib/r2";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import {
  reserveContentWorkspaceStorage,
  releaseContentWorkspaceStorageReservation,
} from "@/lib/contentWorkspaceUsage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  return timeWorkspaceUpload(() => handleUpload(req, { params }));
}

async function handleUpload(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const creator = await measureUploadStage("auth", () => getCurrentCreator());

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, postId } = await params;

  if (!(await measureUploadStage("permission", () => hasCalendarPermission(creator.id, id, "ADD_CONTENT")))) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to add content to this calendar",
      },
      { status: 403 }
    );
  }

  const post = await measureUploadStage("lookup", () => db.calendarPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      calendarId: true,
      deletedAt: true, approvalStatus: true, platform: true, instagramPublishStatus: true,
      tikTokPublishStatus: true, publishStatus: true, tikTokPublishId: true, platformPostId: true,
      calendar: {
        select: {
          managerId: true,
        },
      },
    },
  }));

  if (!post || post.calendarId !== id) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  const editError = postContentEditErrorFromState(post);
  if (editError) return NextResponse.json({ error: editError }, { status: 409 });

  /*
   * Storage belongs to the Marketing Workspace subscription owner.
   * Collaborators upload against the owner's storage allowance.
   */
  const ownerId = post.calendar.managerId;

  let body: {
    filename?: unknown;
    contentType?: unknown;
    fileSize?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { filename, contentType: suppliedContentType, fileSize } = body;
  const contentType = resolveFileContentType(
    typeof filename === "string" ? filename : "",
    typeof suppliedContentType === "string" ? suppliedContentType : ""
  );

  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    typeof contentType !== "string" ||
    !contentType.trim() ||
    fileSize === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "filename, contentType and fileSize are required",
      },
      { status: 400 }
    );
  }

  if (
    typeof fileSize !== "number" ||
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0
  ) {
    return NextResponse.json(
      { error: "fileSize must be a valid positive number" },
      { status: 400 }
    );
  }

  if (!isAllowedContentType(contentType)) {
    return NextResponse.json(
      { error: "That file type isn't supported" },
      { status: 400 }
    );
  }

  /*
   * Generate the key before creating the reservation so the
   * reservation is permanently tied to this exact R2 object.
   */
  const safeFilename = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const fileKey = `calendars/${id}/${postId}/${randomUUID()}-${safeFilename}`;

  const reservation = await measureUploadStage("reservation", () => reserveContentWorkspaceStorage(
    ownerId,
    id,
    fileKey,
    fileSize
  ));

  if (!reservation.allowed || !reservation.reservationId) {
    return NextResponse.json(
      {
        error:
          reservation.reason ??
          "You don't have enough Marketing Workspace storage for this upload.",
        storage: {
          usedBytes: reservation.storageBytes,
          reservedBytes: reservation.storageReservedBytes,
          limitBytes: reservation.storageLimitBytes,
          remainingBytes: reservation.storageRemainingBytes,
        },
      },
      { status: 413 }
    );
  }

  try {
    const uploadUrl = await measureUploadStage("signing", () => getPresignedUploadUrl(
      fileKey,
      contentType
    ));

    return NextResponse.json({
      uploadUrl,
      fileKey,
      fileSize,
      reservationId: reservation.reservationId,
    });
  } catch (error) {
    /*
     * R2 presigning failed, so release only this exact reservation.
     */
    await releaseContentWorkspaceStorageReservation(
      reservation.reservationId,
      ownerId,
      id,
      fileKey
    );

    console.error(
      "Failed to create calendar asset upload URL:",
      error
    );

    return NextResponse.json(
      { error: "Failed to prepare the file upload" },
      { status: 500 }
    );
  }
}