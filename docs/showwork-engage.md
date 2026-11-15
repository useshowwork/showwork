# Showwork Engage launch

Entry: `/dashboard/engage`. New eligible customers authenticate and name their business to start a three-day free trial without a card. After the trial, they choose monthly or annual billing to continue. Marketing Workspace trials also last three days. Trial eligibility uses the existing one-time account trial fields; it cannot be restarted by deleting a workspace. Existing trial deadlines are preserved. Returning paid customers land directly in Conversations. Subscription and team access are in Settings.

Package: ₦14,900/month or ₦149,000/year, one business, Facebook, Instagram and WhatsApp connections, owner plus two teammates, 1,000 shared AI drafts/automatic replies per monthly usage period. Annual billing still resets the AI allowance monthly. Human replies do not consume AI quota. There are no paid top-ups. Knowledge documents use a 1 GB account allowance. Comments are future work and are not included as a currently available capability.

Engage is an explicit package, outside the four-tier Marketing ranking. It shares the existing account billing fields, checkout, signed webhook, cancellation, and usage infrastructure. An account has one active workspace package at a time; parallel Marketing and Engage subscriptions on one account are not supported. Existing paid Marketing accounts are not switched automatically. An Engage customer can choose a Marketing plan through Subscription → Explore Marketing Workspace; payment activates the change and preserves business data. Switching starts a new paid period with the existing billing policy (no automatic credit for unused prepaid time).

Server permissions intersect the owner's package with team rights. Publishing eligibility independently rejects Engage, and the canonical content-generation path rejects it. Membership limits use the existing locked-owner team service. Engage supports Facebook, Instagram and WhatsApp with no two-account cap. TikTok, LinkedIn and X connection endpoints reject Engage accounts. The follow-up migration removes the original two-account trigger.

## Deployment

1. Create two NGN recurring plans in Paystack: **Showwork Engage Monthly**, amount **1,490,000 kobo**, interval **monthly**; **Showwork Engage Annual**, amount **14,900,000 kobo**, interval **annually**. Use test plans for a test secret and live plans for a live secret.
2. Set `PAYSTACK_ENGAGE_MONTHLY_PLAN_CODE` and `PAYSTACK_ENGAGE_ANNUAL_PLAN_CODE` in the app and worker environment. Keep the existing signed Paystack webhook endpoint.
3. Review `npx prisma migrate status` and any pre-existing migration baselines. Apply reviewed pending migrations with the normal migration deployment process (`npx prisma migrate deploy` once migration history is in order), including `20261114100000_showwork_engage` and `20261114170000_remove_engage_connection_limit`. Generate the client with `npx prisma generate` before building. A schema push alone does **not** remove the old connection-limit trigger.
4. Build and restart the web app and existing message/auto-reply workers. Do not replace Marketing plan codes.
5. In Paystack test mode, verify monthly and annual checkout, callback/webhook activation, connecting Facebook, Instagram and WhatsApp, teammate invitations, quota exhaustion with human replies still working, cancellation, and a paid switch to Marketing. Do not use live customer accounts for the smoke test.

No production database migration, Paystack plan creation, charge, or deployment is performed by this source change.

## Validation

`node --test tests/engage-package.test.cjs` covers package separation, paid access, permissions, publication/content denial, quota concurrency, authentication, navigation, and checkout amounts.

Set `SHOWWORK_REVIEW_PGLITE_PATH` to an installed `@electric-sql/pglite` package and run `node --test tests/engage-connection-limit.test.cjs` to verify that the follow-up migration removes the original guard and preserves existing connections. This uses an isolated database.
