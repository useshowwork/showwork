import { MetaDiscoveryError } from "@/lib/metaPageDiscovery";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listInstagramGrantedPermissions,
} from "@/lib/instagram";
import { appUrl } from "@/lib/url";
import { createFacebookPageSelection, facebookPageSelectionCookieOptions } from "@/lib/facebookPageSelection";
import { verifyChannelOAuthState, channelOAuthCookieOptions } from "@/lib/channelOAuthState";

// OAuth exchange only; the manager explicitly selects the linked account next.
export async function GET(req: NextRequest) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { try { return await invokePublishingEntrypoint<never>("app/api/calendars/instagram/callback/route.ts#GET@27",Array.from(arguments)); }
    catch (error) {
      if (!(error instanceof MetaDiscoveryError)) throw error;
      return NextResponse.json({ error: error.message, code: error.code, diagnostics: error.diagnostics }, { status: 502, headers: { "Cache-Control": "no-store" } });
    } } /* end-canonical-integration-boundary */

  const calendarId = verifyChannelOAuthState("instagram", req.nextUrl.searchParams.get("state"), req.cookies.get("showwork_instagram_oauth_state")?.value);
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(`${appUrl()}${path}`);
    response.cookies.set("showwork_instagram_oauth_state", "", channelOAuthCookieOptions("instagram", 0));
    return response;
  };

  if (!calendarId) return redirectTo("/dashboard/calendars?instagramError=missing_state");

  const settingsPath = `/dashboard/calendars/${calendarId}?view=channels`;

  if (oauthError || !code) {
    // The manager denied access, or Facebook sent back an error —
    // either way, nothing to connect, just return them to where they
    // started without touching anything in the database.
    return redirectTo(`${settingsPath}&instagramError=denied`);
  }

  const creator = await getCurrentCreator();
  if (!creator) return redirectTo("/login");

  const calendar = await db.socialCalendar.findUnique({ where: { id: calendarId }, select: { id: true, managerId: true } });
  if (!calendar || !(await hasCalendarPermission(creator.id, calendar.id, "channels.manage"))) {
    return redirectTo("/dashboard/calendars?instagramError=not_found");
  }

  const redirectUri = `${appUrl()}/api/calendars/instagram/callback`;

  try {
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const grantedPermissions = await listInstagramGrantedPermissions(longLived.access_token);

    const selection = createFacebookPageSelection({
      calendarId,
      pages: [{ id: creator.id, name: "Instagram account selection", accessToken: longLived.access_token }],
      grantedPermissions,
      userTokenExpiresAt: Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000,
    });
    if (selection.value.length > 3500) throw new Error("Account selection session exceeds cookie limit.");
    const response = redirectTo(`/dashboard/calendars/${calendarId}/instagram/select-account`);
    response.cookies.set("showwork_instagram_legacy_selection", selection.value, {
      ...facebookPageSelectionCookieOptions(selection.maxAge),
      path: `/api/calendars/${calendarId}/instagram/select-account`,
    });
    return response;
  } catch {
    console.error("Instagram OAuth exchange failed; reconnect to retry.");
    return redirectTo(`${settingsPath}&instagramError=connection_failed`);
  }
}
