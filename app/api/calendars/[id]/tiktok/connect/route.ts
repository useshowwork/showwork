import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { createChannelOAuthState, channelOAuthCookieOptions } from "@/lib/channelOAuthState";
import { createTikTokPkce, TIKTOK_PKCE_COOKIE } from "@/lib/tiktokOAuthPkce";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildTikTokAuthUrl } from "@/lib/tiktok";
import { appUrl } from "@/lib/url";
import { tikTokRedirectUri } from "@/lib/tiktokOAuthConfig";

// GET — starts the TikTok connection flow for one calendar.
// Manager-only, same trust boundary as the Instagram connect route —
// connecting a real social account on someone's behalf is a bigger
// decision than editing posts. Redirects to TikTok's own
// authorization page. Signed, expiring state binds the calendar to
// this browser so the callback cannot attach a forged connection.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.redirect(`${appUrl()}/login`);

  const { id } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { id }, select: { managerId: true } });
  if (!calendar || !(await hasCalendarPermission(creator.id, id, "channels.manage", "TIKTOK"))) {
    return NextResponse.redirect(`${appUrl()}/dashboard/calendars/${id}?view=channels&tiktokError=not_found`);
  }

  const redirectUri = tikTokRedirectUri();

  try {
    const state = createChannelOAuthState("tiktok", id);
    const pkce = createTikTokPkce();
    const authUrl = buildTikTokAuthUrl({ redirectUri, state: state.state, codeChallenge: pkce.challenge });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(state.cookieName, state.nonce, channelOAuthCookieOptions("tiktok", state.maxAge));
    response.cookies.set(TIKTOK_PKCE_COOKIE, `${state.nonce}.${pkce.verifier}`, channelOAuthCookieOptions("tiktok", state.maxAge));
    return response;
  } catch (err) {
    console.error("Failed to build TikTok auth URL:", err);
    return NextResponse.redirect(`${appUrl()}/dashboard/calendars/${id}?view=channels&tiktokError=not_configured`);
  }
}
