import { enqueueReportingSync, runNextReportingJob } from "@/lib/reporting/jobs";
import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { getCalendarReportingData } from "@/lib/reporting/data";

export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "analytics.view"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Saved reporting stays readable after expiry; premium actions are separately gated.
  try {
    const report = await getCalendarReportingData(id, req.nextUrl.searchParams, true, await hasCalendarPermission(creator.id, id, "leads.view"));
    let updating = false;
    let updateUnavailable = false;
    try {
      const update = await enqueueReportingSync(id);
      updating = update.queued;
      if (updating) after(async () => { await runNextReportingJob(id).catch(() => console.warn("REPORTING_DRAIN_DEFERRED")); });
    } catch { updateUnavailable = true; }
    return NextResponse.json({ ...report, updating, updateUnavailable }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load reporting." }, { status: 400 });
  }
}
