import { calendarSlugCandidate } from "@/lib/calendarSlug";
import { queueWorkspaceStorageCleanup } from "@/lib/workspaceStorageCleanup";
import { removeWorkspaceContent, WorkspaceDeletionConflict } from "@/lib/workspaceDeletion";
import { lockWorkspaceUploadReservation } from "@/lib/workspaceUploadLocks";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import {
  getObjectSize,
} from "@/lib/r2";

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";

  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/route.ts#PATCH@24",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const calendar = await db.socialCalendar.findUnique({
    where: { id },
  });

  if (!calendar) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 }
    );
  }

  const reqBody = await req.json().catch(() => null);
  if (!reqBody || typeof reqBody !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { action, clientName, password, headerBannerDesktopUrl, headerBannerMobileUrl, headerTitle, headerDescription } = reqBody;
  const deliveryActions = ["publish", "update_header"];
  if (!(await hasCalendarPermission(creator.id, id, deliveryActions.includes(action) ? "delivery.manage" : "workspace.manage"))) return NextResponse.json({ error: "You do not have permission for this workspace action." }, { status: 403 });

  // ─────────────────────────────────────────────
  // PUBLISH
  // ─────────────────────────────────────────────

  if (action === "publish") {
    if (
      calendar.planStatus !== "BUILDING" &&
      calendar.planStatus !== "PLAN_NEEDS_CHANGES"
    ) {
      return NextResponse.json(
        {
          error:
            "This plan can't be published from its current state",
        },
        { status: 400 }
      );
    }

    const updated = await db.socialCalendar.update({
      where: { id },
      data: {
        planStatus: "AWAITING_APPROVAL",
        planSubmittedAt: new Date(),
      },
    });

    return NextResponse.json({ calendar: updated });
  }

  // ─────────────────────────────────────────────
  // UPDATE DETAILS
  // ─────────────────────────────────────────────

  if (action === "update_details") {
    if (typeof clientName !== "string" || !clientName.trim()) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const name = clientName.trim();
    for (let attempt = 0; attempt < 100; attempt++) {
      const slug = name === calendar.clientName ? calendar.slug : calendarSlugCandidate(name, attempt);
      const existing = await db.socialCalendar.findUnique({ where: { slug }, select: { id: true } });
      if (existing && existing.id !== id) continue;
      try {
        const updated = await db.socialCalendar.update({ where: { id }, data: { clientName: name, slug } });
        return NextResponse.json({ calendar: updated });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") continue;
        throw error;
      }
    }
    return NextResponse.json({ error: "Couldn’t reserve the new calendar link. Try a more specific name." }, { status: 409 });
  }

  // ─────────────────────────────────────────────
  // REGENERATE PASSWORD
  // ─────────────────────────────────────────────

  if (action === "regenerate_password") {
    const newCode = generateAccessCode();

    const updated = await db.socialCalendar.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(newCode),
        accessCode: newCode,
      },
    });

    return NextResponse.json({
      calendar: updated,
      newPassword: newCode,
    });
  }

  // ─────────────────────────────────────────────
  // SET PASSWORD
  // ─────────────────────────────────────────────

  if (action === "set_password") {
    if (!password) {
      return NextResponse.json(
        { error: "A password is required" },
        { status: 400 }
      );
    }

    const updated = await db.socialCalendar.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        accessCode: password,
      },
    });

    return NextResponse.json({
      calendar: updated,
      newPassword: password,
    });
  }

      // ─────────────────────────────────────────────
  // UPDATE HEADER
  // ─────────────────────────────────────────────

  if (action === "update_header") {
    const desktopReservationId =
      typeof reqBody?.desktopReservationId === "string"
        ? reqBody.desktopReservationId
        : null;

    const mobileReservationId =
      typeof reqBody?.mobileReservationId === "string"
        ? reqBody.mobileReservationId
        : null;

    const newDesktopBanner =
      headerBannerDesktopUrl !== undefined
        ? headerBannerDesktopUrl || null
        : undefined;

    const newMobileBanner =
      headerBannerMobileUrl !== undefined
        ? headerBannerMobileUrl || null
        : undefined;

    /*
     * Verify each newly uploaded banner before consuming its
     * reservation. The browser-provided file size is never
     * trusted here — R2 is the source of truth.
     */
    const verifyBannerUpload = async (
      reservationId: string | null,
      fileKey: string | null,
      variant: "desktop" | "mobile"
    ) => {
      const existingKey = variant === "desktop" ? calendar.headerBannerDesktopUrl : calendar.headerBannerMobileUrl;
      if (fileKey && (reservationId || fileKey !== existingKey) && !fileKey.startsWith(`calendars/${id}/banner-${variant}/`)) return { success: false, reservationId, fileKey, bytes: 0, error: "Invalid banner upload key." };
      if (fileKey && !reservationId && fileKey !== existingKey) return { success: false, reservationId, fileKey, bytes: 0, error: "A new banner needs its upload receipt. Please upload it again." };
      if (!reservationId || !fileKey) {
        return {
          success: true,
          reservationId: null,
          fileKey: null,
          bytes: 0,
        };
      }

      try {
        const reservation =
          await db.contentWorkspaceStorageReservation.findUnique({
            where: {
              id: reservationId,
            },
            select: {
              creatorId: true,
              calendarId: true,
              fileKey: true,
              bytes: true,
              status: true,
              expiresAt: true,
            },
          });

        if (!reservation) {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The ${variant} banner storage reservation was not found.`,
          };
        }

        if (
          reservation.creatorId !== calendar.managerId ||
          reservation.calendarId !== id ||
          reservation.fileKey !== fileKey
        ) {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The ${variant} banner storage reservation does not match this upload.`,
          };
        }

        if (reservation.status === "COMPLETED") {
          return { success: true, reservationId, fileKey, bytes: Number(reservation.bytes) };
        }
        if (reservation.status !== "PENDING") {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The ${variant} banner upload is no longer available.`,
          };
        }

        if (reservation.expiresAt <= new Date()) {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The ${variant} banner upload has expired. Please upload it again.`,
          };
        }

        const actualSize = await getObjectSize(fileKey);
        const reservedBytes = Number(reservation.bytes);

        if (
          !Number.isSafeInteger(reservedBytes) ||
          reservedBytes <= 0
        ) {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The ${variant} banner has an invalid storage reservation.`,
          };
        }

        if (actualSize !== reservedBytes) {
          return {
            success: false,
            reservationId,
            fileKey,
            bytes: 0,
            error:
              `The uploaded ${variant} banner size does not match the reserved storage amount.`,
          };
        }

        return {
          success: true,
          reservationId,
          fileKey,
          bytes: actualSize,
        };
      } catch (error) {
        console.error(
          `Failed to verify ${variant} banner upload:`,
          error
        );

        return {
          success: false,
          reservationId,
          fileKey,
          bytes: 0,
          error:
            `Failed to verify the uploaded ${variant} banner.`,
        };
      }
    };

    const desktopResult =
      await verifyBannerUpload(
        desktopReservationId,
        newDesktopBanner,
        "desktop"
      );

    if (!desktopResult.success) {
      return NextResponse.json(
        {
          error: desktopResult.error,
        },
        { status: 400 }
      );
    }

    const mobileResult =
      await verifyBannerUpload(
        mobileReservationId,
        newMobileBanner,
        "mobile"
      );

    if (!mobileResult.success) {
      return NextResponse.json(
        {
          error: mobileResult.error,
        },
        { status: 400 }
      );
    }

    /*
     * Finalize verified reservations and update the banner
     * references together in one database transaction.
     */
    const replayedVariants = new Set<string>();
    const committed = await db.$transaction(async (tx) => {
      // Serialize both banner reservations for this calendar in a stable order.
      const currentCalendars = await tx.$queryRaw<{ id: string; headerBannerDesktopUrl: string | null; headerBannerMobileUrl: string | null }[]>`SELECT id, "headerBannerDesktopUrl", "headerBannerMobileUrl" FROM "SocialCalendar" WHERE id = ${id} FOR UPDATE`;
      const currentCalendar = currentCalendars[0];
      if (!currentCalendar) throw new Error("Workspace not found.");

      // A stale form cannot reattach an old object without a still-valid receipt.
      for (const [requested, receipt, existing] of [
        [newDesktopBanner, desktopReservationId, currentCalendar.headerBannerDesktopUrl],
        [newMobileBanner, mobileReservationId, currentCalendar.headerBannerMobileUrl],
      ]) {
        if (requested && !receipt && requested !== existing) throw new Error("This banner has changed. Refresh before saving again.");
      }

      const finalizeReservation = async (
        reservationId: string | null,
        expectedFileKey: string | null,
        expectedBytes: number,
        variant: "desktop" | "mobile"
      ) => {
        if (
          !reservationId ||
          !expectedFileKey
        ) {
          return;
        }

        const reservation = await lockWorkspaceUploadReservation(tx, reservationId);

        if (!reservation) {
          throw new Error(
            "Storage reservation not found."
          );
        }

        if (
          reservation.creatorId !== calendar.managerId ||
          reservation.calendarId !== id ||
          reservation.fileKey !== expectedFileKey
        ) {
          throw new Error(
            "Storage reservation does not match this upload."
          );
        }

        if (reservation.status === "COMPLETED") {
          const currentKey = variant === "desktop" ? currentCalendar.headerBannerDesktopUrl : currentCalendar.headerBannerMobileUrl;
          if (currentKey !== expectedFileKey) throw new Error("This banner has changed. Refresh before saving again.");
          replayedVariants.add(variant);
          return;
        }
        if (reservation.status !== "PENDING") {
          throw new Error(
            "Storage reservation is no longer pending."
          );
        }

        if (!reservation.live) {
          throw new Error(
            "Storage reservation has expired."
          );
        }

        const bytes = Number(reservation.bytes);

        if (
          !Number.isSafeInteger(bytes) ||
          bytes <= 0 ||
          bytes !== expectedBytes
        ) {
          throw new Error(
            "Storage reservation accounting is inconsistent."
          );
        }

        const usage = await tx.contentWorkspaceUsage.updateMany({
          where: { creatorId: calendar.managerId, storageReservedBytes: { gte: reservation.bytes } },
          data: { storageReservedBytes: { decrement: reservation.bytes }, storageBytes: { increment: reservation.bytes } },
        });
        if (usage.count !== 1) throw new Error("Storage reservation accounting is inconsistent.");

        await tx.contentWorkspaceStorageReservation.update({
          where: {
            id: reservationId,
          },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      };

      await finalizeReservation(
        desktopResult.reservationId,
        desktopResult.fileKey,
        desktopResult.bytes,
        "desktop"
      );

      await finalizeReservation(
        mobileResult.reservationId,
        mobileResult.fileKey,
        mobileResult.bytes,
        "mobile"
      );

      const updated = await tx.socialCalendar.update({
        where: {
          id,
        },
        data: {
          headerBannerDesktopUrl:
            newDesktopBanner,

          headerBannerMobileUrl:
            newMobileBanner,

          headerTitle:
            headerTitle !== undefined
              ? headerTitle?.trim() || null
              : undefined,

          headerDescription:
            headerDescription !== undefined
              ? headerDescription?.trim() || null
              : undefined,
        },
      });
      const oldBanners = [
        ...(newDesktopBanner !== undefined && currentCalendar.headerBannerDesktopUrl && currentCalendar.headerBannerDesktopUrl !== newDesktopBanner ? [{ fileKey: currentCalendar.headerBannerDesktopUrl, bytes: BigInt(0) }] : []),
        ...(newMobileBanner !== undefined && currentCalendar.headerBannerMobileUrl && currentCalendar.headerBannerMobileUrl !== newMobileBanner ? [{ fileKey: currentCalendar.headerBannerMobileUrl, bytes: BigInt(0) }] : []),
      ];
      await queueWorkspaceStorageCleanup(tx, calendar.managerId, id, oldBanners);
      return { updated, previous: currentCalendar };
    });
    const updated = committed.updated;

    return NextResponse.json({
      calendar: updated,
    });
  }

  return NextResponse.json(
    { error: "Unknown action" },
    { status: 400 }
  );
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
//
// Deletes the marketing workspace and its content.
//
// IMPORTANT:
// Calendar billing is account-level. Deleting one workspace
// must NOT cancel the creator's calendar subscription because
// the creator may have other marketing workspaces covered by
// the same subscription.
//
// Billing remains attached to the Creator account.
// ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/route.ts#DELETE@574",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const calendar = await db.socialCalendar.findUnique({
    where: { id },
    include: {
      posts: {
        include: {
          assets: true,
        },
      },
    },
  });

  if (!calendar || calendar.managerId !== creator.id) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 }
    );
  }

  try {
    return NextResponse.json(await removeWorkspaceContent({ actorId: creator.id, mode: "workspace", calendarId: id }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceDeletionConflict ? error.message : "Unable to delete this workspace. Please retry." }, { status: error instanceof WorkspaceDeletionConflict ? 409 : 500 });
  }
}
