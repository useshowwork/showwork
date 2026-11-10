# Analytics automatic updates

## Release order

1. Deploy the additive `20261110010000_reporting_sync_jobs` migration with `npx prisma migrate deploy`, then regenerate Prisma Client (`npx prisma generate`). Do not use `db push --accept-data-loss`.
2. Deploy the web application. Saved reports remain readable if queue initialization fails; an inline notice explains that automatic updates are unavailable.
3. Enable the reporting timer below on the VPS. Remove any older reporting scheduler so there is one recurring scheduler. Publishing and AI worker services are unchanged.

No OpenAI calls are made by this queue. Recommendations still require an explicit user action and the existing entitlement/quota checks.

## Runtime

The web app persists one reusable `ReportingSyncJob` per social connection. An authorized report read enqueues observations older than one hour and opportunistically processes one job with Next.js `after`. This includes a password-verified client report; private workspace data and sync errors remain behind existing permissions. Manual Update now has a five-minute cooldown. Normal connection upserts enqueue an initial update after commit; canonical connection flows are also picked up by the scheduled scan and report-open check.

The protected POST `/api/cron/reporting-sync` schedules six-hour refreshes and processes up to five jobs, stopping between jobs after a three-minute budget. Call it every minute. A unique connection row plus atomic claims prevents concurrent workers/tabs processing the same connection. Claims have renewable ten-minute leases; interrupted jobs recover after lease expiry. Three attempts maximum, with backoff and a six-hour failed-job cooldown. Disconnected accounts and inactive/uncovered workspaces are rechecked before provider IO.

The processor is exported as `runNextReportingJob` in `lib/reporting/jobs.ts` if the separate functions package later owns dispatch. No existing AI/publishing worker has been repurposed or enabled in this repository.

## VPS timer setup

Create `/etc/showwork/reporting-curl.conf`, owned by root and readable only by the showwork group (`0640`). Enter these values on the server; use the existing web application's CRON_SECRET, never commit it:

```text
url = "https://YOUR-SHOWWORK-DOMAIN/api/cron/reporting-sync"
request = "POST"
header = "Authorization: Bearer YOUR_EXISTING_CRON_SECRET"
```

Copy `deploy/vps/showwork-reporting.service` and `deploy/vps/showwork-reporting.timer` into `/etc/systemd/system/`, then:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now showwork-reporting.timer
sudo systemctl start showwork-reporting.service
sudo systemctl status showwork-reporting.timer --no-pager
sudo journalctl -u showwork-reporting.service -n 30 --no-pager
```

A successful invocation reports `{ "queued": ..., "processed": ... }`. `processed: 0` is normal when no eligible work is due. Check pending-job age in `ReportingSyncJob` as account volume grows; increase processor capacity in the separate worker package if the backlog approaches six hours. The scan checks 100 oldest-unchecked stale connections per invocation. A separate check timestamp rotates inactive workspaces out of the way without falsely marking them as synced.

## Verify in production

- Connect a supported channel and open Analytics: first results should appear without clicking Update now.
- Reopen a fresh report: no provider calls should be queued unnecessarily.
- Open the same stale report in two tabs: one job per connection, existing numbers remain visible.
- Confirm Instagram, Facebook, TikTok, X and LinkedIn work where API access permits; YouTube is not advertised as a supported metrics adapter.
- Disconnect/revoke access: reconnect guidance should appear; other channels continue updating.
- Confirm a password-locked client cannot read or queue reporting; a verified client sees saved results without private leads or provider errors.
- Check reports at mobile widths and switch Overview, Posts and Recommendations. Paid AI analysis must not run on page load or refresh.

Provider availability, permissions and rate limits still apply. An update can complete with partial metrics; unavailable counters remain dashes and missing chart observations remain gaps.
