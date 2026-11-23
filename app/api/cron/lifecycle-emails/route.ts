import { NextRequest, NextResponse } from "next/server";
import { runLifecycleEmailCheck } from "@/lib/lifecycleEmails";

// Retired campaign. Keep the authenticated URL safe for existing schedulers.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runLifecycleEmailCheck();

  return NextResponse.json(summary);
}