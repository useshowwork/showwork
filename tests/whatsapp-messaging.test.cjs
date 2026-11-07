const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
// Transpile isolated modules with explicit DB/storage doubles. No .env load,
// real provider calls, database writes, or package installation is required.
function load(file, mocks = {}, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function localRequire(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target.endsWith('.ts') ? target : target + '.ts', mocks, cache);
    }
    return require(name);
  }
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  cache.set(file, mod.exports); return mod.exports;
}
const envKeys = ['WHATSAPP_APP_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
afterEach(() => { for (const key of envKeys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; } });
function configure() { process.env.WHATSAPP_APP_ID = '12345'; process.env.WHATSAPP_APP_SECRET = 'test-secret'; process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-test'; }
const connection = () => ({ id: 'connection', calendarId: 'workspace', platform: 'WHATSAPP', platformAccountId: '22222',
  whatsappBusinessAccountId: '33333', status: 'CONNECTED', accessToken: 'test-token', connectedAt: new Date(Date.now() - 3600000),
  messagingWebhookSubscribedAt: new Date(), messagingWebhookError: null });
const message = (extra = {}) => ({ id: 'wamid.inbound', from: '2348000000000', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'How much is it?' }, ...extra });
const notification = (messages = [message()], extra = {}) => ({ object: 'whatsapp_business_account', entry: [{ id: '33333', changes: [{ field: 'messages',
  value: { metadata: { phone_number_id: '22222' }, contacts: [{ wa_id: '2348000000000', profile: { name: 'Ada' } }], messages, ...extra } }] }] });
const whatsapp = (db = {}, extra = {}) => load('lib/socialMessaging/whatsapp.ts', {
  '@/lib/db': { db }, '@/lib/calendarPermissions': {hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null,  canAccessCalendarById: async () => true },
  './ingest': { ingestSocialMessage: async () => true }, './dispatchAutoReply': { dispatchSocialInboxAutoReply: async () => true }, ...extra,
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('signature rejects forgery, missing secret, altered bodies and malformed headers', () => {
  const { createHmac } = require('node:crypto');
  const api = whatsapp(); const raw = JSON.stringify(notification());
  const signature = 'sha256=' + createHmac('sha256', 'secret').update(raw).digest('hex');
  assert.equal(api.verifyWhatsAppSignature(raw, signature, 'secret'), true);
  assert.equal(api.verifyWhatsAppSignature(raw + ' ', signature, 'secret'), false);
  assert.equal(api.verifyWhatsAppSignature(raw, signature, ''), false);
  assert.equal(api.verifyWhatsAppSignature(raw, 'sha256=x', 'secret'), false);
  assert.equal(api.verifyWhatsAppSignature(raw, null, 'secret'), false);
});
test('normalizes text and interactive replies, retaining phone and profile name', () => {
  const api = whatsapp(); const text = api.normalizeWhatsAppMessage(message(), 'Ada');
  assert.equal(text.name, 'Ada'); assert.equal(text.username, '+2348000000000');
  assert.equal(text.conversationId, text.participantId); assert.equal(text.autoReplyEligible, true);
  assert.equal(api.normalizeWhatsAppMessage(message({ type: 'interactive', interactive: { button_reply: { title: 'Pricing' } } })).text, 'Pricing');
  assert.equal(api.normalizeWhatsAppMessage(message({ type: 'image' })).autoReplyEligible, false);
  assert.equal(api.normalizeWhatsAppMessage(message({ timestamp: String(Math.floor(Date.now() / 1000) - 1000) })).autoReplyEligible, false);
  assert.equal(api.normalizeWhatsAppMessage(message({ type: 'reaction' })), null);
  assert.throws(() => api.normalizeWhatsAppMessage(message({ from: 'foreign/contact' })), /identity/);
  assert.throws(() => api.normalizeWhatsAppMessage(message({ timestamp: 'invalid' })), /identity/);
});
test('connection validates app, scopes, WABA membership and registered phone through Meta', async () => {
  configure(); const calls = [];
  global.fetch = async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET');
    if (url.includes('debug_token')) return json({ data: { is_valid: true, app_id: '12345', scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'], expires_at: 0 } });
    if (url.includes('phone_numbers')) return json({ data: [{ id: '22222' }] });
    return json({ id: '22222', display_phone_number: '+234 800 1234', verified_name: 'Haelo', status: 'CONNECTED' });
  };
  const result = await whatsapp().validateWhatsAppConnection({ businessAccountId: '33333', phoneNumberId: '22222', accessToken: 'test-token' });
  assert.equal(result.accountName, 'Haelo'); assert.equal(result.accessTokenExpiresAt, null); assert.equal(calls.length, 3);
});
test('connection rejects another app or phone account before subscribing', async () => {
  configure(); let calls = 0;
  global.fetch = async () => { calls++; return json({ data: { is_valid: true, app_id: '99999', scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'] } }); };
  const input = { businessAccountId: '33333', phoneNumberId: '22222', accessToken: 'test-token' };
  await assert.rejects(whatsapp().validateWhatsAppConnection(input), /valid token/); assert.equal(calls, 1);
  global.fetch = async url => url.includes('debug_token') ? json({ data: { is_valid: true, app_id: '12345', scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'] } }) : json({ data: [{ id: '44444' }] });
  await assert.rejects(whatsapp().validateWhatsAppConnection(input), /does not belong/);
});
test('live notification routes by BOTH WABA and phone, ingests and dispatches opted-in AI', async () => {
  configure(); const ingested = []; const dispatched = [];
  const db = { socialConnection: { findMany: async ({ where }) => { assert.equal(where.whatsappBusinessAccountId, '33333'); assert.equal(where.platformAccountId, '22222'); return [connection()]; } },
    socialInboxSettings: { findUnique: async () => ({ aiAutoReplyEnabled: true }) }, socialLeadMessage: { findFirst: async () => ({ id: 'stored' }) } };
  const api = whatsapp(db, { './ingest': { ingestSocialMessage: async (c, event) => { ingested.push(event); return true; } },
    './dispatchAutoReply': { dispatchSocialInboxAutoReply: async id => dispatched.push(id) } });
  assert.deepEqual(await api.receiveWhatsAppNotification(notification()), { imported: 1 });
  assert.equal(ingested[0].autoReplyEligible, true); assert.equal(ingested[0].name, 'Ada'); assert.deepEqual(dispatched, ['stored']);
});
test('AI disabled, old messages and disconnected accounts cannot trigger AI', async () => {
  configure(); const ingested = []; let settings = false; let connected = true;
  const db = { socialConnection: { findMany: async () => [{ ...connection(), status: connected ? 'CONNECTED' : 'DISCONNECTED' }] },
    socialInboxSettings: { findUnique: async () => ({ aiAutoReplyEnabled: settings }) }, socialLeadMessage: { findFirst: async () => assert.fail('must not dispatch') } };
  const api = whatsapp(db, { './ingest': { ingestSocialMessage: async (c, event) => { ingested.push(event); return true; } } });
  await api.receiveWhatsAppNotification(notification()); assert.equal(ingested[0].autoReplyEligible, false);
  settings = true;
  await api.receiveWhatsAppNotification(notification([message({ timestamp: String(Math.floor(Date.now() / 1000) - 1000) })]));
  assert.equal(ingested[1].autoReplyEligible, false);
  connected = false; await api.receiveWhatsAppNotification(notification()); assert.equal(ingested.length, 2);
});
test('duplicate notification recovers dispatch without importing another message', async () => {
  configure(); let dispatched = 0;
  const api = whatsapp({ socialConnection: { findMany: async () => [connection()] }, socialInboxSettings: { findUnique: async () => ({ aiAutoReplyEnabled: true }) },
    socialLeadMessage: { findFirst: async () => ({ id: 'stored' }) } }, { './ingest': { ingestSocialMessage: async () => false },
    './dispatchAutoReply': { dispatchSocialInboxAutoReply: async () => dispatched++ } });
  assert.deepEqual(await api.receiveWhatsAppNotification(notification()), { imported: 0 }); assert.equal(dispatched, 1);
});
test('CRM stores WhatsApp phone and duplicate deliveries do not increment unread or create another lead', async () => {
  let inserts = 1; let updates = 0; let leads = 0;
  const tx = { socialLeadConversation: { upsert: async () => ({ id: 'conversation', leadStatus: 'NEW' }), update: async () => updates++, updateMany: async () => updates++ },
    socialLeadMessage: { createMany: async () => ({ count: inserts }) },
    calendarLead: { upsert: async ({ create }) => { assert.equal(create.phone, '+2348000000000'); assert.equal(create.calendarId, 'workspace'); leads++; } } };
  const api = load('lib/socialMessaging/ingest.ts', { '@/lib/db': { db: { $transaction: async cb => cb(tx) } }, '@/lib/calendarLeads': { socialStatusToPipeline: value => value } });
  const event = whatsapp().normalizeWhatsAppMessage(message(), 'Ada');
  assert.equal(await api.ingestSocialMessage(connection(), event), true);
  inserts = 0; assert.equal(await api.ingestSocialMessage(connection(), event), false);
  assert.equal(updates, 2); assert.equal(leads, 1);
});
test('manual and AI send use latest credentials and enforce scoped inbound conversation and 24-hour window', async () => {
  configure(); let inbound = new Date(); let connected = true; let calls = 0;
  const db = { socialLeadConversation: { findFirst: async ({ where }) => { assert.equal(where.socialConnectionId, 'connection'); assert.equal(where.participantPlatformId, '2348000000000'); return { messages: [{ platformCreatedAt: inbound }] }; } },
    socialConnection: { findUniqueOrThrow: async () => ({ ...connection(), status: connected ? 'CONNECTED' : 'DISCONNECTED', accessToken: 'rotated-token' }) } };
  global.fetch = async (url, init) => { calls++; assert.match(url, /22222\/messages$/); assert.equal(init.headers.Authorization, 'Bearer rotated-token');
    assert.deepEqual(JSON.parse(init.body), { messaging_product: 'whatsapp', recipient_type: 'individual', to: '2348000000000', type: 'text', text: { preview_url: false, body: 'Hello' } }); return json({ messages: [{ id: 'wamid.sent' }] }); };
  const input = { connection: connection(), conversationId: '2348000000000', recipientId: '2348000000000', text: 'Hello' };
  const api = whatsapp(db); assert.equal(await api.sendWhatsAppMessage(input), 'wamid.sent');
  inbound = new Date(Date.now() - 24 * 3600000); await assert.rejects(api.sendWhatsAppMessage(input), /window has closed/);
  inbound = new Date(); connected = false; await assert.rejects(api.sendWhatsAppMessage(input), /Reconnect/); assert.equal(calls, 1);
});
test('unconfirmed WhatsApp sends are rejected and authentication failures require reconnection', async () => {
  configure(); const changes = [];
  const db = { socialLeadConversation: { findFirst: async () => ({ messages: [{ platformCreatedAt: new Date() }] }) },
    socialConnection: { findUniqueOrThrow: async () => connection(), updateMany: async args => changes.push(args.data) } };
  const input = { connection: connection(), conversationId: '2348000000000', recipientId: '2348000000000', text: 'Hello' };
  global.fetch = async () => json({}); await assert.rejects(whatsapp(db).sendWhatsAppMessage(input), /did not confirm/);
  global.fetch = async () => json({ error: { message: 'Expired token' } }, 401); await assert.rejects(whatsapp(db).sendWhatsAppMessage(input), /Expired token/);
  assert.equal(changes[0].status, 'NEEDS_REAUTH');
  global.fetch = async () => json({ error: { code: 190, message: 'Revoked token' } }, 400);
  await assert.rejects(whatsapp(db).sendWhatsAppMessage(input), /Revoked token/);
  assert.equal(changes[1].status, 'NEEDS_REAUTH');
});
test('delivery and read updates stay scoped and never regress a read receipt', async () => {
  configure(); const updates = [];
  const api = whatsapp({ socialConnection: { findMany: async () => [connection()] }, socialLeadMessage: { updateMany: async args => updates.push(args) } });
  await api.receiveWhatsAppNotification(notification([], { statuses: [{ id: 'wamid.sent', recipient_id: '2348000000000', status: 'read' }, { id: 'wamid.sent', recipient_id: '2348000000000', status: 'delivered' }] }));
  assert.equal(updates[0].data.status, 'READ'); assert.deepEqual(updates[0].where.status.in, ['SENT', 'DELIVERED']);
  assert.equal(updates[1].data.status, 'DELIVERED'); assert.deepEqual(updates[1].where.status.in, ['SENT']);
  assert.equal(updates[0].where.conversation.socialConnectionId, 'connection');
});
test('WhatsApp AI hands off obsolete, already answered and expired messages', async () => {
  let latest = { id: 'newer', direction: 'INBOUND' };
  const api = whatsapp({ socialLeadMessage: { findFirst: async () => latest } });
  const input = { id: 'old', conversationId: 'conversation', platformCreatedAt: new Date() };
  assert.match(await api.whatsappAutoReplyHandoff(input), /newer/);
  latest = { id: 'reply', direction: 'OUTBOUND' }; assert.match(await api.whatsappAutoReplyHandoff(input), /already received/);
  latest = { id: 'old', direction: 'INBOUND' }; assert.equal(await api.whatsappAutoReplyHandoff(input), null);
  assert.match(await api.whatsappAutoReplyHandoff({ ...input, platformCreatedAt: new Date(Date.now() - 86400000) }), /window closed/);
});
test('webhook verifies challenge, rejects unsigned POSTs and retries failed ingestion', async () => {
  const { NextRequest } = require('next/server'); const { createHmac } = require('node:crypto');
  configure(); const api = load('app/api/webhooks/whatsapp/messaging/route.ts', { '@/lib/socialMessaging/whatsapp': {
    whatsappConfigured: () => true, verifyWhatsAppSignature: whatsapp().verifyWhatsAppSignature,
    receiveWhatsAppNotification: async () => { throw new Error('DB unavailable'); } } });
  const valid = new NextRequest('https://test/api?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123');
  assert.equal(await (await api.GET(valid)).text(), '123');
  assert.equal((await api.GET(new NextRequest('https://test/api?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123'))).status, 403);
  const raw = JSON.stringify(notification()); const url = 'https://test/api';
  assert.equal((await api.POST(new NextRequest(url, { method: 'POST', body: raw }))).status, 401);
  const signature = 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex');
  assert.equal((await api.POST(new NextRequest(url, { method: 'POST', body: raw, headers: { 'x-hub-signature-256': signature } }))).status, 503);
});
test('channel routes deny non-owners and public connection reads never return credentials', async () => {
  const { NextRequest } = require('next/server'); let writes = 0; let managerId = 'someone-else';
  const db = { socialCalendar: { findUnique: async () => ({ managerId }) },
    socialConnection: { findFirst: async ({ select }) => { assert.equal(select.accessToken, undefined); assert.equal(select.refreshToken, undefined); return { id: 'connection' }; } },
    $transaction: async () => writes++ };
  const api = load('app/api/calendars/[id]/channels/whatsapp/route.ts', { '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/db': { db }, '@/lib/calendarPermissions': {hasCalendarPermission: async (_actor, _calendar, permission) => permission === 'channels.view' || managerId === 'owner', canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null,  getCalendarRole: async () => 'VIEW_ONLY', canAccessCalendarById: async () => true },
    '@/lib/socialMessaging/whatsapp': { whatsappConfigured: () => true } });
  const context = { params: Promise.resolve({ id: 'workspace' }) };
  assert.equal((await api.POST(new NextRequest('https://test/api', { method: 'POST', body: '{}' }), context)).status, 404);
  assert.equal((await api.DELETE(new NextRequest('https://test/api', { method: 'DELETE' }), context)).status, 404);
  assert.equal(writes, 0); assert.deepEqual((await (await api.GET(new NextRequest('https://test/api'), context)).json()).connection, { id: 'connection' });
});
test('WhatsApp cannot be used in calendar content or publishing', () => {
  const api = load('lib/calendarPosts.ts'); assert.throws(() => api.requirePostPlatform('WHATSAPP'), /messaging-only/);
  assert.throws(() => api.calendarPostData('workspace', { postDate: new Date().toISOString() }, 'WHATSAPP'), /Invalid platform/);
  const publishing = load('lib/publishing/state.ts'); assert.equal(publishing.PUBLISHING_PLATFORMS.includes('WHATSAPP'), false);
  assert.throws(() => publishing.validatePublishContent('WHATSAPP', [], 'Hello'), /not available/);
});
test('owner connection saves validated credentials, preserves refresh cutoff and replaces old numbers atomically', async () => {
  const { NextRequest } = require('next/server'); const saved = []; const disconnected = []; let subscription = 0;
  const cutoff = new Date('2026-01-01T00:00:00Z');
  const db = { socialCalendar: { findUnique: async () => ({ managerId: 'owner' }) }, socialConnection: { findFirst: async () => null },
    $transaction: async callback => callback({ socialConnection: {
      updateMany: async args => disconnected.push(args), findUnique: async () => ({ status: 'CONNECTED', connectedAt: cutoff }),
      upsert: async args => { saved.push(args); assert.equal(args.select.accessToken, undefined); return { id: 'connection', status: 'CONNECTED' }; },
    } }) };
  const api = load('app/api/calendars/[id]/channels/whatsapp/route.ts', { '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/db': { db }, '@/lib/calendarPermissions': {hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null,  canAccessCalendarById: async () => true }, '@/lib/socialMessaging/whatsapp': {
      whatsappConfigured: () => true, validateWhatsAppConnection: async input => { assert.equal(input.phoneNumberId, '22222'); return { accountName: 'Haelo', username: '+2348000000000' }; },
      whatsappRequest: async (path, token, body) => { assert.equal(path, '33333/subscribed_apps'); assert.equal(token, 'fake-token'); subscription++; return { success: true }; },
    } });
  const result = await api.POST(new NextRequest('https://test/api', { method: 'POST', body: JSON.stringify({ businessAccountId: '33333', phoneNumberId: '22222', accessToken: 'fake-token' }) }), { params: Promise.resolve({ id: 'workspace' }) });
  assert.equal(result.status, 200); assert.equal(subscription, 1);
  assert.equal(saved[0].update.connectedAt, cutoff); assert.equal(saved[0].update.accessToken, 'fake-token');
  assert.equal(saved[0].create.calendarId, 'workspace'); assert.equal(disconnected[0].data.accessToken, null);
  assert.deepEqual(await result.json(), { connection: { id: 'connection', status: 'CONNECTED' } });
});
test('owner disconnect clears credentials and retires queued WhatsApp AI without deleting history', async () => {
  const { NextRequest } = require('next/server'); const changes = []; const queue = [];
  const db = { socialCalendar: { findUnique: async () => ({ managerId: 'owner' }) },
    $transaction: async callback => callback({ socialConnection: { updateMany: async args => changes.push(args) }, socialLeadMessage: { updateMany: async args => queue.push(args) } }) };
  const api = load('app/api/calendars/[id]/channels/whatsapp/route.ts', { '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/db': { db }, '@/lib/calendarPermissions': {hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, }, '@/lib/socialMessaging/whatsapp': {} });
  assert.equal((await api.DELETE(new NextRequest('https://test/api', { method: 'DELETE' }), { params: Promise.resolve({ id: 'workspace' }) })).status, 200);
  assert.equal(changes[0].data.accessToken, null); assert.equal(changes[0].data.status, 'DISCONNECTED');
  assert.deepEqual(queue[0].where.conversation, { calendarId: 'workspace', platform: 'WHATSAPP' });
  assert.ok(queue[0].data.autoReplyHandledAt instanceof Date);
});
test('shared AI worker skips superseded WhatsApp messages and rechecks before sending generated reply', async () => {
  const changes = []; let checks = 0; let generated = 0; let sent = 0; let skipFirst = true;
  const inbound = { id: 'inbound', conversationId: 'conversation', text: 'Pricing?', platformCreatedAt: new Date(), autoReplyAttemptCount: 0,
    conversation: { platform: 'WHATSAPP', providerConversationId: '2348000000000', participantPlatformId: '2348000000000',
      connection: connection(), calendar: { clientName: 'Haelo', aiBusinessSummary: 'We sell design', instagramPageId: null }, messages: [] } };
  const db = { socialLeadConversation: { findUniqueOrThrow: async () => ({aiPausedAt:null,aiControlVersion:0}) }, socialInboxSettings: { findMany: async () => [{ calendarId: 'workspace' }], findUnique: async () => ({ aiAutoReplyEnabled: true }) },
    socialLeadMessage: { findMany: async () => [inbound], updateMany: async () => ({ count: 1 }), update: async args => changes.push(args.data) } };
  const api = load('lib/socialMessaging/autoReply.ts', { './outbound': require('./helpers/mock-inbox-outbound.cjs').outboundMock(db), '@/lib/knowledge/context': { getBusinessKnowledgeContext: async () => 'Facts from current documents' }, '@/lib/socialMessaging/handoffNotifications': { deliverHandoffNotifications: async () => {} }, '@/lib/contentWorkspaceUsage': { consumeCalendarAiGeneration: async () => ({ allowed: true, limit: 2000 }) }, '@/lib/calendarPermissions': { canUseCalendarFeature: async () => true }, '@/lib/db': { db }, '@/lib/openai': { generateSocialInboxAutoReply: async () => { generated++; return { shouldReply: true, replyText: 'Hello' }; } },
    '@/lib/socialMessaging/registry': { supportsMessaging: () => true, sendSocialInboxMessage: async () => sent++ },
    '@/lib/socialMessaging/whatsapp': { whatsappAutoReplyHandoff: async () => { checks++; return skipFirst || checks > 1 ? 'Already answered' : null; } } });
  const first = await api.processSocialInboxAutoReplies(); assert.equal(first.handedOff, 1); assert.equal(generated, 0); assert.equal(sent, 0);
  skipFirst = false; checks = 0;
  const second = await api.processSocialInboxAutoReplies(); assert.equal(second.handedOff, 1); assert.equal(generated, 1); assert.equal(checks, 2); assert.equal(sent, 0);
  assert.equal(changes[1].autoReplyHandoffReason, 'Already answered');
});
test('WhatsApp team offer uses interactive Yes/No buttons within the existing reply window',async()=>{
 configure();let body;const db={socialLeadConversation:{findFirst:async()=>({messages:[{platformCreatedAt:new Date()}]})},socialConnection:{findUniqueOrThrow:async()=>connection()}};
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return json({messages:[{id:'offer'}]});};
 assert.equal(await whatsapp(db).sendWhatsAppMessage({connection:connection(),conversationId:'2348000000000',recipientId:'2348000000000',text:'Would you like a member of our team to join?',offerHandoff:true}),'offer');
 assert.equal(body.type,'interactive');assert.equal(body.interactive.type,'button');assert.deepEqual(body.interactive.action.buttons.map(item=>item.reply.title),['Yes, connect me','No, keep helping']);
});
test('WhatsApp text delivery preserves paragraph breaks and punctuation',async()=>{
 configure();let body;const db={socialLeadConversation:{findFirst:async()=>({messages:[{platformCreatedAt:new Date()}]})},socialConnection:{findUniqueOrThrow:async()=>connection()}};
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return json({messages:[{id:'formatted'}]});};
 const text='Your package is ₦50,000.00.\n\nPlease use the official checkout link.\n\nWould you like help choosing a date?';
 await whatsapp(db).sendWhatsAppMessage({connection:connection(),conversationId:'2348000000000',recipientId:'2348000000000',text});assert.equal(body.text.body,text);
});
