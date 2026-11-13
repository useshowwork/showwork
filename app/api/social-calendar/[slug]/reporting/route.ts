import { enqueueReportingSync, runNextReportingJob } from "@/lib/reporting/jobs";
import { complimentaryAccessSelect } from "@/lib/complimentaryAccess";
import { after, NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyViewerToken } from "@/lib/auth";
import { getCalendarReportingData, reportingPeriod } from "@/lib/reporting/data";
import { canAccessCalendar } from "@/lib/calendarPermissions";

function cookieNameFor(calendarId: string) {
  return `calendar_viewer_${calendarId}`;
}

export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    reportingPeriod(req.nextUrl.searchParams);
    const platforms = req.nextUrl.searchParams.getAll("platform").flatMap(value => value.split(",")).filter(Boolean).map(value => value.toUpperCase());
    if (platforms.some(platform => !["INSTAGRAM", "TIKTOK", "FACEBOOK", "LINKEDIN", "X", "YOUTUBE"].includes(platform))) {
      return NextResponse.json({ error: "Choose a supported social platform." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Choose a valid reporting date range." }, { status: 400 });
  }

  try {
    const { slug } = await params;
    const calendar = await db.socialCalendar.findUnique({
      where: { slug },
      select: {
        id: true,
        manager: {
          select: {
            id: true,
            contentWorkspacePlan: true,
            contentWorkspaceBillingStatus: true,
            contentWorkspaceBillingCycle: true,
            contentWorkspaceTrialEndsAt: true,
            ...complimentaryAccessSelect, isComped: true,
            compedUntil: true,
          },
        },
      },
    });
    if (!calendar) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const token = req.cookies.get(cookieNameFor(calendar.id))?.value;
    if (!token || !verifyViewerToken(token, calendar.id)) {
      return NextResponse.json({ error: "Please unlock this workspace first." }, { status: 401 });
    }
    if (!canAccessCalendar(calendar.manager)) {
      return NextResponse.json({ error: "This workspace isn’t active." }, { status: 403 });
    }
    const report = await getCalendarReportingData(calendar.id, req.nextUrl.searchParams, false, false, true);
    let updating = false;
    let updateUnavailable = false;
    try {
      const update = await enqueueReportingSync(calendar.id);
      updating = update.queued;
      if (updating) after(async () => { await runNextReportingJob(calendar.id).catch(() => console.warn("REPORTING_DRAIN_DEFERRED")); });
    } catch { updateUnavailable = true; }
    return NextResponse.json({ ...report, updating, updateUnavailable }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(String(code))) {
      return NextResponse.json(
        { error: "Reporting is temporarily unavailable because the database connection failed. Please try refreshing in a moment." },
        { status: 503, headers: { "Retry-After": "10" } },
      );
    }
    console.error("Could not load client reporting:", { code });
    return NextResponse.json({ error: "Could not load reporting. Please try again." }, { status: 500 });
  }
}
