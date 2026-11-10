import { after, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission, canAccessCalendarById } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { enqueueReportingSync, runNextReportingJob } from "@/lib/reporting/jobs";

export const maxDuration = 300;
const headers = { "Cache-Control": "no-store, private" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "analytics.view"))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const jobs = await db.reportingSyncJob.findMany({ where: { calendarId: id, connection: { status: "CONNECTED" } }, select: { status: true } });
  return NextResponse.json({ completed: !jobs.some(job => ["PENDING", "RUNNING"].includes(job.status)), failed: jobs.filter(job => job.status === "FAILED").length }, { headers });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const automatic = new URL(req.url).searchParams.get("automatic") === "1";
  if (!(await hasCalendarPermission(creator.id, id, automatic ? "analytics.view" : "analytics.manage")) || !(await canAccessCalendarById(id))) {
    return NextResponse.json({ error: "This workspace is unavailable or you don’t have permission to update it." }, { status: 403 });
  }
  const result = await enqueueReportingSync(id, automatic ? "automatic" : "manual");
  // Opportunistic drain speeds up the first account; the durable cron processor recovers interruptions.
  if (result.queued) after(async () => { await runNextReportingJob(id).catch(() => console.warn("REPORTING_DRAIN_DEFERRED")); });
  return NextResponse.json({ ...result, queuedAt: new Date().toISOString() }, { status: result.queued ? 202 : 200, headers });
}
