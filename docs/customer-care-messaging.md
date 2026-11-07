# Customer-care messaging

Inbox → Customer-care playbook sets the default tone for automatic replies and staff drafts. The playbook can be edited while automatic replies are switched off. Existing workspaces default to Professional and retain their old reply guidance.

## Setup

Choose Professional, Warm & friendly, Direct & concise, Premium & polished, Patient & empathetic, or Upbeat & engaging. Add:

- Industry and confirmed business/service details, support contacts and hours.
- Prices with currencies, inclusions, booking/delivery requirements and published policies.
- Relevant qualification questions, ordered by usefulness.
- Handoff rules: decisions requiring private records, approval or a staff member.
- Additional voice guidance such as spelling preference or emoji policy.

Save the settings. The workspace Knowledge summary is also supplied, with confirmed pricing and policies in the playbook taking priority. Customer claims and an existing draft are not treated as verified business facts. Conflicts should go to the team.

Example qualification guidance for a photography business: “For a booking enquiry, ask the event date, location and coverage required, only when the customer has not already supplied them. Do not confirm availability without staff checking the diary.” Add actual confirmed pricing separately; never fill a price field with an illustrative amount.

## Staff drafts

In a supported conversation, select a Reply tone, optionally add facts or direction under Add context for this reply, and click Draft reply. If the composer already contains text, Improve draft uses it as wording to improve rather than proof of business facts.

The preview does not send or replace typed text. Use draft copies the suggestion into the editable composer. Reply remains the explicit send action. Team review reasons appear separately from the customer-facing text. Switching conversations or receiving a newer customer message cancels or clears the suggestion. Encrypted X Chat content is excluded from AI drafting.

## Reply behavior

The prompt directs replies to answer the actual question, use the recent conversation, match language and mood, avoid repeated qualification questions, ask at most one or two useful questions, and use short, natural paragraphs. Complaints should receive specific, calm care regardless of brand tone. Replies must not invent prices, availability, compensation, completed actions or policy exceptions, claim to be human, or request credentials and payment-card details.

Topic keywords no longer cause automatic transfers. AI offers a teammate after several replies or when it needs help, and continues unless the customer agrees or directly asks for a person. Sensitive values are masked before AI processing; the topic itself does not pause the thread. Staff drafts can offer a safe acknowledgement while flagging the issue for review. Invalid, empty or oversized model results are rejected rather than truncated and sent. Older queued messages are skipped if their fetched history already contains a newer customer message or a reply. Existing WhatsApp window and pre-send checks remain in place.

Output uses the existing Responses API strict JSON schema, following [OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs). Schema validation ensures shape; it does not establish that facts or wording are correct.

## Deployment and verification

Apply `20261002160000_customer_care_reply_profile` with the normal Prisma migration deployment and regenerate Prisma Client. The additive migration adds one nullable JSONB column to SocialInboxSettings and needs no data backfill. No database migration is applied by the code change itself.

Run:

```sh
node --test tests/customer-care-replies.test.cjs tests/whatsapp-messaging.test.cjs tests/social-integrations.test.cjs
npx tsc --noEmit --incremental false
```

Tests mock the model and providers; they verify configuration, permissions, generation inputs, validation and handoff handling. Before enabling automatic replies, evaluate the configured model on representative business enquiries, complaints, unknown prices, conflicting policies, returning customers, and requests for a person. No prompt guarantees perfect factual accuracy. Live model evaluation needs authorization and is separate from the local test suite.

## Human handoff and notifications

Customers choose a human handoff. The application tracks the exact offer, accepts a contextual Yes/No, and suppresses repeated offers for 24 hours after a refusal. A direct request for a person is already consent. Payment and complaint vocabulary does not force a transfer. Technical delivery failures still require operator attention. See the current [consent policy and migration instructions](reviews/inbox-reliability-2026-11-07.md).

A handoff atomically persists the pause and email notification records. The owner is always a recipient, together with every current teammate whose effective permissions include `inbox.reply`. If no teammate has that responsibility, current Social Media Managers are the fallback alongside the owner. Removed or no-longer-responsible recipients are checked again before sending. The fallback notification does not grant inbox access; an owner must grant that permission before the recipient can read or reply.

The inbox has a Needs attention filter, a reason, Take over and Resume AI controls. Other workspace pages show a handoff alert. Opening a message or marking it read does not clear the alert. Taking over acknowledges it; a further incoming message reopens attention while leaving AI paused. Staff replies also pause AI automatically. Resume AI invalidates in-flight drafts and retires older pending messages, so AI only handles future incoming messages. It does not enable the workspace-wide automatic replies switch. The processor rechecks the conversation version and newer messages just before provider delivery. A provider request already in transit cannot be recalled.

Email alerts link to the exact conversation. They contain no customer text, sensitive data, or raw model explanation. One recipient notification is queued per handoff episode; follow-up messages do not generate email spam. Failed emails retain their notification identity and retry with backoff through the existing social inbox processor. Successful API acceptance is recorded separately from the conversation pause; mailbox delivery still depends on the email provider and recipient.

Deploy the additive migration `20261021090000_inbox_human_handoff` and regenerate Prisma Client **before running this application version**. This change does not apply migrations automatically. Normal deployment uses `npx prisma migrate deploy` against the intended database. Review pending migrations before running it. Keep the existing scheduled `/api/cron/social-inbox-auto-replies` recovery job active, and configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `NEXT_PUBLIC_APP_URL` in the environment hosting the app. The website stays on Vercel; the existing VPS worker continues to call the authenticated recovery endpoint.

Focused regression coverage: `node --test tests/inbox-handoff.test.cjs tests/customer-care-replies.test.cjs tests/whatsapp-messaging.test.cjs tests/social-integrations.test.cjs tests/calendar-team.test.cjs tests/social-auto-reply-dispatch.test.cjs tests/workspace-section-navigation.test.cjs`.

## Delivery reliability update

See [7 November reliability and deployment instructions](reviews/inbox-reliability-2026-11-07.md). The additive outbound ledger migration must be applied before starting this version on both the website and VPS worker. Web search is now opt-in and conditional; sensitive prompt fields are masked. Provider timeouts remain Unconfirmed and are never automatically replayed.
