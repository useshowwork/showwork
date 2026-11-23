import { redirectWithinChannelFlow } from "@/lib/channelOAuthRedirect";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import {publishingIntegrationInstalled,invokePublishingEntrypoint} from '@/lib/publishing/applicationBoundary';
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInstagramAuthUrl } from "@/lib/instagram";
import { createChannelOAuthState, channelOAuthCookieOptions } from "@/lib/channelOAuthState";
import { appUrl } from "@/lib/url";

// Start a manager-authorized OAuth flow with signed, browser-bound state.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return invokePublishingEntrypoint<Response>('app/api/calendars/[id]/instagram/connect/route.ts#GETcanonical',Array.from(arguments)); } /* end-canonical-integration-boundary */
  const creator = await getCurrentCreator();
  if (!creator) return redirectWithinChannelFlow("/login");

  const { id } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { id }, select: { managerId: true } });
  if (!calendar || !(await hasCalendarPermission(creator.id, id, "channels.manage"))) {
    return redirectWithinChannelFlow(`/dashboard/calendars/${id}?view=channels&instagramError=not_found`);
  }

  const redirectUri = `${appUrl()}/api/calendars/instagram/callback`;

  try {
    const state = createChannelOAuthState("instagram", id);
    const authUrl = buildInstagramAuthUrl({ redirectUri, state: state.state, creatorId: creator.id });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(state.cookieName, state.nonce, channelOAuthCookieOptions("instagram", state.maxAge));
    return response;
  } catch (err) {
    console.error("Failed to build Instagram auth URL:", err);
    return redirectWithinChannelFlow(`/dashboard/calendars/${id}?view=channels&instagramError=not_configured`);
  }
}
