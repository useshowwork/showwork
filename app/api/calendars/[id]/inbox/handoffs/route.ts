import { visibleInboxConnection } from "@/lib/socialMessaging/visibility";
import { databaseUnavailable, retryDatabaseRead } from "@/lib/databaseAvailability";
import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await retryDatabaseRead(async () => {
  const creator = await getCurrentCreator({ throwOnDatabaseUnavailable: true });
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "inbox.view"))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const count = await db.socialLeadConversation.count({ where: { calendarId: id, ...visibleInboxConnection, aiPausedAt: { not: null }, aiHandoffAcknowledgedAt: null } });
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store, private" } });
  }); } catch(error) {
    if (!databaseUnavailable(error)) throw error;
    console.warn("DATABASE_TEMPORARILY_UNAVAILABLE", { endpoint: "inbox_handoffs", code: (error as {code?:string}).code });
    return NextResponse.json({code:"DATABASE_TEMPORARILY_UNAVAILABLE",error:"The database is temporarily unavailable. Please wait; this does not mean your generation failed."},{status:503,headers:{"Retry-After":"15","Cache-Control":"no-store, private"}});
  }

}
