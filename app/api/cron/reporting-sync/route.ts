import { NextRequest, NextResponse } from "next/server";
import { runNextReportingJob, scheduleReportingSync } from "@/lib/reporting/jobs";

export const maxDuration = 300;

/** Call every minute from the VPS scheduler. No AI requests are made here. */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const queued = await scheduleReportingSync();
    let processed = 0;
    const deadline = Date.now() + 180_000;
    while (processed < 5 && Date.now() < deadline && await runNextReportingJob()) processed++;
    return NextResponse.json({ queued, processed }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("REPORTING_SCHEDULER_FAILED");
    return NextResponse.json({ error: "Reporting update could not be completed." }, { status: 500 });
  }
}
