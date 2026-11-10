# Enable Meta Business Portfolio discovery

This is a follow-up to `reviews/meta-agency-connections-2026-11-09.md`. The earlier discovery fix added Business Portfolio lookup when the user token already grants `business_management`. This follow-up adds an explicit, default-off OAuth scope switch so a verified approved app can actually request that grant.

## What the affected user's response establishes

The supplied response has all three discovery scopes (`pages_show_list`, `pages_read_engagement`, `instagram_basic`), zero Pages from `/me/accounts` or granular Page grants, no discovery errors, and no `business_management`. It establishes that the Business discovery route was not attempted. It does **not** establish missing ownership, prove an asset assignment is incorrect, prove app Advanced Access, or prove that requesting one extra scope alone will resolve the account.

## Before enabling

In Meta for Developers, select the app matching `INSTAGRAM_APP_ID` for Instagram, or `FACEBOOK_APP_ID` for Facebook. Verify `business_management` is available for the intended use and has the access level required for the intended users. Ordinary external customers must not be treated as app-role testers. If the required access has not been approved, complete the corresponding Meta app-review/configuration steps first. The repository's historical reporting diagnosis mentions an older token with this grant, which does not prove the current app's Advanced Access status.

Do not request `ads_read` or `ads_management` merely to experiment with empty discovery. Recheck the relevant official Instagram/Business permission requirements for the actual login/use case if Meta returns a dependency error; add a permission only with documented need and appropriate approval.

## Enable the approved app

For Instagram OAuth, on the production **web application** environment:

```dotenv
INSTAGRAM_REQUEST_BUSINESS_MANAGEMENT_SCOPE=true
```

For Facebook OAuth, only if that configured app is also approved:

```dotenv
FACEBOOK_REQUEST_BUSINESS_MANAGEMENT_SCOPE=true
```

Flags are separate because Instagram and Facebook may be configured with different app IDs. Unset/false leaves the existing consent scope list unchanged. They do not bypass Meta review, automatically grant access, upgrade existing tokens, change workspace permissions or alter stored connections. Do not set the flags to true until the app's access level is verified. Set them where the web OAuth routes run; a publishing-worker-only VPS environment change is insufficient.

Deploy the matching code release and apply the web environment through the normal hosting deployment/restart process. No Prisma migration is needed. App credentials and JWT secrets must not be changed for this rollout.

## Reauthorize and verify

1. Confirm the invited manager accepted the invitation and both the Page and linked Instagram professional account are assigned to her actual authorizing Facebook profile.
2. Reconnect Instagram from the intended Showwork workspace. Use her assigned Facebook profile and select the client's Page and Instagram asset in Meta's available consent controls. No personal client login credentials are needed.
3. Inspect the authenticated picker JSON: `grantedPermissions` should contain `business_management`; `diagnostics.businessDiscovery` should become `CHECKED`.
4. Check actual Page/account results and any safe stage/code issues. `CHECKED` alone is not success. Discovery may still fail because of provider access restrictions, login configuration, granular selection or asset assignment.
5. Connect the correct account, verify publishing/inbox/reporting according to granted capabilities, and verify another workspace cannot use its selection ticket. Other authorized Showwork members use the saved workspace connection.

If the new grant is absent, verify the deployed flag, the app ID whose approval was checked, and the new Meta consent grant. If the grant is present but no eligible Page appears, use the new stage/code diagnostics and investigate the actual Meta response rather than asking the person to become an owner.

Rollback: unset the corresponding flag and deploy/restart the web application. Existing connected accounts remain saved; no database reset or token deletion is necessary.

Official references: https://developers.facebook.com/docs/permissions/ and https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/ . Meta's official generated Business SDK contains the `/businesses`, `/owned_pages` and `/client_pages` edges; endpoint presence does not prove app approval.

## Follow-up: one Page found, zero linked Instagram accounts

The later supplied response has `facebookPagesFound: 1`, `sources.granular: 1`, no issues, and `NO_INSTAGRAM_RELATIONSHIP`. The immediate blocker in that attempt is the relationship returned for the discovered Page, not the absence of Business inventory discovery. Do not request another permission or unlink accounts on that evidence alone.

The picker diagnostics now include a safe `pages` projection (Page ID/name, known tasks, Instagram relationship check status and returned Instagram ID). At most 25 entries are included, with a truncation flag. No provider Page object or token is copied into this projection. The UI shows the Page identity when no eligible Instagram account is available.

Deploy this follow-up, restart authorization, and verify the Page identity first. If it is the wrong Page, correct the consent selection. If it is the intended Page, compare its Linked accounts configuration with the intended Instagram account; `NOT_RETURNED` does not by itself establish that the assets are actually unlinked. If the relationship is configured correctly, investigate the exact read and asset grants before changing Meta settings.

## Confirmed delegated listing omission and automatic reconnect

The user's live direct check of Page `381092961751993` issued a Page token and returned the correct Instagram relationship under both user and Page credentials, despite an empty `/me/accounts` and no granular Page IDs. This confirms access while the listing omits the asset; it does not establish the exact upstream cause.

The picker and canonical Instagram callback now supplement provider discovery with `instagramPageId` / `facebookPageId` from the current, permission-checked workspace. Each candidate is verified anew with the current user's token, requires Meta to issue a Page token, and respects explicit OAuth Page exclusions. No other workspace or user's saved credential is used. Successful existing connections already store the Page ID, so reconnecting that workspace no longer requires typing it again. No migration is needed.

This cannot discover a never-seen Page in a brand-new workspace when Meta supplies neither list entries nor asset IDs. The existing Business Portfolio discovery code can enumerate owned/client Pages when `business_management` is granted. The latest reported token lacks that permission, and the supplied app screenshot showed Ready for testing rather than approved Advanced Access. Complete/verify the appropriate Meta access setup, enable the documented environment flag and reauthorize to exercise that discovery path for external customers. Do not claim that enabling the flag alone fixes all first-time discovery, and do not hardcode Showwork's Page for other customers.
