import { db } from "@/lib/db";
import { getInstagramUsername, listManagedPages } from "@/lib/instagram";
import { upsertSocialConnection } from "@/lib/socialReporting";
import { subscribeMetaMessagingAccount } from "@/lib/socialMessaging/meta";

// Shared by the legacy callback and explicit account picker. Preserve both
// publishing credentials and the existing Page + Instagram webhook registration.
export async function completeInstagramConnection(calendarId: string,
  pageWithInstagram: Awaited<ReturnType<typeof listManagedPages>>[number] & { instagram_business_account: { id: string } },
  grantedPermissions: string[], expiresAt: Date, actorId?: string) {
    const igUserId = pageWithInstagram.instagram_business_account.id;
    const username = await getInstagramUsername(igUserId, pageWithInstagram.access_token);


    await db.socialCalendar.update({
      where: { id: calendarId },
      data: {
        instagramAccountId: igUserId,
        instagramUsername: username,
        instagramPageId: pageWithInstagram.id,
        // The Page access token, not the user token — this is what
        // every subsequent publish call actually authenticates with.
        instagramAccessToken: pageWithInstagram.access_token,
        instagramTokenExpiresAt: expiresAt,
        instagramConnectedAt: new Date(),
      },
    });
    const socialConnection = await upsertSocialConnection({
      calendarId,
      platform: "INSTAGRAM",
      actorId,
      platformAccountId: igUserId,
      accountName: username,
      username,
      accessToken: pageWithInstagram.access_token,
      accessTokenExpiresAt: expiresAt,
      tokenScopes: grantedPermissions.join(","),
    });
    try {
      // Meta requires the Page user behind this token to have the
      // MESSAGING task for Instagram Messaging on the linked Page.
      // Publishing can still connect when that task is absent.
      // /{page-id}?fields=access_token can return a verified Page token
      // without the /me/accounts task list. Unknown tasks are not a denial:
      // Meta still enforces authorization on the subscription requests below.
      if (pageWithInstagram.tasks && !pageWithInstagram.tasks.includes("MESSAGING")) {
        await db.socialConnection.update({
          where: { id: socialConnection.id },
          data: {
            messagingWebhookSubscribedAt: null,
            messagingWebhookError: "Instagram messaging needs the MESSAGING task on the linked Facebook Page. Reconnect with a Facebook account that has that Page task.",
          },
        });
        return;
      }
      // Register both the linked Page and the Instagram account. A successful
      // Page subscription alone can leave the Instagram account's
      // subscribed_apps empty and incoming DMs undelivered.
      await subscribeMetaMessagingAccount(pageWithInstagram.id, pageWithInstagram.access_token, "INSTAGRAM");
      await subscribeMetaMessagingAccount(igUserId, pageWithInstagram.access_token, "INSTAGRAM");
      await db.socialConnection.update({
        where: { id: socialConnection.id },
        data: {
          messagingWebhookSubscribedAt: new Date(),
          // This field records actual subscription failures. App-level
          // webhook capability is configured separately in Meta and is
          // shown as a setup note in the inbox status.
          messagingWebhookError: null,
        },
      });
    } catch (error) {
      await db.socialConnection.update({ where: { id: socialConnection.id }, data: { messagingWebhookError: error instanceof Error ? error.message.replaceAll(pageWithInstagram.access_token, "[redacted]").slice(0, 1500) : "Meta webhook subscription failed." } });
      console.warn("Instagram connected; messaging webhook registration needs attention.");
    }

}
