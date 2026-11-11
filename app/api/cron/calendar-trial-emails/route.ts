import { NextRequest, NextResponse } from "next/server";
import { runCalendarTrialEmailCheck } from "@/lib/calendarTrialEmails";

// Retired scheduler URL: authenticated calls return a disabled summary without
// sending mail. Remove the separate trial-email schedule from the VPS.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runCalendarTrialEmailCheck();

  return NextResponse.json(summary);
}