# Meta agency connection audit — 9 November 2026

## Findings and evidence limits

This review used repository code and mocked Graph API responses. No production access tokens, affected user's Graph responses, Meta app-review configuration, or live accounts were available. Consequently, the specific cause of the reported manager's empty Page list is **not established**. Successful Business Suite access alone does not establish what this app's user token can discover. The changes below must not be described as a live validation of that user's access.

### Existing flow

- `lib/instagram.ts#buildInstagramAuthUrl`: Facebook Login (`facebook.com/.../dialog/oauth`), Facebook user-token exchange, Page discovery, linked `instagram_business_account`. This is not Instagram Login; it does not use `instagram_business_*` permission names or `graph.instagram.com` tokens. No mixed flow was found in this path.
- `lib/metaPageDiscovery.ts#discoverMetaPages`: `/debug_token` validates validity, app identity, USER type, user identity, expiry/data access expiry and discovery scopes; paginated `/me/accounts`; fallback IDs from Page-specific granular grants. Therefore the pre-change implementation was **not exclusively `/me/accounts`**.
- `app/api/calendars/[id]/instagram/select-account/route.ts`: legacy picker re-discovers eligible accounts on GET and POST and binds only an account returned by Meta for that session. Encrypted selection session is tied to workspace and authorizing creator.
- `lib/publishing/showworkOAuth.ts#createCanonicalShowworkOAuth`: production canonical dispatcher uses the same discovery helper, stores encrypted selection in a server operation, checks actor/workspace permission, account version and selected account identity at binding.
- `lib/instagramConnection.ts#completeInstagramConnection`: Page token is retained for publishing; messaging subscription is separate. Known missing `MESSAGING` task disables messaging registration without disabling other permitted uses. Unknown task list is not falsely equated to a denial; provider calls enforce access.
- Requested Instagram scopes remain `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`, `pages_read_engagement`, `pages_show_list`, `pages_manage_metadata`, plus gated `instagram_manage_insights`. No new permission was requested by this change. App approval and the individual token's actual grants must both be verified in production; this audit cannot infer either from environment variable names.

### Confirmed implementation issues fixed

1. A single failed fallback Page-token lookup or Instagram relationship lookup aborted all discovery. This could hide an otherwise eligible client account. Now usable accounts survive, with a partial-discovery warning. An empty failed check is explicitly incomplete, never proof of no Page access.
2. Business Portfolio edges were not queried even when the user token already held `business_management`. Discovery now optionally lists `/me/businesses` and each business's `/owned_pages` and `/client_pages`, with pagination. It never requests `business_management` automatically or assumes approval. Every additional Page must return a Page token to the same authorizing user, and explicit granular Page selection still restricts candidates. Business inventory/public Page visibility alone cannot authorize a connection.
3. The Facebook picker UI (`app/dashboard/calendars/[id]/facebook/select-page/page.tsx`) rejected non-owner workspace managers while its POST route already supported `channels.manage`. The UI now uses the same permission check.
4. Canonical Instagram selection omitted diagnostics present in the legacy picker. Safe discovery diagnostics now survive encrypted canonical selection; errors include the applicable safe diagnostics. Facebook selection warns when only part of discovery succeeded. Legacy Facebook callback logs only a safe error category rather than raw provider errors.
5. Empty-list guidance incorrectly implied ownership/administration was required. Copy now explains assigned access, selection grants, linked professional accounts and reconnection. Failed permission verification is shown as unknown, not falsely marked not granted.

## Discovery and diagnosis

The safe diagnostics include: discovery status, successful Page and linked Instagram counts, candidate source counts, whether Business discovery was granted/checked, failed stage and numeric Meta error/subcode where available. No raw provider message, token, secret, request URL, user ID or Business Portfolio name is logged/returned in this diagnostic object.

Interpretation:

- `META_DISCOVERY_PERMISSION_MISSING`: token debug response lacks named discovery scopes. Reauthorize with approved requested permissions; check app access if grants still fail.
- `META_TOKEN_INVALID` / `META_TOKEN_MISMATCH`: expired/revoked authorization, wrong app identity or wrong token type. Restart authorization; administrator should check Facebook Login app credentials.
- `NO_FACEBOOK_PAGES`: completed checks yielded no eligible Pages **for this authorization**. Inspect the person's Page assignment, accepted invitation, selected assets and app grants. This is not proof the person owns/manages no Pages.
- `NO_INSTAGRAM_RELATIONSHIP`: accessible Pages returned no `instagram_business_account`. Verify the Page-to-professional-account link. An absent relationship alone cannot distinguish an unlinked account from a personal/unsupported Instagram account, so the UI does not assert a specific account type it did not inspect.
- `DISCOVERY_INCOMPLETE`: an API/list/token/link check failed. Examine stage and numeric error code; don't present it as a genuine empty account inventory.
- `businessDiscovery: NOT_GRANTED`: no Business API traversal attempted. This is not itself a connection failure. If Meta requires Business access for this app/user scenario, an approved Business permission and suitable login configuration may be required; obtain review/configuration evidence first. Reconnecting cannot grant a permission the app has not requested/been approved to use.

