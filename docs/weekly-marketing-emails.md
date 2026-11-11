# Email audit and weekly Marketing Workspace campaign

## Scope and findings

Repository audit: `lib/resend.ts`, all callers in `app/api`, scheduled email services and email scripts. Production scheduler configuration and delivery-provider logs were not available; this report describes code, not verified production sends. No real messages were sent during implementation.

Before this change, general promotional mail consisted of:

| Message | Trigger / location | New behavior |
| --- | --- | --- |
| Welcome | `app/api/auth/verify-otp/route.ts`, plus retry in `lib/lifecycleEmails.ts` | One short welcome after signup, introducing all three products with direct links; provider idempotency key per creator |
| Portfolio invitation | Day 1 in `lib/lifecycleEmails.ts` | Removed |
| Project-management introduction | Day 2 in `lib/lifecycleEmails.ts` | Removed |
| Creativo promotion | Day 2 in `lib/lifecycleEmails.ts` | Removed |
| Project-delivery reminder | Day 2, then weekly without recent project creation | Removed |
| Trial reminders | Two days left, one day left, expiry day, and after expiry in `lib/calendarTrialEmails.ts` | Separate drip retired; trial information stays in the app |
| Offline portfolio reminder | Daily per portfolio in `scripts/send-portfolio-payment-reminders.ts` | Retired; actual payment-failure notification remains |

The old lifecycle worker could send every overdue stage together. It also lacked an atomic per-recipient claim, so concurrent runs could race before recording delivery. The replacement prevents campaign bursts and concurrent claims.

## New policy

- One promotional campaign: **Marketing Workspace only**, plus a separate one-time welcome introducing Marketing Workspace, Project Delivery and Portfolio.
- At most one provider attempt per recipient in a rolling seven-day period, regardless of cron frequency. Successful sends also enforce a full seven-day gap.
- First promotional email no earlier than seven days after signup or the legacy sequence anchor.
- Recent welcome, legacy promotion and trial timestamps delay the new campaign until seven days have passed. No catch-up emails.
- Three concise, prewritten variants. A stable recipient offset varies the starting message; successful delivery advances the rotation. Normal deliveries never repeat consecutively. An uncertain delivery/database acknowledgement may mean a future week's message repeats rather than incorrectly assuming success.
- A failed or ambiguous attempt keeps its weekly reservation; no automatic resend that week. This intentionally favors fewer messages. Monitor `failed` in the protected endpoint response.
- No paid AI calls to generate email copy and no customer business documents or inbox messages in these emails.
- Existing account emails are the recipient source. No new email-collection form or additional personal data is required.
- Deactivated or unsubscribed accounts are excluded, and eligibility is checked again after reservation.

The three messages in `lib/weeklyMarketingContent.ts` are:

1. **A full content calendar. A clearer week.** Business knowledge and brand voice help teams generate the next week's calendar. CTA: **Plan my content calendar**.
2. **Less chasing approvals. More moving forward.** Content, team feedback and client approval in one workspace. CTA: **Open Marketing Workspace**.
3. **Make your next content plan an informed one.** Use available analytics and recommendations to shape the next calendar. CTA: **Explore my workspaces**.

All CTAs open `/dashboard/calendars`. The emails use the Showwork email shell and logo, a short personalized greeting, one practical next step, HTML and plain text, and unsubscribe links/headers.

## Essential emails retained

These are event-driven service notifications, not the weekly promotional campaign. They can still arrive more often than weekly:

| Purpose | Sources / templates |
| --- | --- |
| Verification, password reset, account recovery | `app/api/auth/signup`, `app/api/auth/forgot-password`, admin creator routes; OTP/reset/recovery templates |
| Payment failures and actual billing benefits | Payment webhook; `lib/billingBenefitNotifications.ts`; billing-benefit cron |
| Team/client invitations | Project/managed-project invite routes, collaborator route, `lib/calendarTeamService.ts` |
| Reviews, comments, revisions, uploads and assignments | Media review/comments/replacement routes, managed-project task/upload/review routes, calendar review/resubmit routes and `lib/calendarReviewNotifications.ts` |
| Customer requests for a human | `lib/socialMessaging/handoffNotifications.ts` |
| Partner application, referral, commission and payout updates | Partner enrollment/admin routes, signup referral notification, payment webhook |
| Requested demo/webinar/application confirmations | Book-demo, webinar RSVP, webinar-host application and spotlight submission routes |

The weekly limit applies to promotional emails. Suppressing service notifications would interfere with authentication, billing and team/customer workflows.

## Tracking and unsubscribe

Migration `20261111090000_weekly_marketing_emails` adds four Creator fields: last attempt, last successful send, success count and opt-out timestamp. Existing campaign history is preserved.

`lib/lifecycleEmails.ts` atomically reserves the recipient with `updateMany` before email I/O and supplies a provider idempotency key. Reservations are not released after uncertain failures.

`/api/email-preferences/marketing` uses a purpose-bound HMAC with the existing `JWT_SECRET`, tied to the creator ID and current email. GET only shows a confirmation, so ordinary link scanners cannot opt someone out. Signed POST performs the opt-out and supports provider one-click unsubscribe. Opting out leaves essential account/activity emails enabled. Do not log unsubscribe query tokens.

## Deployment handoff

1. Stop old email-worker processes during the rollout so old and new campaigns cannot run together.
2. Deploy the updated code to the web host **and whichever VPS worker/scheduler actually invokes the email services**. This repository does not contain the live VPS schedule; deploying the web app alone cannot replace an old worker bundle.
3. Apply migrations and regenerate the client against the correct deployment database:

   ```sh
   npx prisma migrate status
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Confirm the existing `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL` and `CRON_SECRET` are configured. No new API key is required. Keep `JWT_SECRET` consistent between the campaign sender and web app so unsubscribe links validate.
5. Restart/rebuild the relevant web and email worker processes using their existing deployment commands.
6. Keep the protected **POST `/api/cron/lifecycle-emails`** schedule, with `Authorization: Bearer <CRON_SECRET>`. Poll daily for a small audience or hourly for a larger one. Each run selects up to 200 due users, five at a time; eligibility and the database reservation enforce the weekly recipient limit. Ensure schedule capacity covers the audience; 200 daily attempts cannot service more than 1,400 recipients weekly.
7. Remove the separate `calendar-trial-emails` schedule and the portfolio reminder script schedule. Their updated entrypoints are harmless no-ops during rollout. Remove any independently configured provider campaigns too; this code cannot disable external campaigns.
8. Verify scheduler summaries (`processed`, `weeklyMarketingSent`, `skipped`, `failed`) and provider delivery logs. Do not trigger a live manual batch merely to test deployment.

No migration was applied and no production scheduler was changed during implementation. Avoid this repository's `prestart` / `npm run build` for migration deployment: `prestart` currently invokes a destructive `db push --accept-data-loss`.

## Validation

`tests/weekly-marketing-emails.test.cjs` covers weekly suppression, concurrent reservations, recent-signup and old-campaign cooldowns, failed/uncertain sends, missed runs, rotation, escaping, workspace-only content, unsubscribe authenticity and retired jobs. Existing billing-benefit notification tests verify retained service mail behavior. Database concurrency is exercised with mocked conditional updates; no production database or real email provider was used.
