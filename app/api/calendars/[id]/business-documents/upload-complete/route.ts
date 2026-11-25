import { measureUploadStage, timeWorkspaceUpload } from "@/lib/workspaceUploadTiming";
import { lockWorkspaceUploadReservation } from "@/lib/workspaceUploadLocks";
import { rebuildBusinessKnowledge } from "@/lib/knowledge/context";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObjectSize, publicUrlFor } from "@/lib/r2";
import { extractTextFromDocument } from "@/lib/documentExtraction";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import {
  releaseContentWorkspaceStorageReservation,
} from "@/lib/contentWorkspaceUsage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return timeWorkspaceUpload(() => handleUpload(req, { params }));
}

async function handleUpload(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const creator = await measureUploadStage("auth", () => getCurrentCreator());

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  if (!(await measureUploadStage("permission", () => hasCalendarPermission(creator.id, id, "knowledge.manage")))) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to add business documents to this calendar",
      },
      { status: 403 }
    );
  }

  const calendar = await measureUploadStage("lookup", () => db.socialCalendar.findUnique({
    where: { id },
    select: {
      id: true,
      managerId: true,
      clientName: true,
      aiBusinessSummary: true,
      aiBusinessSummaryUpdatedAt: true,
    },
  }));

  if (!calendar) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 }
    );
  }

  const ownerId = calendar.managerId;

  let body: {
    fileKey?: unknown;
    originalName?: unknown;
    contentType?: unknown;
    fileSize?: unknown;
    reservationId?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    fileKey,
    originalName,
    contentType,
    fileSize,
    reservationId,
  } = body;

  if (
    typeof fileKey !== "string" ||
    !fileKey ||
    typeof originalName !== "string" ||
    !originalName ||
    typeof contentType !== "string" ||
    !contentType ||
    typeof reservationId !== "string" ||
    !reservationId ||
    fileSize === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "fileKey, originalName, contentType, fileSize and reservationId are required",
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
   * Business documents are uploaded into the calendar's dedicated
   * R2 namespace.
   *
   * This prevents a caller from submitting an arbitrary object key.
   */
  const expectedPrefix = `calendars/${id}/business-documents/`;

  if (!fileKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid file key" },
      { status: 400 }
    );
  }

  /*
   * Find the exact storage reservation created during presign.
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
   * Verify that this reservation belongs to the authenticated owner,
   * this calendar and this exact uploaded object.
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
   * Idempotency:
   *
   * If the client retries completion after the reservation has already
   * been finalized, return the existing document instead of consuming
   * storage again.
   */
  if (reservation.status === "COMPLETED") {
    const existingDocument =
      await db.calendarBusinessDocument.findFirst({
        where: {
          calendarId: id,
          fileKey,
        },
      });

    if (!existingDocument) {
      console.error(
        "Marketing Workspace storage reservation is COMPLETED but its business document is missing:",
        reservationId
      );

      return NextResponse.json(
        {
          error:
            "The upload is already marked as completed but its document could not be found.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      document: { ...existingDocument, sizeBytes: existingDocument.sizeBytes.toString() },
      alreadyCompleted: true,
      summaryUpdated: false,
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
   * Verify the actual object in R2.
   *
   * The browser's fileSize is not trusted for storage accounting.
   */
  let actualSizeBytes: number;

  try {
    actualSizeBytes = await measureUploadStage("storage_verify", () => getObjectSize(fileKey));
  } catch (error) {
    console.error(
      "Failed to verify uploaded business document in R2:",
      error
    );

    return NextResponse.json(
      {
        error:
          "The uploaded document could not be verified. Please try the upload again.",
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
        error:
          "The uploaded document has an invalid size.",
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
   * The actual R2 object must exactly match the reservation.
   *
   * We deliberately do not silently adjust the reservation here.
   * The reservation is the capacity that was approved before the
   * upload began.
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
          "The uploaded document size does not match the reserved upload size. Please try the upload again.",
      },
      { status: 422 }
    );
  }

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
   * Extract the document before finalizing the reservation.
   *
   * If extraction fails, the reservation remains available so the
   * caller can retry processing without incorrectly consuming storage.
   */
  let extractedText: string;

  try {
    extractedText = await measureUploadStage("extraction", () => extractTextFromDocument(
      publicUrlFor(fileKey),
      contentType
    ));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to read the uploaded document";

    return NextResponse.json(
      { error: message },
      { status: 422 }
    );
  }

  if (!extractedText.trim()) {
    return NextResponse.json(
      {
        error:
          "No readable text was found in that document",
      },
      { status: 422 }
    );
  }

  /*
   * Finalize storage and create the document in one transaction.
   *
   * storageReservedBytes -= bytes
   * storageBytes        += bytes
   * reservation         = COMPLETED
   * CalendarBusinessDocument = created
   *
   * Either all of these changes happen or none do.
   */
  let replayed = false;
  let document;

  try {
    document = await measureUploadStage("save", () => db.$transaction(async (tx) => {
      /*
       * Re-check the reservation inside the transaction so two
       * simultaneous completion requests cannot consume the same
       * reservation twice.
       */
      await tx.$queryRaw`SELECT id FROM "SocialCalendar" WHERE id = ${id} FOR UPDATE`;
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
       * request was extracting the document.
       */
      if (currentReservation.status === "COMPLETED") {
        const existingDocument =
          await tx.calendarBusinessDocument.findFirst({
            where: {
              calendarId: id,
              fileKey,
            },
          });

        if (!existingDocument) {
          throw new Error(
            "COMPLETED_RESERVATION_DOCUMENT_NOT_FOUND"
          );
        }

        replayed = true;
        return existingDocument;
      }

      if (currentReservation.status !== "PENDING") {
        throw new Error(
          "UPLOAD_RESERVATION_NOT_PENDING"
        );
      }

      if (!currentReservation.live || currentReservation.bytes !== reservation.bytes) {
        throw new Error("UPLOAD_RESERVATION_EXPIRED_OR_CHANGED");
      }
      if (await tx.calendarBusinessDocument.findFirst({ where: { calendarId: id, fileKey } })) {
        throw new Error("UPLOAD_FILE_ALREADY_ATTACHED");
      }
      const bytes = currentReservation.bytes;

      /*
       * Move the reserved bytes into consumed storage.
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
       * Mark the reservation as completed.
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
       * Save the business document with its actual R2 size.
       */
      return tx.calendarBusinessDocument.create({
        data: {
          calendarId: id,
          fileKey,
          originalName,
          sizeBytes: bytes,
          extractedText,
        },
      });
    }));
  } catch (error) {
    if (error instanceof Error && ["UPLOAD_RESERVATION_EXPIRED_OR_CHANGED", "UPLOAD_FILE_ALREADY_ATTACHED"].includes(error.message)) {
      return NextResponse.json({ error: error.message === "UPLOAD_FILE_ALREADY_ATTACHED"
          ? "This file is already attached. Refresh before starting another upload."
          : "This upload reservation expired or changed. Please start the upload again." }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message ===
        "UPLOAD_RESERVATION_NOT_FOUND"
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
      error.message ===
        "UPLOAD_RESERVATION_INVALID"
    ) {
      return NextResponse.json(
        { error: "Invalid upload reservation" },
        { status: 403 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "UPLOAD_RESERVATION_NOT_PENDING"
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
      error.message ===
        "COMPLETED_RESERVATION_DOCUMENT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "The upload is marked as completed but its document could not be found.",
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
      "Failed to finalize Marketing Workspace business document upload:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to finalize the uploaded document. Please try again.",
      },
      { status: 500 }
    );
  }

  if (replayed) return NextResponse.json({
    document: { ...document, sizeBytes: document.sizeBytes.toString() },
    alreadyCompleted: true, summaryUpdated: false,
  });

  /*
   * The document is now safely persisted and its storage has been
   * accounted for. Updating the rolling AI business summary is
   * deliberately outside the transaction.
   *
   * A summary failure must never undo a successful document upload.
   */
  try {
    const { summary: updatedSummary, updatedAt: summaryUpdatedAt } = await measureUploadStage("knowledge", () => rebuildBusinessKnowledge(id));

    const serializedDocument = {
  ...document,
  sizeBytes: document.sizeBytes.toString(),
};

return NextResponse.json({
  document: serializedDocument,
  businessSummary: updatedSummary,
  summaryUpdatedAt: summaryUpdatedAt?.toISOString() ?? null,
  summaryUpdated: true,
});
  } catch (error) {
    console.error(
      `Failed to fold business document into AI summary for calendar ${id}:`,
      error
    );

   const serializedDocument = {
  ...document,
  sizeBytes: document.sizeBytes.toString(),
};

return NextResponse.json({
  document: serializedDocument,
  businessSummary: calendar.aiBusinessSummary,
  summaryUpdatedAt: calendar.aiBusinessSummaryUpdatedAt?.toISOString() ?? null,
  summaryUpdated: false,
});
  }
}
