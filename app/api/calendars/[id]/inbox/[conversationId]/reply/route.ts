import { visibleInboxConnection } from "@/lib/socialMessaging/visibility";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { canAccessCalendarById, hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { sendSocialInboxMessage, supportsMessaging } from "@/lib/socialMessaging/registry";
import { InboxSendConflict, reconcileStaleInboxSends, sendDurableInboxReply, UNCONFIRMED_REPLY } from "@/lib/socialMessaging/outbound";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; conversationId: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId, conversationId } = await params;
  if (!(await hasCalendarPermission(creator.id, calendarId, "inbox.reply"))) return NextResponse.json({ error: "You don’t have permission to reply." }, { status: 403 });
  if (!(await canAccessCalendarById(calendarId))) return NextResponse.json({ error: "This workspace isn’t active." }, { status: 403 });
  const featureLock = await calendarFeatureGate(calendarId, "socialInbox");
  if (featureLock) return featureLock;

  const body = await req.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 2000) return NextResponse.json({ error: "Enter a reply of 1–2,000 characters." }, { status: 400 });
  const conversation = await db.socialLeadConversation.findFirst({
    where: { id: conversationId, calendarId, ...visibleInboxConnection },
    include: { connection: true, calendar: { select: { instagramPageId: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (!conversation.connection || !supportsMessaging(conversation.platform)) {
    return NextResponse.json({ error: "Replies are not available for this platform connection yet." }, { status: 409 });
  }
  const operationKey = req.headers.get("idempotency-key")?.trim();
  if (!operationKey || operationKey.length > 200) return NextResponse.json({ error: "A send operation ID is required. Refresh the inbox and try again." }, { status: 400 });
  try {
    await reconcileStaleInboxSends(calendarId);
    const operation = await sendDurableInboxReply({
      conversationId, operationKey, text, actorId: creator.id, takeover: true,
      send: () => sendSocialInboxMessage({ connection: conversation.connection!, instagramPageId: conversation.calendar.instagramPageId, recipientId: conversation.participantPlatformId, conversationId: conversation.providerConversationId, text }),
    });
    if (operation.state === "UNCONFIRMED") return NextResponse.json({ error: UNCONFIRMED_REPLY, code: "SEND_UNCONFIRMED" }, { status: 409 });
    if (operation.state === "CANCELLED") return NextResponse.json({ error: "The reply was cancelled before delivery.", code: "SEND_CANCELLED" }, { status: 409 });
    if (operation.state !== "SENT") return NextResponse.json({ error: "This reply is still being sent. Check its status before trying again.", code: "SEND_PENDING" }, { status: 409 });
    const message = await db.socialLeadMessage.findUniqueOrThrow({ where: { id: operation.messageId } });
    return NextResponse.json({ message: { id: message.id, direction: message.direction, status: message.status, text: message.text, platformCreatedAt: message.platformCreatedAt.toISOString(), isAiGenerated: false } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InboxSendConflict ? error.message : "Could not confirm this reply. Refresh the inbox and check its delivery status before sending again." }, { status: error instanceof InboxSendConflict ? 409 : 503 });
  }
}
