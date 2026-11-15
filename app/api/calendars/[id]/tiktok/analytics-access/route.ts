import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "channels.manage", "TIKTOK"))) return NextResponse.json({ error: "Channel access required." }, { status: 403 });
  const connection = await db.socialConnection.findFirst({
    where: { calendarId: id, platform: "TIKTOK", status: "CONNECTED" },
    select: { tokenScopes: true },
  });
  // Report the token response's actual grant, never the requested scope list.
  const granted = new Set((connection?.tokenScopes ?? "").split(/[\s,]+/));
  const missingScopes = ["user.info.basic", "user.info.stats", "video.list", "video.publish"].filter(scope => !granted.has(scope));
  return NextResponse.json({ connected: !!connection, analyticsGranted: !!connection && granted.has("user.info.stats") && granted.has("video.list"), missingScopes }, { headers: { "Cache-Control": "no-store" } });
}
