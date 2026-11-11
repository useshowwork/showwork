import { MetaDiscoveryError } from "@/lib/metaPageDiscovery";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import { linkedInPages } from "@/lib/linkedin/pages";
import { upsertSocialConnection } from "@/lib/socialReporting";
import {
  exchangeChannelCode,
  exchangeForLongLivedFacebookToken,
  getFacebookGrantedPermissions,
  getFacebookPages,
  getLinkedInMember,
  getXMember,
} from "@/lib/channelOAuth";
import {
  channelOAuthCookieOptions,
  verifyChannelOAuthState,
  xPkceCookieName,
  type PublishingChannel,
} from "@/lib/channelOAuthState";
import {
  createFacebookPageSelection,
  facebookPageSelectionCookieOptions,
} from "@/lib/facebookPageSelection";

const CHANNELS: PublishingChannel[] = ["facebook", "linkedin", "x"];

function withExpiry(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(Date.now() + seconds * 1000);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channel: string }> },
) {
  const requestedChannel = (await params).channel;
  if (["linkedin", "x"].includes(requestedChannel)) {
    return NextResponse.json({ error: "This channel is coming soon. New connections are unavailable." }, { status: 403 });
  }

  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/channels/[channel]/callback/route.ts#GET@34",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const { channel: rawChannel } = await params;

  if (!CHANNELS.includes(rawChannel as PublishingChannel)) {
    return NextResponse.json(
      { error: "Unknown publishing channel." },
      { status: 404 },
    );
  }

  const channel = rawChannel as PublishingChannel;
  const stateCookieName = `showwork_${channel}_oauth_state`;
  const cookieNonce = req.cookies.get(stateCookieName)?.value;

  const calendarId = verifyChannelOAuthState(
    channel,
    req.nextUrl.searchParams.get("state"),
    cookieNonce,
  );

  const fallback = `/dashboard/calendars?view=channels&${channel}Error=missing_state`;

  if (!calendarId) {
    return NextResponse.redirect(`${appUrl()}${fallback}`);
  }

  const callbackPath = `/api/calendars/channels/${channel}/callback`;
  const settingsPath = `/dashboard/calendars/${calendarId}?view=channels`;

  const makeRedirect = (url: string) => {
    const response = NextResponse.redirect(`${appUrl()}${url}`);

    response.cookies.set(stateCookieName, "", {
      ...channelOAuthCookieOptions(channel, 0),
      maxAge: 0,
    });

    if (channel === "x") {
      response.cookies.set(xPkceCookieName(), "", {
        ...channelOAuthCookieOptions(channel, 0),
        path: callbackPath,
        maxAge: 0,
      });
    }

    return response;
  };

  const oauthError = req.nextUrl.searchParams.get("error");
  const code = req.nextUrl.searchParams.get("code");

  if (oauthError || !code) {
    return makeRedirect(`${settingsPath}&${channel}Error=denied`);
  }

  const creator = await getCurrentCreator();

  if (!creator) {
    return makeRedirect("/login");
  }

  const calendar = await db.socialCalendar.findUnique({
    where: { id: calendarId },
    select: { id: true, managerId: true, instagramPageId: true, facebookPageId: true },
  });

  if (!calendar || !(await hasCalendarPermission(creator.id, calendar.id, "channels.manage"))) {
    return makeRedirect(`${settingsPath}&${channel}Error=not_found`);
  }

  const redirectUri = `${appUrl()}${callbackPath}`;

  try {
    const tokens = await exchangeChannelCode({
      channel,
      code,
      redirectUri,
      codeVerifier:
        channel === "x"
          ? req.cookies.get(xPkceCookieName())?.value
          : undefined,
    });

    if (!tokens.access_token) {
      throw new Error(`${channel} did not return an access token.`);
    }

    /*
     * FACEBOOK
     *
     * Do not automatically connect pages[0].
     *
     * Meta App Review expects the user to see the Pages they manage,
     * deliberately select one, and then continue into a Page-scoped
     * feature using that exact Page.
     *
     * Page access tokens remain inside an encrypted/signed HTTP-only
     * selection cookie and are never exposed to the browser UI.
     */
    if (channel === "facebook") {
      const longLived = await exchangeForLongLivedFacebookToken(
        tokens.access_token,
      );

      const grantedPermissions = await getFacebookGrantedPermissions(
        longLived.access_token,
      );

      const pageHints = [calendar.instagramPageId, calendar.facebookPageId].filter((value): value is string => !!value);
      const pages = await getFacebookPages(longLived.access_token, pageHints);

      if (pages.length === 0) {
        return makeRedirect(`${settingsPath}&facebookError=no_page`);
      }

      const selection = createFacebookPageSelection({
        calendarId,
        pages: pages.map((page) => ({
          id: page.id,
          name: page.name,
          accessToken: page.access_token,
        })),
        grantedPermissions,
        diagnostics: pages.diagnostics,
        userTokenExpiresAt:
          longLived.expires_in && Number.isFinite(longLived.expires_in)
            ? Date.now() + longLived.expires_in * 1000
            : null,
      });

      const response = NextResponse.redirect(
        `${appUrl()}/dashboard/calendars/${calendarId}/facebook/select-page`,
      );

      // OAuth state has now been consumed.
      response.cookies.set(stateCookieName, "", {
        ...channelOAuthCookieOptions(channel, 0),
        maxAge: 0,
      });

      response.cookies.set(
        selection.cookieName,
        selection.value,
        facebookPageSelectionCookieOptions(selection.maxAge),
      );

      return response;
    }

    /*
     * LINKEDIN
     */
    if (channel === "linkedin") {
      const member = await getLinkedInMember(tokens.access_token);

      const name =
        member.name ||
        [member.given_name, member.family_name]
          .filter(Boolean)
          .join(" ") ||
        "LinkedIn member";

      const existing = await db.socialConnection.findFirst({ where: { calendarId, platform: "LINKEDIN", status: "CONNECTED" } });
      let publishingId = member.sub;
      let publishingName = name;
      if (existing?.platformAccountId.startsWith("urn:li:organization:")) {
        const pages = await linkedInPages({ ...existing, accessToken: tokens.access_token, tokenScopes: tokens.scope ?? existing.tokenScopes });
        const selectedPage = pages.find(page => page.id === existing.platformAccountId);
        if (!selectedPage) throw new Error("The previously selected LinkedIn Page is no longer administered by this account.");
        publishingId = selectedPage.id; publishingName = selectedPage.name;
      }
      await db.socialCalendar.update({
        where: { id: calendarId },
        data: {
          linkedinMemberId: member.sub,
          linkedinName: publishingName,
          linkedinAccessToken: tokens.access_token,
          linkedinAccessTokenExpiresAt: withExpiry(tokens.expires_in),
          linkedinRefreshToken: tokens.refresh_token ?? null,
          linkedinRefreshTokenExpiresAt: withExpiry(
            tokens.refresh_token_expires_in,
          ),
          linkedinConnectedAt: new Date(),
        },
      });

      await upsertSocialConnection({
        calendarId,
        platform: "LINKEDIN",
        platformAccountId: publishingId,
        accountName: publishingName,
        username: publishingId === member.sub ? name : null,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: withExpiry(tokens.expires_in),
        refreshToken: tokens.refresh_token ?? null,
        refreshTokenExpiresAt: withExpiry(
          tokens.refresh_token_expires_in,
        ),
        tokenScopes: tokens.scope ?? null,
      });
    } else {
      /*
       * X
       */
      const member = await getXMember(tokens.access_token);

      await db.socialCalendar.update({
        where: { id: calendarId },
        data: {
          xUserId: member.id,
          xUsername: member.username,
          xAccessToken: tokens.access_token,
          xAccessTokenExpiresAt: withExpiry(tokens.expires_in),
          xRefreshToken: tokens.refresh_token ?? null,
          xConnectedAt: new Date(),
        },
      });

      await upsertSocialConnection({
        calendarId,
        platform: "X",
        platformAccountId: member.id,
        accountName: member.name,
        username: member.username,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: withExpiry(tokens.expires_in),
        refreshToken: tokens.refresh_token ?? null,
        tokenScopes: tokens.scope ?? null,
      });
    }

    return makeRedirect(
      `${settingsPath}&${channel}Connected=true`,
    );
  } catch (error) {
    console.error(`${channel} OAuth callback failed`, { code: error instanceof MetaDiscoveryError ? error.code : "OAUTH_FAILED" });

    return makeRedirect(
      `${settingsPath}&${channel}Error=${error instanceof MetaDiscoveryError ? error.code : "connection_failed"}`,
    );
  }
}