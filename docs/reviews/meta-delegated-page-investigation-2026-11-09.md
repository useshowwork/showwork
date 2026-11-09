# Delegated Page discovery investigation

## Evidence from the user's live attempts

The invited user's consent screen offers `useshowworkofficial` (Instagram ID `17841474912514889`). Business Suite shows Useshowwork and this Instagram account available to the invited login. The owner reportedly connects successfully. Showwork's latest response identifies only Dirandy (`310133648860313`), obtained through Page-specific token grants, and no linked Instagram account for that Page.

These facts establish a mismatch between the intended Useshowwork asset and the Page admitted by discovery. They do not establish a broken Page-to-Instagram link, missing ownership, or a universal need for `business_management`.

## Code findings

1. `/me/accounts` results are filtered against `pages_show_list` granular targets before the `sources.accounts` counter increments. Therefore the earlier `sources.accounts:0` response did NOT establish that the raw endpoint returned zero Pages. That earlier interpretation was too strong. Diagnostics now separately include `accountsReturned` and `accountsExcludedBySelection`.
2. Without a Business grant, additional candidate IDs come only from granted Page scopes, again restricted by any explicit Page-list selection. Useshowwork is never directly checked if its ID does not enter that candidate set.
3. Discovery reads `instagram_business_account` using the Page token. The official Meta Instagram Postman collection also documents looking up a known Page with a user token. To distinguish token-subject differences from asset-selection restrictions, the support probe reads the relationship using each token separately. Discovery behavior is not changed without live evidence.
4. There is no saved Instagram or Facebook connection in either queried affected workspace (`6b729ea1-896c-41c4-bc5f-9fa421e9b510`, `d13b4f2b-ae03-4652-b585-b9883942e97b`) in the configured database at investigation time. The read-only lookup selected IDs/names only, never credentials. This does not contradict a successful but unsaved owner authorization or establish that every other workspace lacks a connection.

## Read-only direct check

A fresh actor/workspace-bound legacy Instagram selection session can call:

```
GET /api/calendars/WORKSPACE_ID/instagram/select-account?checkPageId=FACEBOOK_PAGE_ID
```

The check validates the user token against the configured app, then asks Meta for the exact Page's identity/Page token and reads its Instagram relationship with user and Page token subjects. The returned object includes a safe identity, consent-selection status, Page-token-issued boolean, relationship results and numeric failure codes. No user/Page token or raw provider message is returned or logged. No connection, post, subscription or Meta assignment is changed. The supplied ID cannot be used as account-binding evidence and does not enter normal discovery candidates.

Use the actual Facebook Page ID. Business Suite's URL shows `asset_id=381092961751993`, which is a candidate to verify against Facebook Page settings; a Business Suite asset parameter alone is not definitive proof of object type.

The original OAuth user token is only in the invited browser's encrypted HTTP-only selection cookie. It is not available to this coding session. Therefore no live delegated direct Graph request was made during this investigation, and the remaining result must be obtained from that browser. Do not export/share the cookie or user token. Canonical selection tickets retain Page tokens rather than the authorizing user token; that connection mode explicitly returns `META_DIAGNOSTIC_SESSION_UNAVAILABLE` instead of pretending to perform this user-token comparison.

## Interpret the result

- `pageListSelection: NOT_SELECTED`: the requested Page ID is outside the token's explicit Page-list targets. Confirm which Page Meta allowed in consent; selecting an Instagram account is not proof the matching Page was selected. The diagnostic does not override this restriction for connection.
- `pageTokenIssued: false` / `NO_PAGE_TOKEN`: a readable Page identity is not usable delegated Page authorization. Investigate Page assignment, consent and app/provider access with the actual response.
- `ACCESS_CHECK_FAILED`: inspect the safe Meta code and confirm the ID/type; do not invent an ownership diagnosis.
- Both relationship reads return `FOUND`: the exact Page is reachable, while discovery/selection omitted it. Any discovery correction must preserve asset consent and verify a usable Page token.
- User token `FOUND`, Page token `NOT_RETURNED` or `CHECK_FAILED`: evidence for changing the relationship lookup subject, while retaining the verified Page token for publishing.
- Both relationship reads return `NOT_RETURNED`: Meta did not expose that link to this authorization; compare the verified Page ID/link/asset grants and owner response before changing accounts.

No new permission is requested, no permission flag is enabled, and no Prisma migration is required by this investigation.

Official reference: Meta's Instagram API collection, including “Get Specific Page Access Token”: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-3fe78620-2258-44b6-893f-42d76c7200d7 . Meta developer documentation endpoints were rate-limited during earlier browsing; conclusions about the affected user rely only on supplied live responses and code, not on third-party permission assumptions.

## Discovery correction implemented

Discovery now requests the linked Instagram relationship in user-token Page enumeration and direct Page credential retrieval, matching Meta's documented discovery flow. If absent, it checks the relationship with the authorizing user token before a Page-token compatibility fallback. A relationship already found is retained. The issued Page token remains the publishing credential; explicit asset selections, actor/workspace authorization and credential requirements remain enforced.

Regression coverage includes delegated user-only relationships, enumeration and direct lookup preservation, owner Page-token fallback, and canonical connection credential binding. The focused suite passes 40 tests. This proves the token lookup correction locally, not the affected production authorization: if Meta returns only Dirandy and never exposes the intended Page, that separate asset-selection/access issue remains unresolved. Deploy and retry with the invited profile to verify the actual assets returned. No new scope or database migration is required by this correction.
