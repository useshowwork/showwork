import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { updateIdentityImage } from "@/lib/identityImages";

async function changeLogo(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await hasCalendarPermission(creator.id, id, "workspace.manage")) {
    return NextResponse.json({ error: "You can't change this workspace logo." }, { status: 403 });
  }

  const workspace = await db.socialCalendar.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  return updateIdentityImage(request, `calendars/${id}/logos/`, workspace.logoUrl, async (logoUrl) => {
    if (!await hasCalendarPermission(creator.id, id, "workspace.manage")) return false;
    const result = await db.socialCalendar.updateMany({
      where: { id, logoUrl: workspace.logoUrl },
      data: { logoUrl },
    });
    return result.count === 1;
  });
}

export { changeLogo as POST, changeLogo as DELETE };
