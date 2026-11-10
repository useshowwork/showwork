import { visibleInboxConnection } from "@/lib/socialMessaging/visibility";
import { maskSensitiveText } from "@/lib/socialMessaging/safety";
import { getBusinessKnowledgeContext } from "@/lib/knowledge/context";
import { consumeCalendarAiGeneration } from "@/lib/contentWorkspaceUsage";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import {
  canAccessCalendarById,
  hasCalendarPermission,
} from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { generateSocialInboxAutoReply } from "@/lib/openai";
import {
  isReplyTone,
  normalizeReplyProfile,
} from "@/lib/socialMessaging/replyProfile";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> },
) {
  const creator = await getCurrentCreator();
  if (!creator)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId, conversationId } = await params;
  if (!(await hasCalendarPermission(creator.id, calendarId, "inbox.reply")))
    return NextResponse.json(
      { error: "You don’t have permission to draft replies." },
      { status: 403 },
    );
  if (!(await canAccessCalendarById(calendarId)))
    return NextResponse.json(
      { error: "This workspace isn’t active." },
      { status: 403 },
    );
  const body = await req.json().catch(() => null);
  if (
    !body ||
    !isReplyTone(body.tone) ||
    typeof body.context !== "string" ||
    body.context.length > 2000 ||
    typeof body.currentDraft !== "string" ||
    body.currentDraft.length > 2000
  )
    return NextResponse.json(
      {
        error:
          "Choose a reply tone and keep reply context and draft under 2,000 characters each.",
      },
      { status: 400 },
    );
  const featureLock = await calendarFeatureGate(calendarId, "aiInboxReplies");
  if (featureLock) return featureLock;

  const conversation = await db.socialLeadConversation.findFirst({
    where: { id: conversationId, calendarId, ...visibleInboxConnection },
    include: {
      calendar: { select: { clientName: true, aiBusinessSummary: true } },
      messages: { orderBy: { platformCreatedAt: "desc" }, take: 20 },
    },
  });
  if (!conversation)
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  if (conversation.providerConversationId.startsWith("xchat:"))
    return NextResponse.json(
      { error: "Encrypted X conversations are not used for AI replies." },
      { status: 400 },
    );
  const inbound = conversation.messages.find(
    (message) => message.direction === "INBOUND",
  );
  if (!inbound)
    return NextResponse.json(
      { error: "There is no customer message to reply to yet." },
      { status: 400 },
    );
  const settings = await db.socialInboxSettings.findUnique({
    where: { calendarId },
  });
  const profile = {
    ...normalizeReplyProfile(settings?.aiReplyProfile),
    tone: body.tone,
  };
  const quota = await consumeCalendarAiGeneration(calendarId);
  if (!quota.allowed) return NextResponse.json({ error: `Your monthly AI allowance of ${quota.limit} is unavailable or used up. Upgrade your plan or wait for your next monthly allowance.`, code: "AI_GENERATION_LIMIT_REACHED" }, { status: 403 });
  try {
    const draft = await generateSocialInboxAutoReply({
      clientName: conversation.calendar.clientName,
      businessSummary: await getBusinessKnowledgeContext(calendarId, maskSensitiveText(conversation.messages.map(m => m.text).join("\n") + "\n" + inbound.text + "\n" + body.context), "reply"),
      instructions: settings?.aiAutoReplyInstructions ?? null,
      profile,
      mode: "draft",
      platform: conversation.platform,
      participantName: conversation.participantName,
      operatorContext: body.context.trim(),
      currentDraft: body.currentDraft.trim(),
      conversation: [...conversation.messages]
        .reverse()
        .map((message) => ({
          direction: message.direction,
          text: message.text,
          createdAt: message.platformCreatedAt.toISOString(),
        })),
      latestInbound: inbound.text,
    });
    return NextResponse.json({
      ...draft,
      tone: profile.tone,
      sourceMessageId: inbound.id,
    });
  } catch (error) {
    console.error("Social inbox draft failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not prepare a reply. Try again or write your reply directly.",
      },
      { status: 502 },
    );
  }
}
