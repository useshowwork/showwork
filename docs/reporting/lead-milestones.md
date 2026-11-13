# Date-filtered lead analytics

The overview reports three period-based metrics:

- **New leads:** leads whose `createdAt` is in the selected UTC date range.
- **Hot leads:** distinct leads with a HOT milestone in the range, regardless of creation date or subsequent status.
- **Converted customers:** distinct leads marked CUSTOMER in the range, regardless of creation date or subsequent status.

A database trigger records entries into HOT/open and CUSTOMER in the same transaction as the lead change. It covers manual edits, inbox updates, imports, and other writers. Repeating an unchanged status does not create an event. Leaving and reentering a stage creates another event, but a lead counts only once per metric per reporting period.

The manager's opportunity shortlist remains a separate view of leads marked hot during the period that are **currently** hot and open. Client reports receive aggregate counts, never the individual lead records.

## Rollout

Apply `prisma/migrations/20261113170000_lead_analytics_milestones/migration.sql` through the normal database migration process and deploy/restart with the regenerated Prisma client. Review other pending migrations before running `prisma migrate deploy`.

The migration adds two tables and an AFTER trigger; it does not rewrite existing leads or fabricate past milestones. It records when tracking starts. Periods that overlap the tracking start show recorded milestones with a partial-history explanation. Periods entirely before tracking display unavailable stage-change counts. New-lead counts still use the existing creation dates.

Before the migration is applied, reporting shows clearly labelled **Current hot leads** and **Current customers** snapshots. These totals respect channel filters but do not claim date-filtered stage-change accuracy. The SQL is repeatable without resetting the tracking start time or duplicating old milestones.

## Validation

Run the focused reporting tests and Prisma schema validation. The database trigger regression test additionally runs when `SHOWWORK_REVIEW_PGLITE_PATH` points to a disposable PGlite installation; it does not use the application's configured database.
