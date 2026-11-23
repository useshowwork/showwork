import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { verifyChannelOAuthState, channelOAuthCookieOptions } from "@/lib/channelOAuthState";
import { readTikTokVerifier, TIKTOK_PKCE_COOKIE } from "@/lib/tiktokOAuthPkce";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { exchangeCodeForTikTokTokens, getTikTokDisplayName } from "@/lib/tiktok";
import { appUrl } from "@/lib/url";
import { tikTokRedirectUri } from "@/lib/tiktokOAuthConfig";
import { upsertSocialConnection } from "@/lib/socialReporting";

// GET — TikTok redirects here after the manager approves (or denies)
// access on its authorization page. Signed state and a browser nonce
// bind the request to its calendar; session ownership is checked too.
export async function GET(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/tiktok/callback/route.ts#GET@14",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const calendarId = verifyChannelOAuthState("tiktok", req.nextUrl.searchParams.get("state"), req.cookies.get("showwork_tiktok_oauth_state")?.value);
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const verifier = readTikTokVerifier(req.cookies.get(TIKTOK_PKCE_COOKIE)?.value, req.cookies.get("showwork_tiktok_oauth_state")?.value);

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(`${appUrl()}${path}`);
    response.cookies.set("showwork_tiktok_oauth_state", "", channelOAuthCookieOptions("tiktok", 0));
    response.cookies.set(TIKTOK_PKCE_COOKIE, "", channelOAuthCookieOptions("tiktok", 0));
    return response;
  };

  if (!calendarId) return redirectTo("/dashboard/calendars?tiktokError=missing_state");

  const settingsPath = `/dashboard/calendars/${calendarId}?view=channels`;

  if (oauthError || !code) {
    return redirectTo(`${settingsPath}&tiktokError=denied`);
  }
  if (!verifier) return redirectTo(`${settingsPath}&tiktokError=missing_state`);

  const creator = await getCurrentCreator();
  if (!creator) return redirectTo("/login");

  const calendar = await db.socialCalendar.findUnique({ where: { id: calendarId }, select: { id: true, managerId: true } });
  if (!calendar || !(await hasCalendarPermission(creator.id, calendar.id, "channels.manage", "TIKTOK"))) {
    return redirectTo("/dashboard/calendars?tiktokError=not_found");
  }

  const redirectUri = tikTokRedirectUri();

  try {
    const tokens = await exchangeCodeForTikTokTokens(code, redirectUri, verifier);
    if (!tokens.scope?.split(/[\s,]+/).includes("video.publish")) throw new Error("TikTok publishing permission was not granted.");
    const displayName = await getTikTokDisplayName(tokens.access_token);

    const accessTokenExpiresAt = new Date();
    accessTokenExpiresAt.setSeconds(accessTokenExpiresAt.getSeconds() + tokens.expires_in);

    await db.socialCalendar.update({
      where: { id: calendarId },
      data: {
        tikTokOpenId: tokens.open_id,
        tikTokUsername: displayName,
        tikTokAccessToken: tokens.access_token,
        tikTokAccessTokenExpiresAt: accessTokenExpiresAt,
        tikTokRefreshToken: tokens.refresh_token,
        tikTokConnectedAt: new Date(),
      },
    });
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000);
    await upsertSocialConnection({ actorId: creator.id,
      calendarId,
      platform: "TIKTOK",
      platformAccountId: tokens.open_id,
      accountName: displayName,
      username: displayName,
      accessToken: tokens.access_token,
      accessTokenExpiresAt,
      refreshToken: tokens.refresh_token,
      refreshTokenExpiresAt,
      tokenScopes: tokens.scope,
    });

    await db.calendarPost.updateMany({ where: { calendarId, platform: "TIKTOK", tikTokPublishStatus: "SCHEDULED", tikTokConsentAccountId: { not: tokens.open_id } }, data: {
      tikTokPublishStatus: "NOT_SCHEDULED", tikTokConsentAt: null, tikTokConsentBy: null, tikTokConsentHash: null,
      tikTokConsentAccountId: null, tikTokConsentVersion: null, tikTokPublishError: "The connected account changed. Review TikTok settings and authorize again.",
    } });
    return redirectTo(`${settingsPath}&tiktokConnected=true`);
  } catch (err) {
    console.error("TikTok OAuth callback failed.");
    return redirectTo(`${settingsPath}&tiktokError=connection_failed`);
  }
}