Discovery uses only fixed Graph hosts/version and reconstructed cursor requests, never provider pagination URLs. There is a 100-list/candidate-request budget; exceeded budgets report incomplete discovery. Relationship requests have 15-second timeouts. Canonical orchestration also has its existing 30-second operation timeout; very large portfolios may require a future paginated server-side discovery job if observed latency warrants it.

## Workspace architecture and security

- `SocialConnection` is keyed by `(calendarId, platform, platformAccountId)` and `SocialCalendar` retains legacy per-workspace credentials. Canonical binding additionally scopes account identity/version to workspace and platform; no global account row is repurposed between clients.
- `getCalendarAccess` / `hasCalendarPermission` read current membership. Inbox routes use `inbox.view` / `inbox.reply`, reporting uses analytics permissions, and connection mutation uses `channels.manage`. Existing workspace members use the workspace connection, not their own Meta login. Removing membership prevents subsequent authorized requests. Already dispatched provider requests cannot be recalled by removing a member; AI automation belongs to the workspace and does not stop merely because one teammate leaves.
- Stored Page tokens remain server side; picker responses expose account labels/IDs and safe diagnostics, not credentials. Existing selection envelopes use AES-256-GCM and HTTP-only cookies. Existing working connections are not migrated, reset or disconnected by this change.
- Durable `SocialCalendar` and `SocialConnection` credential columns are stored as readable token strings by application code. Database encryption at rest is not application-level envelope encryption. A separate coordinated credential-envelope migration (all readers/writers/workers, key rotation and backfill) is recommended; it was not silently introduced into this discovery fix.
- This change does not grant publishing/inbox/analytics capability merely because discovery succeeds. Scope grants, Page tasks, provider eligibility, webhook subscriptions and workspace permissions still apply. Facebook Page-token lifecycle/revocation still requires reconnect when Meta invalidates access; this patch does not promise permanent access or add an unsupported refresh mechanism.

## Validation and rollout

Automated provider-mocked tests cover owner discovery, granular delegated Page recovery, multiple Business Portfolios, duplicate candidates, Business inventory without personal Page-token access, granular exclusions, missing discovery permissions, linked/unlinked professional relationships, failed per-Page checks, pagination, invalid/foreign tokens, canonical credential preservation, picker secret exclusion, cross-workspace selection rejection, authorized non-owner picker access and membership removal. These are not live Meta account tests.

Run:

```
node --test tests/meta-page-discovery.test.cjs tests/meta-canonical-oauth.test.cjs tests/meta-workspace-access.test.cjs tests/instagram-review-oauth.test.cjs tests/facebook-reporting-permissions.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
```

A broader existing `tests/calendar-team.test.cjs` run has an unrelated failing inbox-send fixture: it passes a request object without headers to a route now requiring headers/operation deduplication. No inbox code was modified in this task.

Deploy the web release normally. No Prisma schema migration or new environment variable is required for this patch. Any separately packaged application that compiles its own copy of these shared OAuth modules must use the same source release. Do not change Meta approval flags blindly.

After deployment, test with a real owner and the affected delegated manager. Record only the safe discovery status/counters/stages/codes and consent scope names. Confirm Page/Instagram selection against the intended client workspace; test another client workspace and a removed member. If the token has no Business grant and no Page candidates, verify app approval/login configuration and Meta assignment before requesting broader permissions. Never share production tokens or full Graph request URLs in support messages.

## Official reference verification

Meta documentation pages were requested during this review but returned HTTP 429/access errors through the browsing service. Endpoint existence was independently verified against Meta's current official generated Business SDK, rather than third-party workarounds:

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started/
- https://developers.facebook.com/docs/graph-api/reference/user/accounts/
- https://developers.facebook.com/docs/graph-api/reference/business/owned_pages/
- https://developers.facebook.com/docs/graph-api/reference/business/client_pages/
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/user.py (`get_businesses`)
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/business.py (`get_owned_pages`, `get_client_pages`)

SDK endpoint existence does not establish this app's production approval or a particular person's access. Those remain live validation requirements.
