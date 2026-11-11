import { NextRequest, NextResponse } from "next/server";
import { runLifecycleEmailCheck } from "@/lib/lifecycleEmails";

// Existing scheduler URL retained. Poll daily (or hourly for larger audiences);
// the durable per-recipient reservation permits at most one campaign each 7 days.
// No welcome, portfolio, delivery, community or separate trial drip is sent here.
// The one-time product welcome is sent separately after successful signup.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runLifecycleEmailCheck();

  return NextResponse.json(summary);
}