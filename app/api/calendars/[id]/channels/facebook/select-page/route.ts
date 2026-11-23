import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import { upsertSocialConnection } from "@/lib/socialReporting";
import { subscribeMetaMessagingAccount } from "@/lib/socialMessaging/meta";
import {
  facebookPageSelectionCookieName,
  facebookPageSelectionCookieOptions,
  verifyFacebookPageSelection,
} from "@/lib/facebookPageSelection";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/channels/facebook/select-page/route.ts#POST@16",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const { id: calendarId } = await params;
  const settingsPath = `/dashboard/calendars/${calendarId}?view=channels`;

  const redirectWithClearedSelection = (url: string) => {
    const response = NextResponse.redirect(`${appUrl()}${url}`, 303);

    response.cookies.set(facebookPageSelectionCookieName(), "", {
      ...facebookPageSelectionCookieOptions(0),
      maxAge: 0,
    });

    return response;
  };

  const creator = await getCurrentCreator();

  if (!creator) {
    return redirectWithClearedSelection("/login");
  }

  const calendar = await db.socialCalendar.findUnique({
    where: { id: calendarId },
    select: {
      id: true,
      managerId: true,
    },
  });

  if (!calendar || !(await hasCalendarPermission(creator.id, calendarId, "channels.manage"))) {
    return redirectWithClearedSelection(
      `${settingsPath}&facebookError=not_found`,
    );
  }

  const selection = verifyFacebookPageSelection(
    req.cookies.get(facebookPageSelectionCookieName())?.value,
  );

  if (!selection || selection.calendarId !== calendarId) {
    return redirectWithClearedSelection(
      `${settingsPath}&facebookError=missing_state`,
    );
  }

  const formData = await req.formData();
  const pageId = formData.get("pageId");

  if (typeof pageId !== "string" || !pageId.trim()) {
    return redirectWithClearedSelection(
      `${settingsPath}&facebookError=no_page`,
    );
  }

  /*
   * Security boundary:
   * Never trust Page details submitted by the browser.
   *
   * The browser only submits a Page ID. The actual Page name and access
   * token must come from the signed HTTP-only selection state created
   * immediately after Meta OAuth.
   */
  const page = selection.pages.find(
    (candidate) => candidate.id === pageId,
  );

  if (!page) {
    return redirectWithClearedSelection(
      `${settingsPath}&facebookError=no_page`,
    );
  }

  try {
    const tokenExpiry = selection.userTokenExpiresAt
      ? new Date(selection.userTokenExpiresAt)
      : null;

    await db.socialCalendar.update({
      where: { id: calendarId },
      data: {
        facebookPageId: page.id,
        facebookPageName: page.name,
        facebookAccessToken: page.accessToken,
        facebookTokenExpiresAt: tokenExpiry,
        facebookConnectedAt: new Date(),
      },
    });

    const socialConnection = await upsertSocialConnection({ actorId: creator.id,
      calendarId,
      platform: "FACEBOOK",
      platformAccountId: page.id,
      accountName: page.name,
      accessToken: page.accessToken,
      accessTokenExpiresAt: tokenExpiry,
      tokenScopes: selection.grantedPermissions.join(","),
    });

    try {
      await subscribeMetaMessagingAccount(
        page.id,
        page.accessToken,
        "FACEBOOK",
      );

      await db.socialConnection.update({
        where: { id: socialConnection.id },
        data: {
          messagingWebhookSubscribedAt: new Date(),
          messagingWebhookError: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 1500)
          : "Meta webhook subscription failed.";

      await db.socialConnection.update({
        where: { id: socialConnection.id },
        data: {
          messagingWebhookError: message,
        },
      });

      console.warn(
        "Facebook Page connected, but messaging webhooks could not be enabled:",
        error,
      );
    }

    return redirectWithClearedSelection(
      `${settingsPath}&facebookConnected=true`,
    );
  } catch (error) {
    console.error("Facebook Page selection failed:", error);

    return redirectWithClearedSelection(
      `${settingsPath}&facebookError=connection_failed`,
    );
  }
}