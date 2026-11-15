import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCalendarById } from "@/lib/calendarPermissions";
import { freshConnection, requireScopes } from "@/lib/socialTokens";
import { linkedInMessagingProvider } from "@/lib/linkedin/messagingProvider";
import { linkedInMessagingConfigured } from "@/lib/linkedin/messagingAccess";
import { appUrl } from "@/lib/url";
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const creator = await getCurrentCreator();
  const { id } = await context.params;
  if (!creator || !(await hasCalendarPermission(creator.id, id, "channels.manage", "LINKEDIN")) || !(await canAccessCalendarById(id))) return NextResponse.json({ error: "Only a workspace owner or authorized manager can enable messaging." }, { status: 403 });
  if (!linkedInMessagingConfigured()) return NextResponse.json({ error: "LinkedIn partner approval and the approved Page Messaging adapter are required." }, { status: 409 });
  try {
    const stored = await db.socialConnection.findFirst({ where: { calendarId: id, platform: "LINKEDIN", status: "CONNECTED" } });
    if (!stored || !/^urn:li:organization:\d+$/.test(stored.platformAccountId)) return NextResponse.json({ error: "Connect a company Page first." }, { status: 409 });
    const featureLock = await calendarFeatureGate(id, "socialInbox");
    if (featureLock) return featureLock;
    const connection = await freshConnection(stored);
    requireScopes(connection, [...linkedInMessagingProvider!.requiredScopes]);
    const callbackUrl = `${appUrl()}/api/webhooks/linkedin/messaging`;
    if (!process.env.LINKEDIN_CLIENT_SECRET || new URL(callbackUrl).protocol !== "https:") return NextResponse.json({ error: "Configure the LinkedIn app secret and an HTTPS callback before enabling messaging." }, { status: 409 });
    await linkedInMessagingProvider!.subscribe(connection, callbackUrl);
    const updated = await db.socialConnection.updateMany({ where: { id: connection.id, status: "CONNECTED", accessToken: connection.accessToken }, data: { messagingWebhookSubscribedAt: new Date(), messagingWebhookError: null } });
    if (!updated.count) return NextResponse.json({ error: "Connection changed during setup. Reconnect and retry." }, { status: 409 });
    return NextResponse.json({ enabled: true });
  } catch {
    return NextResponse.json({ error: "LinkedIn subscription could not be confirmed. Check Page Messaging permissions and retry." }, { status: 502 });
  }
}
