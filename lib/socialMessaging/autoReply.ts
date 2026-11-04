import { getBusinessKnowledgeContext } from "@/lib/knowledge/context";
import { requiredHandoffReason, handoffSocialConversation } from "@/lib/socialMessaging/handoff";
import { deliverHandoffNotifications } from "@/lib/socialMessaging/handoffNotifications";
import { consumeCalendarAiGeneration } from "@/lib/contentWorkspaceUsage";
import { canUseCalendarFeature } from "@/lib/calendarPermissions";
import { normalizeReplyProfile } from "@/lib/socialMessaging/replyProfile";
import { db } from "@/lib/db";
import { generateSocialInboxAutoReply } from "@/lib/openai";
import { sendSocialInboxMessage, supportsMessaging } from "@/lib/socialMessaging/registry";
import { whatsappAutoReplyHandoff } from "@/lib/socialMessaging/whatsapp";

const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

async function processSocialInboxAutoRepliesInternal(messageIds?: string[]) {
  let targetCalendarIds: string[] | undefined;
  if (messageIds) {
    const pending = await db.socialLeadMessage.findMany({
      where: { id: { in: messageIds }, direction: "INBOUND", autoReplyEligible: true, autoReplyHandledAt: null },
      select: { conversation: { select: { calendarId: true } } },
    });
    targetCalendarIds = [...new Set(pending.map((message) => message.conversation.calendarId))];
    if (!targetCalendarIds.length) return { workspaces: 0, analyzed: 0, sent: 0, handedOff: 0, failed: 0 };
  }
  const settings = await db.socialInboxSettings.findMany({
    where: { aiAutoReplyEnabled: true, ...(targetCalendarIds ? { calendarId: { in: targetCalendarIds } } : {}) },
    select: { calendarId: true },
  });
  const summary = { workspaces: settings.length, analyzed: 0, sent: 0, handedOff: 0, failed: 0 };
  for (const { calendarId } of settings) {
    // Re-evaluate the owner at execution time; never discard queued trial data.
    if (!(await canUseCalendarFeature(calendarId, "aiAutoReplies"))) continue;
    const queue = await db.socialLeadMessage.findMany({
      where: {
        direction: "INBOUND",
        ...(messageIds ? { id: { in: messageIds } } : {}),
        autoReplyEligible: true,
        autoReplyHandledAt: null,
        autoReplyAttemptCount: { lt: 3 },
        conversation: { calendarId },
      },
      orderBy: { platformCreatedAt: "asc" },
      take: 10,
      include: {
        conversation: {
          include: {
            connection: true,
            calendar: { select: { clientName: true, aiBusinessSummary: true, instagramPageId: true } },
            messages: { orderBy: [{ platformCreatedAt: "desc" }, { createdAt: "desc" }], take: 20 },
          },
        },
      },
    });
    for (const inbound of queue) {
      const processingStartedAt = Date.now();
      const queueWaitMs = inbound.createdAt ? Math.max(0, processingStartedAt - inbound.createdAt.getTime()) : null;
      let generationMs = 0;
      let deliveryMs = 0;
      const now = new Date();
      const claimed = await db.socialLeadMessage.updateMany({
        where: {
          id: inbound.id,
          autoReplyHandledAt: null,
          autoReplyAttemptCount: { lt: 3 },
          OR: [{ autoReplyClaimedAt: null }, { autoReplyClaimedAt: { lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } }],
        },
        data: { autoReplyClaimedAt: now, autoReplyAttemptCount: { increment: 1 }, sendError: null },
      });
      if (!claimed.count) continue;
      summary.analyzed++;
      let sendAttempted = false;
      let controlVersion: number | undefined;
      const retire = async (reason: string) => {
        await db.socialLeadMessage.update({ where: { id: inbound.id }, data: { autoReplyHandledAt: new Date(), autoReplyClaimedAt: null, autoReplyHandoffReason: reason } });
      };
      const handoff = async (reason: string) => {
        // Pause first: a persistence failure must never leave automation running.
        await handoffSocialConversation(inbound.conversationId, reason, controlVersion);
        await retire(reason);
      };
      try {
        const control = await db.socialLeadConversation.findUniqueOrThrow({ where: { id: inbound.conversationId }, select: { aiPausedAt: true, aiControlVersion: true } });
        controlVersion = control.aiControlVersion;
        if (control.aiPausedAt) {
          await retire("AI is paused while a team member handles this conversation.");
          summary.handedOff++;
          continue;
        }
        const detectedHandoff = requiredHandoffReason(inbound.text);
        if (inbound.conversation.platform === "WHATSAPP") {
          const reason = await whatsappAutoReplyHandoff(inbound);
          if (reason) {
            if (reason.includes("reply window closed")) await handoff(reason);
            else await retire(reason);
            summary.handedOff++;
            continue;
          }
        }
        // Do not answer an older message after the customer has moved on or
        // the team has already responded. The latest message includes the
        // earlier customer messages in its conversation context.
        const targetIndex = inbound.conversation.messages.findIndex(message => message.id === inbound.id);
        const supersedingMessage = inbound.conversation.messages.find((message, index) =>
          message.id !== inbound.id && (message.platformCreatedAt > inbound.platformCreatedAt || (message.platformCreatedAt.getTime() === inbound.platformCreatedAt.getTime() && (targetIndex === -1 || index < targetIndex))) &&
          (message.direction === "INBOUND" || ["PENDING", "SENT", "DELIVERED", "READ"].includes(message.status)));
        if (supersedingMessage) {
          await db.socialLeadMessage.update({ where: { id: inbound.id }, data: { autoReplyHandledAt: new Date(), autoReplyClaimedAt: null, autoReplyHandoffReason: supersedingMessage.direction === "OUTBOUND" ? "This conversation already received a reply." : "A newer customer message superseded this reply." } });
          summary.handedOff++;
          continue;
        }
        const recent = [...inbound.conversation.messages].reverse().map((message) => ({
          direction: message.direction,
          text: message.text.slice(0, 2000),
          createdAt: message.platformCreatedAt.toISOString(),
        }));
        const replySettings = await db.socialInboxSettings.findUnique({ where: { calendarId }, select: { aiAutoReplyInstructions: true, aiReplyProfile: true } });
        const quota = await consumeCalendarAiGeneration(calendarId);
        if (!quota.allowed) {
          // Exhaustion pauses the queue without retiring messages or consuming retry attempts.
          await db.socialLeadMessage.update({ where: { id: inbound.id }, data: {
            autoReplyClaimedAt: null, autoReplyAttemptCount: { decrement: 1 },
          } });
          continue;
        }
        const generationStartedAt = Date.now();
        const generated = await generateSocialInboxAutoReply({
          clientName: inbound.conversation.calendar.clientName,
          businessSummary: await getBusinessKnowledgeContext(calendarId, recent.map(m => m.text).join("\n") + "\n" + inbound.text, "reply"),
          instructions: replySettings?.aiAutoReplyInstructions ?? null,
          profile: normalizeReplyProfile(replySettings?.aiReplyProfile),
          platform: inbound.conversation.platform,
          participantName: inbound.conversation.participantName,
          conversation: recent,
          latestInbound: inbound.text.slice(0, 3000),
          detectedHandoffReason: detectedHandoff,
        });
        generationMs = Date.now() - generationStartedAt;
        if (!generated.shouldReply || !generated.replyText || !inbound.conversation.connection || !supportsMessaging(inbound.conversation.platform)) {
          await handoff(generated.handoffReason || detectedHandoff || "This message needs a human response.");
          summary.handedOff++;
          continue;
        }
        const latestSettings = await db.socialInboxSettings.findUnique({ where: { calendarId }, select: { aiAutoReplyEnabled: true } });
        if (!(await canUseCalendarFeature(calendarId, "aiAutoReplies"))) {
          await db.socialLeadMessage.update({ where: { id: inbound.id }, data: { autoReplyClaimedAt: null } });
          continue;
        }
        if (!latestSettings?.aiAutoReplyEnabled) {
          await db.socialLeadMessage.update({ where: { id: inbound.id }, data: { autoReplyHandledAt: new Date(), autoReplyClaimedAt: null, autoReplyHandoffReason: "Automatic replies were disabled before the reply was sent." } });
          summary.handedOff++;
          continue;
        }
        if (inbound.conversation.platform === "WHATSAPP") {
          const reason = await whatsappAutoReplyHandoff(inbound);
          if (reason) {
            if (reason.includes("reply window closed")) await handoff(reason);
            else await retire(reason);
            summary.handedOff++;
            continue;
          }
        }
        // Re-read after generation: staff takeover/resume invalidates an in-flight draft.
        const beforeSend = await db.socialLeadConversation.findUniqueOrThrow({ where: { id: inbound.conversationId }, select: { aiPausedAt: true, aiControlVersion: true } });
        const newerMessage = await db.socialLeadMessage.findFirst({ where: { conversationId: inbound.conversationId, id: { not: inbound.id }, createdAt: { gt: inbound.createdAt }, OR: [{ direction: "INBOUND" }, { direction: "OUTBOUND", status: { in: ["PENDING", "SENT", "DELIVERED", "READ"] } }] }, select: { id: true } });
        if (beforeSend.aiPausedAt || beforeSend.aiControlVersion !== control.aiControlVersion || newerMessage) {
          await retire("Conversation changed while the reply was being prepared; this draft was cancelled.");
          summary.handedOff++;
          continue;
        }
        sendAttempted = true;
        const deliveryStartedAt = Date.now();
        const providerMessageId = await sendSocialInboxMessage({
          connection: inbound.conversation.connection,
          conversationId: inbound.conversation.providerConversationId,
          instagramPageId: inbound.conversation.calendar.instagramPageId,
          recipientId: inbound.conversation.participantPlatformId,
          text: generated.replyText,
        });
        deliveryMs = Date.now() - deliveryStartedAt;
        const sentAt = new Date();
        await db.$transaction(async (tx) => {
          if (providerMessageId) {
            await tx.socialLeadMessage.createMany({
              data: [{ conversationId: inbound.conversationId, providerMessageId, direction: "OUTBOUND", status: "SENT", text: generated.replyText, platformCreatedAt: sentAt, isAiGenerated: true }],
              skipDuplicates: true,
            });
          } else {
            await tx.socialLeadMessage.create({ data: { conversationId: inbound.conversationId, direction: "OUTBOUND", status: "SENT", text: generated.replyText, platformCreatedAt: sentAt, isAiGenerated: true } });
          }
          await tx.socialLeadMessage.update({ where: { id: inbound.id }, data: { autoReplyHandledAt: sentAt, autoReplyClaimedAt: null, autoReplyHandoffReason: generated.handoffReason } });
          await tx.socialLeadConversation.update({ where: { id: inbound.conversationId }, data: { lastMessageAt: sentAt, lastMessagePreview: generated.replyText.slice(0, 500) } });
        });
        if (generated.handoffNeeded || detectedHandoff) {
          const finalReason = generated.handoffReason || detectedHandoff || "A team member needs to guide the next step.";
          await handoffSocialConversation(inbound.conversationId, finalReason, beforeSend.aiControlVersion);
          summary.handedOff++;
        } else {
          summary.sent++;
        }
        // Aggregate timings only; no customer text, credentials, or account IDs.
        console.info("Social inbox AI reply timing", {
          platform: inbound.conversation.platform,
          queueWaitMs,
          generationMs, deliveryMs,
          processingMs: Date.now() - processingStartedAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automatic reply could not be sent.";
        const isLastAttempt = sendAttempted || inbound.autoReplyAttemptCount + 1 >= 3;
        if (isLastAttempt) await handoffSocialConversation(inbound.conversationId, sendAttempted
          ? "Reply delivery could not be confirmed. Check the platform inbox before replying again."
          : "Automatic replies failed repeatedly. A team member needs to take over.", controlVersion);
        await db.socialLeadMessage.update({
          where: { id: inbound.id },
          data: {
            autoReplyClaimedAt: null,
            ...(isLastAttempt ? { autoReplyHandledAt: new Date(), autoReplyHandoffReason: sendAttempted ? "Reply delivery could not be recorded or confirmed. Check the platform inbox before replying again." : "Automatic reply failed repeatedly; a human needs to take over." } : {}),
            sendError: message.slice(0, 1500),
          },
        });
        summary.failed++;
        console.error(`Social inbox auto-reply failed for message ${inbound.id}:`, error);
      }
    }
  }
  return summary;
}

export async function processSocialInboxAutoReply(messageId: string) {
  return processSocialInboxAutoReplies([messageId]);
}

export async function processSocialInboxAutoReplies(messageIds?: string[]) {
  try { return await processSocialInboxAutoRepliesInternal(messageIds); }
  finally { await deliverHandoffNotifications().catch(() => console.error("Inbox handoff email queue could not run; scheduled worker will retry.")); }
}
