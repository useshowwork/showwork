import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyViewerToken } from "@/lib/auth";
import { getSocialInbox } from "@/lib/socialInbox";

function cookieNameFor(calendarId: string) { return `calendar_viewer_${calendarId}`; }

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { slug }, select: { id: true, planStatus: true } });
  if (!calendar) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const token = req.cookies.get(cookieNameFor(calendar.id))?.value;
  if (!token || !verifyViewerToken(token, calendar.id)) return NextResponse.json({ error: "Unlock this marketing workspace first." }, { status: 401 });
  const settings = await db.socialInboxSettings.findUnique({ where: { calendarId: calendar.id }, select: { clientAccessEnabled: true } });
  if (settings?.clientAccessEnabled === false) return NextResponse.json({ error: "The manager hasn’t shared the inbox with this client." }, { status: 403 });
  try {
    const inbox = await getSocialInbox(calendar.id, req.nextUrl.searchParams);
    return NextResponse.json({
      ...inbox,
      conversations: inbox.conversations.map(({ deliveryChecks: _checks, aiPausedAt: _paused, aiHandoffReason: _reason, aiHandoffAcknowledgedAt: _acknowledged, ...conversation }) => ({
        ...conversation,
        messages: conversation.messages.map(({ autoReplyHandoffReason: _handoff, sendError: _error, ...message }) => message),
      })),
      settings: { clientAccessEnabled: true, aiAutoReplyEnabled: false, aiAutoReplyInstructions: null },
    });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the inbox." }, { status: 400 }); }
}
