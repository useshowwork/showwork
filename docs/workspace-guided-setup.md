# Marketing Workspace guided setup

New workspaces use this sequence: publishing preference, business knowledge, brand voice, connected social channel, first content batch, and content review. The setup card follows the user between sections. It refreshes progress after uploads, generation, and OAuth returns, including connections opened in another tab. Owners explicitly finish after reviewing their content.

Automatic publishing starts off until the owner makes a choice. Selecting automation retains existing team/client approval requirements and platform eligibility checks. Existing workspaces retain their settings and are not enrolled automatically. The old navigation tour is no longer mounted.

Generation in newly enrolled workspaces is blocked in the UI and generation API until publishing preference, knowledge, brand voice, and channel prerequisites are complete. Knowledge excludes the generated brand-personality document. Any connected publishing channel qualifies; connection-specific publishing requirements still apply.

## Deployment

Apply the additive migration `prisma/migrations/20261106010000_workspace_guided_setup/migration.sql` using the project's migration deployment process before releasing the updated application. Regenerate the Prisma client and deploy/restart the web application and any VPS processes that use its Prisma client. The migration adds `setupVersion`, `publishingPreferenceSetAt`, and `setupCompletedAt` to `SocialCalendar`, without changing existing publishing preferences or deleting data.

The database migration is included but has not been applied by this code change. No database reset or `db push --accept-data-loss` is required.

## Verification

Create a workspace, select either publishing preference, add a business source, save all five brand voice choices, connect a channel, generate content, open the content review step, and finish setup. Refresh between steps to confirm persistence. Existing workspaces should open without setup, and their publishing preference should be unchanged.

## Removing posts that are publishing

Apply `20261106020000_retained_calendar_post_deletion` before deploying the removal UI and its updated web/VPS publishing code. It adds an indexed `CalendarPost.deletedAt` marker. The reset conflict response identifies each blocking post. The owner can remove a post or explicitly remove blocking posts and reset together.

Posts with unresolved external attempts are hidden immediately from manager/client calendars but keep their provider records and media. The scheduler cannot start new publishing for removed posts; accepted TikTok requests can still reconcile. Storage cleanup releases retained posts and files only after the outcome is settled. Removing a calendar post does not delete an already-live post from a social network. Uncertain failures retain evidence until their outcome is reconciled.
