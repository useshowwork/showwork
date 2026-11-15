import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { getContentWorkspaceUsage } from "@/lib/contentWorkspaceUsage";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const creator = await getCurrentCreator();
  if (!creator)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "inbox.view")))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const calendar = await db.socialCalendar.findUnique({
    where: { id },
    include: { manager: true },
  });
  if (calendar?.manager.contentWorkspacePlan !== "ENGAGE")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const usage = await getContentWorkspaceUsage(calendar.manager);
  return NextResponse.json(
    {
      remaining: usage.aiGenerationsRemaining,
      limit: usage.aiGenerationLimit,
      active: usage.hasAccess,
      trialEndsAt:
        calendar.manager.contentWorkspaceBillingStatus === "TRIAL"
          ? (calendar.manager.contentWorkspaceTrialEndsAt?.toISOString() ??
            null)
          : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
