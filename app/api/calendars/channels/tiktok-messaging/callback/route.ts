import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCalendarById } from "@/lib/calendarPermissions";
import { appUrl } from "@/lib/url";
import { verifyChannelOAuthState, channelOAuthCookieOptions } from "@/lib/channelOAuthState";
import { tikTokMessagingTokens, subscribeTikTokMessaging } from "@/lib/tiktokMessaging";

export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${appUrl()}${path}`);
    response.cookies.set("showwork_tiktok-messaging_oauth_state", "", channelOAuthCookieOptions("tiktok-messaging", 0));
    return response;
  };
  const connectionId = verifyChannelOAuthState("tiktok-messaging", req.nextUrl.searchParams.get("state"), req.cookies.get("showwork_tiktok-messaging_oauth_state")?.value);
  if (!connectionId) return redirect("/dashboard/calendars?tiktokError=missing_state");
  const creator = await getCurrentCreator();
  if (!creator) return redirect("/login");
  const connection = await db.socialConnection.findUnique({ where: { id: connectionId }, include: { calendar: { select: { managerId: true, tikTokOpenId: true } } } });
  if (!connection || connection.platform !== "TIKTOK" || connection.status !== "CONNECTED" || connection.platformAccountId !== connection.calendar.tikTokOpenId || !(await hasCalendarPermission(creator.id, connection.calendarId, "channels.manage", "TIKTOK")) || !(await canAccessCalendarById(connection.calendarId))) return redirect("/dashboard/calendars?tiktokError=not_found");
  const path = `/dashboard/calendars/${connection.calendarId}?view=channels`;
  const code = req.nextUrl.searchParams.get("code");
  if (req.nextUrl.searchParams.has("error") || !code) return redirect(`${path}&tiktokError=denied`);
  try {
    const tokens = await tikTokMessagingTokens({ code, redirectUri: `${appUrl()}/api/calendars/channels/tiktok-messaging/callback` });
    // Do not route old conversations to a different Business Account.
    if (connection.tikTokMessagingBusinessId && connection.tikTokMessagingBusinessId !== tokens.open_id) return redirect(`${path}&tiktokError=messaging_account_changed`);
    const now = new Date();
    const saved = await db.socialConnection.updateMany({ where: { id: connectionId, status: "CONNECTED", connectedAt: connection.connectedAt, tikTokMessagingBusinessId: connection.tikTokMessagingBusinessId }, data: {
      tikTokMessagingBusinessId: tokens.open_id, tikTokMessagingAccessToken: tokens.access_token, tikTokMessagingRefreshToken: tokens.refresh_token,
      tikTokMessagingTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000), tikTokMessagingRefreshExpiresAt: new Date(now.getTime() + tokens.refresh_token_expires_in * 1000),
      tikTokMessagingScopes: tokens.scope, tikTokMessagingConnectedAt: now, messagingWebhookSubscribedAt: null, messagingWebhookError: "TikTok webhook setup is pending.", messagingSyncError: null, messagingLastSyncAt: null,
    } });
    if (!saved.count) return redirect(`${path}&tiktokError=connection_failed`);
    try {
      await subscribeTikTokMessaging(`${appUrl()}/api/webhooks/tiktok/messaging`);
      await db.socialConnection.updateMany({ where: { id: connectionId, status: "CONNECTED", tikTokMessagingAccessToken: tokens.access_token }, data: { messagingWebhookSubscribedAt: new Date(), messagingWebhookError: null } });
    } catch {
      await db.socialConnection.updateMany({ where: { id: connectionId, status: "CONNECTED", tikTokMessagingAccessToken: tokens.access_token }, data: { messagingWebhookError: "Business authorization succeeded, but the TikTok messaging webhook could not be enabled. Reconnect Business Messaging after checking the app approval and HTTPS callback." } });
      return redirect(`${path}&tiktokError=messaging_webhook_failed`);
    }
    return redirect(`${path}&tiktokMessagingConnected=true`);
  } catch {
    return redirect(`${path}&tiktokError=messaging_connection_failed`);
  }
}
