import { uploadNoticeBatchId, uploadNoticeReceipt } from "@/lib/calendarUploadNotice";
import { notifyCalendarWorkflow } from "@/lib/calendarWorkflowEmails";
import { measureUploadStage, timeWorkspaceUpload } from "@/lib/workspaceUploadTiming";
import { lockWorkspaceUploadReservation } from "@/lib/workspaceUploadLocks";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { postContentEditErrorFromState } from "@/lib/publishing/editGuard";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { getObjectSize, publicUrlFor } from "@/lib/r2";
import { type CalendarPost, MediaType } from "@prisma/client";
import {
  releaseContentWorkspaceStorageReservation,
} from "@/lib/contentWorkspaceUsage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/[postId]/upload-complete/route.ts#POST@12",Array.from(arguments)); } /* end-canonical-integration-boundary */
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

  const ownerId = post.calendar.managerId;

  let body: {
    fileKey?: unknown;
    mediaType?: unknown;
    fileSize?: unknown;
    reservationId?: unknown;
    batchId?: unknown;
    timeZone?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { fileKey, mediaType, fileSize, reservationId } = body;
  const batchId = uploadNoticeBatchId(body.batchId);
  const notice = () => batchId ? uploadNoticeReceipt(id, creator.id, batchId, postId) : undefined;
  if (
  typeof mediaType !== "string" ||
  !Object.values(MediaType).includes(mediaType as MediaType)
) {
  return NextResponse.json(
    { error: "Invalid mediaType" },
    { status: 400 }
  );
}

const validatedMediaType = mediaType as MediaType;

  if (
    typeof fileKey !== "string" ||
    !fileKey ||
    typeof mediaType !== "string" ||
    !mediaType ||
    typeof reservationId !== "string" ||
    !reservationId ||
    fileSize === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "fileKey, mediaType, fileSize and reservationId are required",
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

  /*
   * Only accept objects created for this specific post.
   * This prevents callers from submitting arbitrary R2 objects.
   */
  const expectedPrefix = `calendars/${id}/${postId}/`;

  if (!fileKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid file key" },
      { status: 400 }
    );
  }

  /*
   * Find the exact reservation created by upload-presign.
   *
   * The reservation is the source of truth for storage accounting.
   */
  const reservation =
    await measureUploadStage("receipt", () => db.contentWorkspaceStorageReservation.findUnique({
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        creatorId: true,
        calendarId: true,
        fileKey: true,
        bytes: true,
        status: true,
        expiresAt: true,
      },
    }));

  if (!reservation) {
    return NextResponse.json(
      {
        error:
          "Upload reservation not found. Please start the upload again.",
      },
      { status: 404 }
    );
  }

  /*
   * The reservation must belong to this creator, calendar and file.
   */
  if (
    reservation.creatorId !== ownerId ||
    reservation.calendarId !== id ||
    reservation.fileKey !== fileKey
  ) {
    return NextResponse.json(
      { error: "Invalid upload reservation" },
      { status: 403 }
    );
  }

  /*
   * If this request was already completed, make the endpoint
   * idempotent by returning the existing asset instead of charging
   * storage again.
   */
  if (reservation.status === "COMPLETED") {
    const existingAsset = await db.calendarPostAsset.findFirst({
      where: {
        postId,
        fileKey,
      },
    });

    if (!existingAsset) {
      console.error(
        "Marketing Workspace storage reservation is COMPLETED but its asset is missing:",
        reservationId
      );

      return NextResponse.json(
        {
          error:
            "The upload is already marked as completed but its asset could not be found.",
        },
        { status: 409 }
      );
    }

    const updated = await measureUploadStage("lookup", () => db.calendarPost.findUnique({
      where: { id: postId },
      include: {
        assets: {
          orderBy: { displayOrder: "asc" },
        },
        videoComments: {
          orderBy: { videoTimestampSeconds: "asc" },
        },
        customFields: true,
      },
    }));

    if (!updated) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    const serializedPost = {
  ...updated,
  assets: updated.assets.map((asset) => ({
    ...asset,
    sizeBytes: asset.sizeBytes.toString(),
    contentUrl: publicUrlFor(asset.fileKey),
        posterUrl: asset.posterFileKey ? publicUrlFor(asset.posterFileKey) : null,
  })),
};

return NextResponse.json({
  post: serializedPost,
  uploadNotice: notice(),
});
  }

  /*
   * Only PENDING reservations can be finalized.
   */
  if (reservation.status !== "PENDING") {
    return NextResponse.json(
      {
        error:
          "This upload reservation is no longer active. Please start the upload again.",
      },
      { status: 409 }
    );
  }

  /*
   * Do not allow an expired reservation to be finalized.
   */
  if (reservation.expiresAt.getTime() <= Date.now()) {
    try {
      await releaseContentWorkspaceStorageReservation(
        reservation.id,
        ownerId,
        id,
        fileKey
      );
    } catch (error) {
      console.error(
        "Failed to release expired Marketing Workspace storage reservation:",
        error
      );
    }

    return NextResponse.json(
      {
        error:
          "The upload reservation has expired. Please start the upload again.",
      },
      { status: 409 }
    );
  }

  /*
   * Verify that the object actually exists in R2 and obtain its
   * server-reported size.
   *
   * Browser-supplied fileSize is never trusted for final accounting.
   */
  let actualSizeBytes: number;

  try {
    actualSizeBytes = await measureUploadStage("storage_verify", () => getObjectSize(fileKey));
  } catch (error) {
    console.error(
      "Failed to verify uploaded calendar asset in R2:",
      error
    );

    return NextResponse.json(
      {
        error:
          "The uploaded file could not be verified. Please try the upload again.",
      },
      { status: 422 }
    );
  }

  if (
    !Number.isSafeInteger(actualSizeBytes) ||
    actualSizeBytes <= 0
  ) {
    return NextResponse.json(
      {
        error: "The uploaded file has an invalid size.",
      },
      { status: 422 }
    );
  }

  const reservedBytes = Number(reservation.bytes);

  if (
    !Number.isSafeInteger(reservedBytes) ||
    reservedBytes <= 0
  ) {
    console.error(
      "Invalid Marketing Workspace storage reservation size:",
      reservation
    );

    return NextResponse.json(
      {
        error:
          "The upload reservation is invalid. Please start the upload again.",
      },
      { status: 409 }
    );
  }

  /*
   * The reservation and the actual object must agree exactly.
   *
   * If the browser supplied a different file size from the actual
   * object, reject the upload rather than allowing storage accounting
   * to become inaccurate.
   */
  if (actualSizeBytes !== reservedBytes) {
    try {
      await releaseContentWorkspaceStorageReservation(
        reservation.id,
        ownerId,
        id,
        fileKey
      );
    } catch (releaseError) {
      console.error(
        "Failed to release mismatched Marketing Workspace storage reservation:",
        releaseError
      );
    }

    return NextResponse.json(
      {
        error:
          "The uploaded file size does not match the reserved upload size. Please try the upload again.",
      },
      { status: 422 }
    );
  }

  /*
   * Also ensure the reservation agrees with the value supplied by the
   * client. This is not used as the source of truth; it is simply an
   * additional consistency check.
   */
  if (fileSize !== reservedBytes) {
    return NextResponse.json(
      {
        error:
          "The upload reservation does not match the requested file size.",
      },
      { status: 409 }
    );
  }

  /*
   * Finalize the reservation and create the asset in ONE database
   * transaction.
   *
   * This is important:
   *
   *   storageReservedBytes -= reservedBytes
   *   storageBytes        += reservedBytes
   *   reservation         = COMPLETED
   *   CalendarPostAsset   = created
   *
   * must succeed together.
   *
   * Otherwise we could count storage without creating the asset, or
   * create the asset without accounting for its storage.
   */
  try {
    let attached = false;
    const updated = await measureUploadStage("save", () => db.$transaction(
  async (tx) => {
      /*
       * Re-check the reservation inside the transaction to prevent
       * two simultaneous completion requests from both consuming it.
       */
      // Lock the parent before the receipt, matching asset-review trigger ordering.
      const lockedPosts = await tx.$queryRaw<CalendarPost[]>`SELECT * FROM "CalendarPost" WHERE id = ${postId} AND "calendarId" = ${id} FOR UPDATE`;
      const currentReservation = await lockWorkspaceUploadReservation(tx, reservation.id);

      if (!currentReservation) {
        throw new Error("UPLOAD_RESERVATION_NOT_FOUND");
      }

      if (
        currentReservation.creatorId !== ownerId ||
        currentReservation.calendarId !== id ||
        currentReservation.fileKey !== fileKey
      ) {
        throw new Error("UPLOAD_RESERVATION_INVALID");
      }

      /*
       * Another request may have completed the reservation while this
       * request was verifying the R2 object.
       */
      if (
        currentReservation.status === "COMPLETED"
      ) {
        const existingAsset =
          await tx.calendarPostAsset.findFirst({
            where: {
              postId,
              fileKey,
            },
          });

        if (!existingAsset) {
          throw new Error(
            "COMPLETED_RESERVATION_ASSET_NOT_FOUND"
          );
        }

        return tx.calendarPost.findUniqueOrThrow({
          where: { id: postId },
          include: {
            assets: {
              orderBy: { displayOrder: "asc" },
            },
            videoComments: {
              orderBy: { videoTimestampSeconds: "asc" },
            },
            customFields: true,
          },
        });
      }

      if (currentReservation.status !== "PENDING") {
        throw new Error("UPLOAD_RESERVATION_NOT_PENDING");
      }

      if (!currentReservation.live || currentReservation.bytes !== reservation.bytes) {
        throw new Error("UPLOAD_RESERVATION_EXPIRED_OR_CHANGED");
      }
      const editError = postContentEditErrorFromState(lockedPosts[0] ?? null);
      if (editError) throw new Error("UPLOAD_POST_LOCKED");
      // One scoped read supplies both duplicate detection and next display order.
      // The parent lock serializes attachment writers for this post.
      const assets = await tx.calendarPostAsset.findMany({
        where: { postId }, select: { fileKey: true, displayOrder: true },
      });
      if (assets.some(asset => asset.fileKey === fileKey)) {
        throw new Error("UPLOAD_FILE_ALREADY_ATTACHED");
      }
      const bytes = currentReservation.bytes;
      const nextDisplayOrder = assets.reduce((max, asset) => Math.max(max, asset.displayOrder), -1) + 1;

      /*
       * Move the bytes from reserved storage into consumed storage.
       */
      const usage = await tx.contentWorkspaceUsage.updateMany({
        where: {
          creatorId: ownerId,
          storageReservedBytes: {
            gte: bytes,
          },
        },
        data: {
          storageReservedBytes: {
            decrement: bytes,
          },
          storageBytes: {
            increment: bytes,
          },
        },
      });

      if (usage.count !== 1) {
        throw new Error(
          "CONTENT_WORKSPACE_STORAGE_USAGE_UPDATE_FAILED"
        );
      }

      /*
       * Mark the reservation completed.
       */
      await tx.contentWorkspaceStorageReservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      /*
       * Create the actual post asset.
       */
      await tx.calendarPostAsset.create({
        data: {
          postId,
          fileKey,
         mediaType: validatedMediaType,
          sizeBytes: bytes,
          displayOrder: nextDisplayOrder,
        },
      });

      /*
       * A fresh upload means the post needs a fresh client review,
       * even if it was previously approved.
       */
      attached = true;
      return tx.calendarPost.update({
        where: { id: postId },
        data: {
          approvalStatus: "PENDING",
          approvalNote: null,
          reviewedAt: null,
        },
        include: {
          assets: {
            orderBy: { displayOrder: "asc" },
          },
          videoComments: {
            orderBy: { videoTimestampSeconds: "asc" },
          },
          customFields: true,
        },
      });
    },
    {
      maxWait: 15000,
      timeout: 15000,
    }
  ));

    if (attached && !batchId) await notifyCalendarWorkflow({
      kind: "uploaded", calendarId: id, key: reservation.id, postId, actorId: creator.id, timeZone: body.timeZone,
    });
    const serializedPost = {
  ...updated,
  assets: updated.assets.map((asset) => ({
    ...asset,
    sizeBytes: asset.sizeBytes.toString(),
    contentUrl: publicUrlFor(asset.fileKey),
        posterUrl: asset.posterFileKey ? publicUrlFor(asset.posterFileKey) : null,
  })),
};

return NextResponse.json({
  post: serializedPost,
  uploadNotice: notice(),
});
  } catch (error) {
    if (error instanceof Error && ["UPLOAD_RESERVATION_EXPIRED_OR_CHANGED", "UPLOAD_POST_LOCKED", "UPLOAD_FILE_ALREADY_ATTACHED"].includes(error.message)) {
      return NextResponse.json({ error: error.message === "UPLOAD_POST_LOCKED"
        ? "This post is approved or publishing. Request a revision before changing content."
        : error.message === "UPLOAD_FILE_ALREADY_ATTACHED"
          ? "This file is already attached. Refresh before starting another upload."
          : "This upload reservation expired or changed. Please start the upload again." }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message === "UPLOAD_RESERVATION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "Upload reservation not found. Please start the upload again.",
        },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "UPLOAD_RESERVATION_INVALID"
    ) {
      return NextResponse.json(
        { error: "Invalid upload reservation" },
        { status: 403 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "UPLOAD_RESERVATION_NOT_PENDING"
    ) {
      return NextResponse.json(
        {
          error:
            "This upload reservation is no longer active. Please start the upload again.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "COMPLETED_RESERVATION_ASSET_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "The upload is marked as completed but its asset could not be found.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "CONTENT_WORKSPACE_STORAGE_USAGE_UPDATE_FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "There is not enough reserved storage to finalize this upload.",
        },
        { status: 409 }
      );
    }

    console.error(
      "Failed to finalize Marketing Workspace post upload:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to finalize the uploaded file. Please try again.",
      },
      { status: 500 }
    );
  }
}