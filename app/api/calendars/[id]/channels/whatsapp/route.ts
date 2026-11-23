import { recordChannelConnected } from "@/lib/workspaceNotifications";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCalendarById, getCalendarRole } from "@/lib/calendarPermissions";
import { validateWhatsAppConnection, whatsappConfigured, whatsappRequest } from "@/lib/socialMessaging/whatsapp";

export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const publicFields = { id: true, accountName: true, username: true, status: true, connectedAt: true,
  platformAccountId: true, whatsappBusinessAccountId: true, messagingWebhookError: true, accessTokenExpiresAt: true } as const;
async function owner(calendarId: string) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const calendar = await db.socialCalendar.findUnique({ where: { id: calendarId }, select: { managerId: true } });
  if (!calendar || !(await hasCalendarPermission(creator.id, calendarId, "channels.manage"))) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  return null;
}
export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params;
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasCalendarPermission(creator.id, id, "channels.view"))) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  const connection = await db.socialConnection.findFirst({ where: { calendarId: id, platform: "WHATSAPP", status: { not: "DISCONNECTED" } },
    orderBy: { connectedAt: "desc" }, select: publicFields });
  return NextResponse.json({ configured: whatsappConfigured(), connection });
}
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  const denied = await owner(id);
  if (denied) return denied;
  const creator = await getCurrentCreator();
  if (!(await canAccessCalendarById(id))) return NextResponse.json({ error: "This workspace is not active." }, { status: 403 });
  const featureLock = await calendarFeatureGate(id, "socialInbox");
  if (featureLock) return featureLock;
  if (!whatsappConfigured()) return NextResponse.json({ error: "Configure the WhatsApp app and webhook on the server first." }, { status: 503 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 8192) return NextResponse.json({ error: "Connection details are too large." }, { status: 413 });
  let body: { businessAccountId?: unknown; phoneNumberId?: unknown; accessToken?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid connection details." }, { status: 400 }); }
  if (!body || typeof body.businessAccountId !== "string" || typeof body.phoneNumberId !== "string" || typeof body.accessToken !== "string") {
    return NextResponse.json({ error: "Business Account ID, Phone Number ID and access token are required." }, { status: 400 });
  }
  const input = { businessAccountId: body.businessAccountId.trim(), phoneNumberId: body.phoneNumberId.trim(), accessToken: body.accessToken.trim() };
  try {
    const conflict = await db.socialConnection.findFirst({ where: { platform: "WHATSAPP", status: "CONNECTED", platformAccountId: input.phoneNumberId, calendarId: { not: id } }, select: { id: true } });
    if (conflict) return NextResponse.json({ error: "This WhatsApp number is already connected to another workspace. Disconnect it there first." }, { status: 409 });
    const details = await validateWhatsAppConnection(input);
    const subscribed = await whatsappRequest<{ success?: boolean }>(`${input.businessAccountId}/subscribed_apps`, input.accessToken, {});
    if (!subscribed.success) throw new Error("WhatsApp did not confirm the messaging subscription.");
    const connection = await db.$transaction(async tx => {
      await tx.socialConnection.updateMany({ where: { calendarId: id, platform: "WHATSAPP", platformAccountId: { not: input.phoneNumberId }, status: { not: "DISCONNECTED" } },
        data: { status: "DISCONNECTED", accessToken: null, disconnectedAt: new Date(), messagingWebhookSubscribedAt: null } });
      const existing = await tx.socialConnection.findUnique({ where: { calendarId_platform_platformAccountId: { calendarId: id, platform: "WHATSAPP", platformAccountId: input.phoneNumberId } }, select: { status: true, connectedAt: true } });
      const data = { ...details, accessToken: input.accessToken, whatsappBusinessAccountId: input.businessAccountId, status: "CONNECTED" as const,
        connectedAt: existing?.status === "CONNECTED" ? existing.connectedAt : new Date(), disconnectedAt: null,
        messagingWebhookSubscribedAt: new Date(), messagingWebhookError: null };
      return tx.socialConnection.upsert({ where: { calendarId_platform_platformAccountId: { calendarId: id, platform: "WHATSAPP", platformAccountId: input.phoneNumberId } },
        create: { calendarId: id, platform: "WHATSAPP", platformAccountId: input.phoneNumberId, ...data }, update: data, select: publicFields });
    });
    if (creator) await recordChannelConnected({
      calendarId: id, connectionId: connection.id, platform: "WHATSAPP", actorId: creator.id,
      connectedAt: connection.connectedAt, accountName: connection.accountName,
    });
    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "This WhatsApp number or workspace was connected by another request. Refresh Channels." }, { status: 409 });
    // Never log submitted tokens or provider request URLs.
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not connect WhatsApp." }, { status: 400 });
  }
}
export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params;
  const denied = await owner(id);
  if (denied) return denied;
  await db.$transaction(async tx => {
    await tx.socialConnection.updateMany({ where: { calendarId: id, platform: "WHATSAPP", status: { not: "DISCONNECTED" } },
      data: { status: "DISCONNECTED", accessToken: null, refreshToken: null, disconnectedAt: new Date(), messagingWebhookSubscribedAt: null, messagingWebhookError: null } });
    await tx.socialLeadMessage.updateMany({ where: { autoReplyHandledAt: null, autoReplyEligible: true, conversation: { calendarId: id, platform: "WHATSAPP" } },
      data: { autoReplyHandledAt: new Date(), autoReplyHandoffReason: "WhatsApp was disconnected.", autoReplyClaimedAt: null } });
  });
  // WABA subscriptions may serve other phone numbers. Keep the provider subscription;
  // disconnected connections are excluded from ingestion and reply dispatch.
  return NextResponse.json({ ok: true });
}
