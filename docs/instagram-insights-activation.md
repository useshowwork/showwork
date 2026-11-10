# Instagram Insights after Advanced Access approval

Instagram authorizations now request `instagram_manage_insights` by default. An explicit `INSTAGRAM_REQUEST_INSIGHTS_SCOPE=false` still disables it (except for allowlisted review creators).

For existing VPS environments, set `INSTAGRAM_REQUEST_INSIGHTS_SCOPE=true`, deploy the updated app and restart it so the process loads the new environment. Local development must also restart after environment changes.

Existing tokens do not gain permissions when the app is approved or this flag changes. Use Restart authorization / Reconnect and allow Insights access. Confirm the returned `grantedPermissions` contains `instagram_manage_insights`; the connection screen reflects actual grants, not app approval. Metrics also depend on account eligibility and successful synchronization.

The always-visible Facebook Page ID lookup verifies access to a specific Page when Meta omits it from discovery. It does not bypass asset permissions. Users can find the Page in Meta Business Suite settings, select the relevant business portfolio, then Accounts > Pages > their Page and copy its Page ID.
