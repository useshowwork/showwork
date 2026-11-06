import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { canAccessCalendarById } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeWorkspaceContent, WorkspaceDeletionConflict } from "@/lib/workspaceDeletion";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/reset/route.ts#POST@7",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { id }, select: { managerId: true } });
  if (!calendar) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  if (calendar.managerId !== creator.id) return NextResponse.json({ error: "Only the workspace owner can reset this calendar." }, { status: 403 });
  if (!(await canAccessCalendarById(id))) return NextResponse.json({ error: "This workspace is read-only. Subscribe or upgrade to resume editing." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (body?.confirmation !== "RESET") return NextResponse.json({ error: "Confirm the reset by typing RESET." }, { status: 400 });

  try {
    return NextResponse.json(await removeWorkspaceContent({ actorId: creator.id, mode: "reset", calendarId: id, removeBlocked: body.removeBlocked === true }));
  } catch (error) {
    if (error instanceof WorkspaceDeletionConflict) return NextResponse.json({ error: error.message, code: "PUBLISHING_BLOCKS_REMOVAL", blockingPosts: error.blockingPosts }, { status: 409 });
    console.error("Calendar reset failed");
    return NextResponse.json({ error: "The calendar could not be reset. Please try again." }, { status: 500 });
  }
}
