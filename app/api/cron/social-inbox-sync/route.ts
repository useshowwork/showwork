import { NextRequest, NextResponse } from "next/server";
import { syncSocialInboxes } from "@/lib/socialMessaging/x";

export async function POST(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncSocialInboxes();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Social inbox sync job failed:", error);
    return NextResponse.json(
      { error: "Social inbox sync could not be completed." },
      { status: 500 }
    );
  }
}
