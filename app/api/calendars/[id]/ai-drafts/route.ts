import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import { hasCalendarPermission } from "@/lib/calendarPermissions";

// GET — every AI-generated post on this calendar still awaiting the
// manager's review. Manager-only, same as everything else touching
// drafts — a collaborator with lesser access shouldn't be the one
// deciding whether AI content is good enough to show the client.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!(await hasCalendarPermission(creator.id, id, "EDIT_CALENDAR"))) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to view drafts on this calendar",
        },
        { status: 403 }
      );
    }

    const drafts = await db.calendarPost.findMany({
      where: {
        calendarId: id,
        isAiDraft: true,
      },
      orderBy: {
        postDate: "asc",
      },
      include: {
        assets: {
          orderBy: {
            displayOrder: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        ...d,
        assets: d.assets.map((a) => ({
          ...a,
          sizeBytes: typeof a.sizeBytes === "bigint" ? Number(a.sizeBytes) : a.sizeBytes,
          contentUrl: publicUrlFor(a.fileKey),
          posterUrl: a.posterFileKey ? publicUrlFor(a.posterFileKey) : null,
        })),
      })),
    });
  } catch (error) {
    console.error("[GET /api/calendars/[id]/ai-drafts] Failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load drafts",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE — permanently removes all AI drafts still awaiting review
// on this calendar in one database operation.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/ai-drafts/route.ts#DELETE@62",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  if (!(await hasCalendarPermission(creator.id, id, "EDIT_CALENDAR"))) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to remove drafts on this calendar",
      },
      { status: 403 }
    );
  }

  const result = await db.calendarPost.deleteMany({
    where: {
      calendarId: id,
      isAiDraft: true,
    },
  });

  return NextResponse.json({
    ok: true,
    deletedCount: result.count,
  });
}