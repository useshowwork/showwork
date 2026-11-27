import { type NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { publishingIntegrationInstalled, invokePublishingEntrypoint } from "@/lib/publishing/applicationBoundary";
import { upsertSocialConnection } from "@/lib/socialReporting";
import { handleTikTokAccountSelection } from "@/lib/tiktokAccountSelection";

async function selectAccount(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (publishingIntegrationInstalled()) {
    return invokePublishingEntrypoint<Response>("app/api/calendars/[id]/tiktok/select-account/route.ts#selectAccount", [request, context]);
  }
  const { id } = await context.params;
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!(await hasCalendarPermission(creator.id, id, "channels.manage", "TIKTOK"))) {
    return NextResponse.json({ error: "You don’t have permission to manage this connection." }, { status: 403 });
  }

  return handleTikTokAccountSelection(request, id, creator.id, async (account) => {
    const expiresAt = new Date(account.accessExpiresAt);
    await upsertSocialConnection({
      actorId: creator.id,
      calendarId: id,
      platform: "TIKTOK",
      platformAccountId: account.accountId,
      accountName: account.displayName,
      username: account.displayName,
      accessToken: account.accessToken,
      accessTokenExpiresAt: expiresAt,
      refreshToken: account.refreshToken,
      refreshTokenExpiresAt: new Date(account.refreshExpiresAt),
      tokenScopes: account.scopes,
    }, db, async (tx) => {
      const updated = await tx.socialCalendar.updateMany({
        where: {
          id,
          tikTokConnectedAt: account.connectionVersion === null ? null : new Date(account.connectionVersion),
        },
        data: {
          tikTokOpenId: account.accountId,
          tikTokUsername: account.displayName,
          tikTokAccessToken: account.accessToken,
          tikTokAccessTokenExpiresAt: expiresAt,
          tikTokRefreshToken: account.refreshToken,
          tikTokConnectedAt: new Date(),
        },
      });
      if (!updated.count) throw new Error("ACCOUNT_VERSION_CONFLICT");
      await tx.calendarPost.updateMany({
        where: { calendarId: id, platform: "TIKTOK", tikTokPublishStatus: "SCHEDULED", tikTokConsentAccountId: { not: account.accountId } },
        data: {
          tikTokPublishStatus: "NOT_SCHEDULED",
          tikTokConsentAt: null,
          tikTokConsentBy: null,
          tikTokConsentHash: null,
          tikTokConsentAccountId: null,
          tikTokConsentVersion: null,
          tikTokPublishError: "The connected account changed. Review TikTok settings and authorize again.",
        },
      });
    });
  });
}

export const GET = selectAccount;
export const POST = selectAccount;
