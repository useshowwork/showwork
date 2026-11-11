import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import {
  buildChannelAuthorizationUrl,
  createXCodeChallenge,
  createXCodeVerifier,
} from "@/lib/channelOAuth";
import {
  channelOAuthCookieOptions,
  createChannelOAuthState,
  xPkceCookieName,
  type PublishingChannel,
} from "@/lib/channelOAuthState";

const CHANNELS: PublishingChannel[] = ["facebook", "linkedin", "x"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channel: string }> },
) {
  const { id, channel: rawChannel } = await params;
  if (!CHANNELS.includes(rawChannel as PublishingChannel)) {
    return NextResponse.json({ error: "Unknown publishing channel." }, { status: 404 });
  }
  const channel = rawChannel as PublishingChannel;
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.redirect(`${appUrl()}/login`);

  const calendar = await db.socialCalendar.findUnique({
    where: { id },
    select: { managerId: true },
  });
  const settingsPath = `/dashboard/calendars/${id}?view=channels`;
  if (!calendar || !(await hasCalendarPermission(creator.id, id, "channels.manage"))) {
    return NextResponse.redirect(`${appUrl()}${settingsPath}&${channel}Error=not_found`);
  }

  if (["linkedin", "x"].includes(channel)) {
    return NextResponse.redirect(`${appUrl()}${settingsPath}&${channel}Error=coming_soon`);
  }

  try {
    const callbackPath = `/api/calendars/channels/${channel}/callback`;
    const redirectUri = `${appUrl()}${callbackPath}`;
    const oauthState = createChannelOAuthState(channel, id);
    const verifier = channel === "x" ? createXCodeVerifier() : undefined;
    const currentLinkedIn = channel === "linkedin" ? await db.socialConnection.findFirst({ where: { calendarId: id, platform: "LINKEDIN", status: "CONNECTED" }, select: { platformAccountId: true, tokenScopes: true } }) : null;
    const authorizationUrl = buildChannelAuthorizationUrl({
      channel,
      linkedInAnalytics: channel === "linkedin" && (_req.nextUrl.searchParams.get("analytics") === "true" || !!currentLinkedIn?.tokenScopes?.split(/[\s,]+/).includes("r_member_postAnalytics")),
      linkedInPages: channel === "linkedin" && (_req.nextUrl.searchParams.get("pages") === "true" || !!currentLinkedIn?.platformAccountId.startsWith("urn:li:organization:")),
      redirectUri,
      state: oauthState.state,
      codeChallenge: verifier ? createXCodeChallenge(verifier) : undefined,
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(
      oauthState.cookieName,
      oauthState.nonce,
      channelOAuthCookieOptions(channel, oauthState.maxAge),
    );
    if (verifier) {
      response.cookies.set(xPkceCookieName(), verifier, {
        ...channelOAuthCookieOptions(channel, oauthState.maxAge),
        path: callbackPath,
      });
    }
    return response;
  } catch (error) {
    console.error(`Failed to start ${channel} OAuth:`, error);
    return NextResponse.redirect(`${appUrl()}${settingsPath}&${channel}Error=not_configured`);
  }
}
