# Retired weekly marketing emails

The weekly post-signup Marketing Workspace campaign has been retired. The authenticated `POST /api/cron/lifecycle-emails` endpoint returns a disabled result and sends no mail.

Deploy the web app with the retired endpoint. Remove any VPS or external schedule that invokes this campaign. If a separate worker still runs a bundled copy of the old sender, stop that campaign job on the worker. The web deployment only changes callers of the web endpoint.

The existing unsubscribe URL remains available for earlier emails.
