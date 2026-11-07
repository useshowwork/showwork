# Inbox reliability and AI handoff — 7 November 2026

## Delivery contract

Manual replies require an `idempotency-key`. One operation is scoped to one conversation and a hash of its text, actor and AI flag. Reusing the key for different content is rejected. Serializable admission and a conditional PENDING → SENDING update guard concurrent execution. External provider IO never runs inside a retried database transaction.

The operation and PENDING message are committed before delivery. Staff admission also pauses AI and increments the conversation control version. Provider acceptance and message state are then recorded together; provider acceptance is labelled SENT, never DELIVERED without provider evidence. Provider echoes arriving first are folded into the same tracked message.

A timeout or a failure to record provider acceptance is UNCONFIRMED. Replaying that operation never sends it again. An unresolved operation blocks a new send in that conversation. Stale SENDING operations become UNCONFIRMED; stale PENDING operations are cancelled because provider IO was never claimed. Both are reconciled when the inbox or AI processor runs, so recovery needs a functioning app/worker, not an in-memory timer.

The UI displays Sending or “Unconfirmed—check before retrying”. A permitted teammate can explicitly acknowledge checking the platform inbox. That acknowledgement records who checked and when, permits future sends, and leaves the original delivery unconfirmed. It does not retry, claim delivery, or clear its audit trail. The composer text is retained on errors. Encrypted X Chat retains its separate existing device-based send protocol.

Cross-system exactly-once delivery cannot be guaranteed without provider support: a process can stop after provider acceptance and before saving its response. This implementation preserves uncertainty instead of automatically replaying that send. All provider exceptions are conservatively treated as unconfirmed after the send callback begins, including some definite provider rejections; operators check rather than automatically retrying them.

## Customer-chosen team assistance

Payment, purchase, complaint and sensitive vocabulary never automatically transfer a conversation. AI continues helping using confirmed facts and masked customer data. Explicitly asking for a person is itself consent and transfers immediately.

After three AI replies, or when the model recommends help because it lacks confirmed information, append: “Would you like a member of our team to join this conversation?” The choices are “Yes, connect me” and “No, keep helping”. WhatsApp uses interactive buttons and Facebook Messenger uses quick replies. Instagram and other text adapters receive the same choices as text. No channel is falsely promised native buttons it does not currently implement.

Offers persist only after the outbound send is recorded, together with the exact outbound message ID. A Yes/No response is accepted as consent only when it answers the current tracked offer (the latest sent outbound message), within 24 hours. An unrelated yes, an old button response, or a yes to another question must not transfer the customer.

- Yes: atomically pause AI and queue owner/responsible-team notifications, then send a fixed acknowledgement: “Thanks. I’ve notified our team. A team member will reply here when available.” No unconfigured response time, live agent presence, phone or email address is invented.
- No: continue helping, clear the pending offer, and suppress another offer for 24 hours. A later direct human request still works.
- Ignoring an offer does not pause AI. Model recommendations never authorise a transfer.
- Technical failures, unconfirmed delivery, disconnected channels and platform reply windows retain operational safeguards. They are not topic-based sales handoffs.

Common secrets, labelled credentials/codes, card-length numbers, emails and phone numbers are masked before retrieval and AI payloads. This is heuristic masking, not complete DLP. Sensitive topics such as password resets may receive general approved guidance; AI never requests or repeats secret values.

Managers can save **Approved payment instructions** in Inbox settings. Only this explicitly approved field supplies payment destinations; customer messages and web results cannot replace them. Credential/card-security values are rejected in this setting. Public business payment destinations are intentionally retained in normal non-search prompts. Web search defaults off and only qualifies for current public-information questions; payment questions never enable it, and approved payment instructions are omitted from web-enabled requests.

## Deployment

No production migration, deployment, provider send or paid AI call was performed while implementing this change.

1. Review pending migrations against the intended database: `npx prisma migrate status`.
2. Deploy additive migrations `20261107100000_inbox_outbound_reliability` and `20261107110000_inbox_customer_handoff_consent` using the normal reviewed `npx prisma migrate deploy` process. This command applies all pending migrations, not just this one.
3. Regenerate Prisma Client (`npx prisma generate`) and build the website and VPS worker from the same release. The migration must precede starting this application version.
4. Restart/update the actual worker service using the existing deployment procedure. A website-only deployment leaves the old worker bypassing these safeguards.
5. Verify the authenticated inbox sync recovery job, AI reply recovery job and handoff notification processing in production.
6. Perform controlled live incoming/manual/AI reply tests for each configured messaging adapter. Verify provider receipts, duplicate notification replay, takeover and timeout handling. Do not enable production-wide automation solely on mocked test results.

## Verification

Focused tests cover outbound replay, changed-payload rejection, provider timeout, DB failure after acceptance, interrupted sends, cancellation, platform-check permissions, cron authentication, sensitive-data masking, conditional search, AI takeover, WhatsApp messaging and existing social integrations. Tests use mocked providers/model/DB and do not establish production migration status or actual provider delivery.

## Provider reference

Interactive WhatsApp payloads follow [Meta’s interactive reply-button example](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/). The referenced SDK is archived; the implementation uses the existing HTTP adapter, not that SDK. Production channel delivery still requires live verification.

## Actions AI cannot perform

The reply service has no payment verification, refund processing/approval, order mutation or private-record lookup tool. AI must name that limitation, explain that the team is required for the action, and offer to notify the team to respond in the same conversation when available. It may explain published policies, but cannot present more AI conversation as a way to complete the unavailable action. Refusing a team offer does not grant the AI those capabilities. Notification still waits for consent or a direct human request; no response time is invented. These are prompt instructions plus a deterministic fallback for missing/unusable replies, not a guarantee of model semantic accuracy.

## Reply readability

AI instructions now explicitly request concise, correctly punctuated plain text with one or two sentences per paragraph and real blank lines between ideas. A deterministic formatting pass normalises spacing and splits dense text at safe sentence/word boundaries without inventing punctuation or changing prices, account identifiers or URL tokens. Intentional lists and detail blocks retain their line breaks. The formatter is shared by AI output and the Showwork display of AI messages. Provider adapters preserve the resulting newlines. Previously delivered messages on external platforms cannot be reformatted retroactively. Handoff offers are separated by a blank line and no longer truncate the preceding reply mid-word or mid-link.
