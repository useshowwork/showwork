# Partnership module audit — 6 November 2026

Scope: repository implementation of partner applications, attribution, commission processing, partner dashboard, bank details and admin review/payout routes. Read-only review of application behavior; no production database, live Paystack transfer, email delivery or deployed configuration verification. No application behavior changed during this audit.

## Current journey

1. An authenticated creator applies at `/dashboard/partners`. The API creates an inactive PENDING profile; it emails the applicant and the team on a best-effort basis. Rejected applicants can reapply; suspended applicants cannot. Application currently collects no additional partner-specific information or agreement acceptance.
2. An administrator approves or rejects at `/admin/partners`. Approval assigns a unique uppercase referral code, sets ACTIVE/isActive and grants one month of legacy complimentary access, extending any future complimentary end date. The legacy complimentary mapping includes Studio workspace access; it is not automatically a paid Agency subscription. Welcome email includes the partner agreement PDF.
3. The referral link is `/signup?ref=CODE`. Signup validates an ACTIVE/isActive partner and stores the code on PendingSignup. OTP verification checks eligibility again and creates one referral for the newly verified creator. The schema permits one referring partner per creator.
4. Verified LIVE initial subscription payments and renewals for Delivery and Marketing Workspace qualify. Commission is 10% of actual recorded whole-naira revenue, rounded down. Test/unverified revenue, Portfolio and one-off project payments do not qualify. Annual payments earn their commission when paid, not monthly.
5. The first qualifying payment starts a shared 12-month eligibility window for that referred creator. Payments at/after the anniversary are excluded. Duplicate payment IDs cannot create duplicate commissions; serializable transactions retry commission conflicts. Commissions start PENDING and require administrator approval.
6. An ACTIVE partner saves Nigerian bank details and requests all APPROVED, unallocated earnings once they total at least ₦5,000. A serializable transaction checks for an existing pending/approved payout and allocates individual commissions. A unique allocation per commission prevents double allocation.
7. Administrators approve, reject or mark approved payouts PAID with a reference. MARK_PAID updates the payout and commission statuses together. **This records manual settlement; it does not send a bank transfer.**

## Findings, in priority order

### P1 — A paid payout can be rejected through the API

Evidence: `app/api/admin/partners/payouts/route.ts:254`. REJECT has no source-status guard: it deletes allocations and changes the payout to REJECTED even when it is already PAID. The UI only displays Reject for PENDING payouts, but that is not an API restriction.

Reproduction: an isolated mocked PATCH with an existing PAID payout and PAID commission returned HTTP 200, called allocation deletion, then updated payout status to REJECTED. No real records changed. This breaks reconciliation: commissions remain PAID while their settlement allocation is removed and the payout is called rejected. This reproduction does not establish that a paid commission can be withdrawn again; the request API still requires APPROVED commissions.

Recommendation: enforce an explicit transition matrix in the API; make PAID terminal. Retain paid allocations permanently and use separate correction/reversal records when needed.

### P1 — Admin review transitions are vulnerable to concurrent stale decisions

Evidence: admin payout PATCH, both commission-review PATCH routes (`app/api/admin/partners/commissions/route.ts:147`, `app/api/partners/commissions/route.ts`), partner approval PATCH. They read a status then update by ID in a default-isolation transaction, rather than conditionally updating the expected source status. The stronger serializable protections used for commission creation and payout requests are not used here.

Impact: simultaneous approve/void, approve/reject or settlement/rejection requests can both make decisions from an old status; last-write behavior can contradict the first administrator's result. This is a code-level concurrency finding, not a production race reproduction.

Recommendation: conditional writes against expected status with affected-row checks, or serializable transactions with retry; record actor and transition history. Cover both duplicated commission endpoints.

### P2 — Payout bank details are mutable, unverified and not snapshotted

Evidence: `app/api/partners/payout-account/route.ts` accepts bank name and account name as free text and validates only a 10-digit account number. `PartnerPayout` has no destination snapshot; the admin payout query reads the partner's current payoutAccount.

Impact: editing bank details changes what an administrator sees for an existing request, including historical requests. The saved account name is not proof that the account belongs to that name.

Recommendation: validate bank code and resolve account ownership with the payout provider; snapshot the approved destination on each request and separately audit subsequent changes. Manual transfer remains a deliberate operational choice.

### P2 — No subscription refund/dispute commission reversal flow found

Evidence: qualifying payment processing in `lib/partnerCommissions.ts`; webhook and paymentSync integration; both commission-review endpoints only allow review while PENDING. No refund/dispute-to-commission adjustment handler was found.

Impact: a later refunded payment can retain an APPROVED or PAID commission, with no supported accounting adjustment path. This does not assert that any production refund has occurred.

