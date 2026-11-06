import { randomUUID } from 'node:crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { getCurrentCreator } from '@/lib/auth';
import { hasCalendarPermission, canAccessCalendarById, calendarFeatureGate } from '@/lib/calendarPermissions';
import { db } from '@/lib/db';
import { finishBusinessChat } from '@/lib/knowledge/randy/service';
import { researchRequested, isAffirmativeGoAhead, type BusinessChatAnswer } from '@/lib/knowledge/randy/answer';
export const runtime = 'nodejs';
export const maxDuration = 240;
type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'no-store, private' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
async function access(id: string) {
 const creator = await getCurrentCreator();
 if (!creator || !await hasCalendarPermission(creator.id, id, 'knowledge.view')) return null;
 return creator;
}
export async function GET(req: NextRequest, { params }: Context) {
 const { id } = await params; const creator = await access(id);
 if (!creator) return reply({ error: 'Access denied.' }, 403);
 const featureGate = await calendarFeatureGate(id, 'randyStudio');
 if (featureGate) return featureGate;
 try {
  const conversationId = req.nextUrl.searchParams.get('conversation');
  if (conversationId) {
   const conversation = await db.workspaceRandyConversation.findFirst({ where: { id: conversationId, calendarId: id, creatorId: creator.id } });
   if (!conversation) return reply({ error: 'Conversation not found.' }, 404);
   const messages = await db.workspaceRandyMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 100 });
   const interrupted = !!conversation.processingAt && Date.now() - conversation.processingAt.getTime() > 5 * 60000;
   return reply({ conversation, messages, interrupted });
  }
  const conversations = await db.workspaceRandyConversation.findMany({ where: { calendarId: id, creatorId: creator.id }, orderBy: { updatedAt: 'desc' }, take: 40, select: { id: true, title: true, updatedAt: true, processingAt: true } });
  return reply({ conversations });
 } catch { return reply({ error: 'Randy is unavailable. Check that the Randy database migration has been applied.' }, 503); }
}
export async function POST(req: NextRequest, { params }: Context) {
 const { id } = await params; const creator = await access(id);
 if (!creator || !await canAccessCalendarById(id)) return reply({ error: 'An active workspace and knowledge access are required.' }, 403);
 const featureGate = await calendarFeatureGate(id, 'randyStudio');
 if (featureGate) return featureGate;
 if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return reply({ error: 'Open Randy from Showwork.' }, 403);
 if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'Send a JSON message.' }, 415);
 const reader = req.body?.getReader(); if (!reader) return reply({ error: 'Enter a message.' }, 400);
 const decoder = new TextDecoder(); let raw = '', size = 0;
 try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 20000) { await reader.cancel(); return reply({ error: 'Keep this message shorter.' }, 413); } raw += decoder.decode(value, { stream: true }); } raw += decoder.decode(); } catch { return reply({ error: 'Could not read this message.' }, 400); }
 let body; try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
 if (!body || typeof body !== 'object') return reply({ error: 'Invalid request.' }, 400);
 if (body.action !== undefined && !['chat', 'research', 'confirmKnowledge', 'confirmResearch'].includes(body.action)) return reply({ error: 'Unknown Randy action.' }, 400);
 const canManage = await hasCalendarPermission(creator.id, id, 'knowledge.manage');
 try {
  if (body.action === 'confirmKnowledge') {
   if (!canManage) return reply({ error: 'Only a knowledge manager can confirm this addition.' }, 403);
   if (typeof body.messageId !== 'string' || typeof body.conversationId !== 'string') return reply({ error: 'Choose a saved proposal.' }, 400);
   const saved = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WorkspaceRandyConversation" WHERE "id" = ${body.conversationId} AND "calendarId" = ${id} AND "creatorId" = ${creator.id} FOR UPDATE`;
    const conversation = await tx.workspaceRandyConversation.findFirst({ where: { id: body.conversationId, calendarId: id, creatorId: creator.id } });
    if (!conversation || conversation.processingAt) return false;
    const message = await tx.workspaceRandyMessage.findFirst({ where: { id: body.messageId, conversationId: conversation.id, role: 'assistant' } });
    const answer = message?.body as BusinessChatAnswer | undefined;
    const proposal = answer?.proposal;
    if (!message || !proposal) return false;
    if (message.knowledgeDocumentId) return true;
    const documentId = `randy:${message.id}`;
    await tx.calendarBusinessDocument.create({ data: { id: documentId, calendarId: id, originalName: `Randy · ${proposal.title}`, extractedText: `# Confirmed business addition\nConfirmed by workspace member ${creator.id} at ${new Date().toISOString()}\nThis addition does not automatically replace conflicting sources.\n\n${proposal.text}${answer?.sources?.length ? "\n\nSupporting sources (external findings remain hypotheses):\n" + answer.sources.map(source => source.title + (source.url ? " — " + source.url : "")).join("\n") : ""}` } });
    await tx.workspaceRandyMessage.update({ where: { id: message.id }, data: { knowledgeDocumentId: documentId } });
    return true;
   }, { timeout: 20000 });
   return reply(saved ? { saved: true } : { error: 'This proposal is unavailable or a reply is still in progress.' }, saved ? 200 : 409);
  }
  let approvedResearch = false;
  let autoSavedTitle = '';
  let researchFocusText = '';
  let pendingProposal: { id: string; title: string; text: string; sources?: import('@/lib/knowledge/randy/answer').RandySource[] } | null = null;
  if (body.action === 'confirmResearch') {
   if (!canManage || typeof body.conversationId !== 'string' || typeof body.messageId !== 'string') return reply({ error: 'Choose a research topic you can manage.' }, 403);
   const proposalMessage = await db.workspaceRandyMessage.findFirst({ where: { id: body.messageId, conversationId: body.conversationId, role: 'assistant', conversation: { calendarId: id, creatorId: creator.id } } });
   const proposal = proposalMessage?.body as BusinessChatAnswer | undefined;
   if (!proposal?.researchPlan || proposal.researchStarted) return reply({ error: 'Research topic is unavailable or already started.' }, 409);
   researchFocusText = proposal.researchPlan.focus; body.text = proposal.researchPlan.focus; approvedResearch = true;
  }
  if (!approvedResearch && body.conversationId && typeof body.text === 'string') {
   const userText = body.text.trim();
   if (isAffirmativeGoAhead(userText) && canManage) {
    const recentAssistantMsgs = await db.workspaceRandyMessage.findMany({
     where: { conversationId: body.conversationId, role: 'assistant' },
     orderBy: { createdAt: 'desc' },
     take: 5,
    });
    const lastAssistantMsg = recentAssistantMsgs[0];
    const planMsg = recentAssistantMsgs.find(m => {
     const p = m.body as BusinessChatAnswer | undefined;
     return p?.researchPlan && !p.researchStarted;
    });
    if (planMsg) {
     const p = planMsg.body as BusinessChatAnswer;
     approvedResearch = true;
     body.messageId = planMsg.id;
     researchFocusText = p.researchPlan!.focus;
    } else if (lastAssistantMsg) {
     const lastPayload = lastAssistantMsg.body as BusinessChatAnswer | undefined;
     if (lastPayload?.proposal && !lastAssistantMsg.knowledgeDocumentId) {
      autoSavedTitle = lastPayload.proposal.title;
      pendingProposal = { id: lastAssistantMsg.id, title: lastPayload.proposal.title, text: lastPayload.proposal.text, sources: lastPayload.sources };
     } else if (/\bresearch\b/i.test(userText) || (lastPayload?.text && /research|competitive landscape|market trends|audience behaviors/i.test(lastPayload.text))) {
      approvedResearch = true;
      body.messageId = lastAssistantMsg.id;
      const topicMatch = lastPayload?.text?.match(/to gather up-to-date insights on ([^.]+)/i) ||
                         lastPayload?.text?.match(/research (?:on|into|regarding) ([^.]+)/i);
      researchFocusText = topicMatch ? topicMatch[1].trim() : (lastPayload?.text ? lastPayload.text.slice(0, 500) : userText);
     }
    }
   }
  }
  if (!await hasCalendarPermission(creator.id, id, 'ai.generate')) return reply({ error: 'AI generation permission is required to talk with Randy.' }, 403);
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 3000 || (body.conversationId !== undefined && typeof body.conversationId !== 'string')) return reply({ error: 'Enter a message between 1 and 3,000 characters.' }, 400);
  const text = body.text.trim();
  const research = approvedResearch || body.action === 'research' || researchRequested(text);
  if (research && !canManage) return reply({ error: 'Knowledge management permission is required to start research.' }, 403);
  const lease = new Date();
  const result = await db.$transaction(async tx => {
   // Per-member lock also prevents rate-limit bypass by creating new conversations.
   await tx.$queryRaw`SELECT "id" FROM "SocialCalendar" WHERE "id" = ${id} FOR UPDATE`;
   const rate = await tx.workspaceRandyMessage.count({ where: { role: 'user', createdAt: { gte: new Date(Date.now() - 10 * 60000) }, conversation: { calendarId: id, creatorId: creator.id } } });
   if (rate >= 20) return { error: 'Please wait a few minutes before asking Randy again.', status: 429 };
   let conversation = body.conversationId ? await tx.workspaceRandyConversation.findFirst({ where: { id: body.conversationId, calendarId: id, creatorId: creator.id } }) : null;
   if (body.conversationId && !conversation) return { error: 'Conversation not found.', status: 404 };
   if (conversation?.processingAt && Date.now() - conversation.processingAt.getTime() < 5 * 60000) return { error: 'Randy is still answering. Please wait.', status: 409 };
   if (conversation && await tx.workspaceRandyMessage.count({ where: { conversationId: conversation.id } }) >= 98) return { error: 'Start a new conversation to keep chatting.', status: 409 };
   if (!conversation) conversation = await tx.workspaceRandyConversation.create({ data: { calendarId: id, creatorId: creator.id, title: text.slice(0, 90) } });
   if (pendingProposal) {
    const documentId = `randy:${pendingProposal.id}`;
    await tx.calendarBusinessDocument.create({
     data: {
      id: documentId,
      calendarId: id,
      originalName: `Randy · ${pendingProposal.title}`,
      extractedText: `# Confirmed business addition\nConfirmed by workspace member ${creator.id} at ${new Date().toISOString()}\nThis addition does not automatically replace conflicting sources.\n\n${pendingProposal.text}${pendingProposal.sources?.length ? "\n\nSupporting sources (external findings remain hypotheses):\n" + pendingProposal.sources.map(source => source.title + (source.url ? " — " + source.url : "")).join("\n") : ""}`
     }
    });
    await tx.workspaceRandyMessage.update({
     where: { id: pendingProposal.id },
     data: { knowledgeDocumentId: documentId }
    });
   }
   if (approvedResearch && body.messageId) {
    const topic = await tx.workspaceRandyMessage.findFirst({ where: { id: body.messageId, conversationId: conversation.id, role: 'assistant' } });
    const payload = topic?.body as BusinessChatAnswer | undefined;
    if (!topic || payload?.researchStarted) return { error: 'Research topic already started or unavailable.', status: 409 };
    await tx.workspaceRandyMessage.update({ where: { id: topic.id }, data: { body: JSON.parse(JSON.stringify({ ...payload, researchStarted: true })) } });
   }
   await tx.workspaceRandyMessage.create({ data: { id: randomUUID(), conversationId: conversation.id, role: 'user', body: { text, mode: approvedResearch ? 'research-approved' : research ? 'research' : 'chat' } } });
   await tx.workspaceRandyConversation.update({ where: { id: conversation.id }, data: { processingAt: lease } });
   return { conversationId: conversation.id };
  }, { timeout: 20000 });
  if ('error' in result) return reply({ error: result.error }, result.status);
  after(async () => {
   try {
    const question = approvedResearch && researchFocusText ? researchFocusText : text;
    await finishBusinessChat(result.conversationId, id, question, research, canManage, lease, approvedResearch, autoSavedTitle);
   } catch { /* Keep the lease for interruption recovery; never log private message payloads. */ }
  });
  return reply({ conversationId: result.conversationId }, 202);
 } catch { return reply({ error: 'Randy could not complete this action. Reload the conversation before retrying.' }, 503); }
}