Recommendation: define refund/dispute eligibility and implement linked reversals/adjustments, including treatment of amounts already settled.

### P2 — Referral attribution is fragile across navigation and product journeys

Evidence: `app/signup/SignupClient.tsx:108` reads ref only from the current signup URL. Its login link and LoginClient's signup link preserve next but omit ref. No durable referral-cookie/session capture was found. Partner dashboard links contain ref but no product destination (`app/api/partners/dashboard/route.ts:223`).

Impact: direct referred signup works, but signup → login → signup loses attribution. A visitor leaving signup to explore products can lose the code. Partner-generated links also enter generic signup rather than the new product-specific acquisition journey. Arbitrary home-page `?ref=` links are not equivalent to the generated signup link.

Recommendation: preserve a validated referral identifier through product selection and auth switches, with an explicit attribution lifetime/overwrite policy. Offer product-specific referral links.

### P2 — Operational status lifecycle is incomplete

Evidence: admin partner PATCH supports only approve/reject for PENDING applications; SUSPENDED/isActive and referral EXPIRED/DISQUALIFIED states exist but no corresponding normal administration transition flow was found. The dashboard counts expired referrals by persisted status, while commission processing excludes expired dates without changing status.

Impact: expired customers can continue to display as ACTIVE even though no new commissions qualify. The code describes stopping referrals/suspending partners, but normal admin controls for doing so are incomplete.

Recommendation: derive referral eligibility from dates or reconcile statuses; add audited stop/resume/suspend controls with clear rules for earned payouts and existing referrals.

### P2 — Admin totals and scale need clearer treatment

Evidence: `app/api/admin/partners/route.ts:68` aggregates all commissions, including VOIDED, and `:74` aggregates all payouts, including REJECTED and not-yet-paid requests. These become totalCommissions/totalPayouts. The partner dashboard correctly excludes VOIDED from earned totals. Admin lists and the full referral/commission history are unpaginated; partner payout history is limited to 20.

Impact: aggregates cannot be read as valid earnings or money actually paid; large partner histories will increase response/render cost.

Recommendation: status-specific labels/totals, PAID-only settlement totals and paginated histories. Align dashboard canRequestPayout with bank-account and active-request prerequisites; the POST endpoint currently enforces more conditions than that boolean.

### P3 — Partner acceptance and administrative evidence are thin

Evidence: enrollment POST has no partner-specific payload; no agreement version/acceptedAt fields on PartnerProfile; agreement PDF is sent in a welcome email. Review records have dates and optional notes but no dedicated approvedBy/paidBy or immutable transition ledger.

Recommendation: capture agreement acknowledgment/version during application and record administrative actors and changes. This is a product/auditability recommendation, not a legal compliance determination or a review of the PDF's terms.

## Existing safeguards worth retaining

- Authenticated partner routes and email-allowlisted admin routes.
- Server-side ACTIVE/isActive referral validation at signup and verification.
- Unique partner per creator, referral per referred creator, commission per payment and allocation per commission.
- Actual LIVE revenue gating, annual-charge handling and strict 12-month cutoff including leap-day handling.
- Serializable commission creation and payout allocation; minimum payout and bank-account checks on requests.
- Atomic commission/payout marking during settlement; no automatic withdrawal of money on request.

## Validation and limits

`node --test tests/partner-commissions.test.cjs tests/payment-revenue.test.cjs`: **10/10 passed**. These tests establish the covered local calculations, eligibility, idempotency, revenue classification, bank prerequisite and email-outage behavior; they do not cover the unsafe paid-payout rejection or every administrative race.

Additional isolated mocked admin payout reproduction confirmed the paid-to-rejected transition. No production audit or live end-to-end certification was performed. No business logic, balances, emails, payouts or migrations were changed.

Suggested implementation order: terminal payout transitions and concurrency → payout destination snapshots/verification and financial adjustment flow → durable product-aware attribution → lifecycle/admin totals → partner onboarding and audit history.

## Implementation follow-up

All seven requested findings have local implementations: terminal paid payouts; Serializable/CAS administrative reviews with actor audit records; provider-resolved bank details and immutable payout snapshots; provider-verified refund/dispute holds, proportional reversals and paid-commission recovery reconciliation; durable validated referral attribution through product browsing and auth switches; effective referral expiry and pause/suspend/resume controls; and status-specific net earnings/paid-only payout totals. The legacy commission endpoint delegates to the guarded canonical endpoint.

112 focused tests pass, with TypeScript and Prisma validation. See `docs/partner-program.md` for the behavior and deployment runbook. Both new partner migrations remain unapplied; these local checks do not certify production bank resolution, webhook subscriptions, existing balances or manual transfer settlement. The original findings above describe the audited implementation before these fixes.
