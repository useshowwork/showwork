const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load: loadTypeScript } = require('./helpers/load-typescript.cjs');
const { withBillingDependencies } = require('./helpers/billing-fixtures.cjs');
const load = (file, deps = {}) => loadTypeScript(file, withBillingDependencies(deps));
const plans = load('lib/contentWorkspaceEntitlements.ts');
const account = (plan = 'CREATOR', status = 'ACTIVE', ends = null) => ({ id: 'owner', contentWorkspacePlan: plan, contentWorkspaceBillingStatus: status, contentWorkspaceBillingCycle: 'MONTHLY', contentWorkspaceTrialEndsAt: ends, contentWorkspaceTrialUsedAt: new Date(), isComped: false, compedUntil: null });
function service(db = {}) { return load('lib/contentWorkspaceUsage.ts', { '@/lib/db': { db }, '@/lib/contentWorkspaceEntitlements': plans }); }
const entitlements = service();
const future = () => new Date(Date.now() + 86400000);
test('tiers have the requested names, prices and numeric limits without changing Paystack identifiers', () => {
  for (const [key, name, price, workspaces, collaborators, gb, ai] of [
    ['CREATOR', 'Creator', 4900, 5, 3, 5, 100], ['STUDIO', 'Studio', 29900, 15, 15, 50, 500],
    ['UNLIMITED', 'Agency', 59900, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 200, 2000],
  ]) {
    const plan = plans.CONTENT_WORKSPACE_PLANS[key];
    assert.deepEqual([plan.name, plan.priceNgnMonthly, plan.activeWorkspaces, plan.collaborators, plan.storageBytes, plan.aiGenerations], [name, price, workspaces, collaborators, gb * 1e9, ai]);
    assert.match(plans.getContentWorkspacePlanCodeEnv(key, 'MONTHLY'), new RegExp(key));
  }
});
test('Creator and Studio features are gated independently and Agency adds opt-in replies and support', () => {
  for (const feature of Object.keys(plans.CONTENT_WORKSPACE_FEATURES)) {
    assert.equal(entitlements.canUseContentWorkspaceFeature(account('CREATOR'), feature), false);
    assert.equal(entitlements.canUseContentWorkspaceFeature(account('STUDIO'), feature), !['aiAutoReplies', 'prioritySupport'].includes(feature));
    assert.equal(entitlements.canUseContentWorkspaceFeature(account('UNLIMITED'), feature), true);
  }
});
test('all Marketing trials retain core features and reserve automatic replies and AI recommendations for subscribers', () => {
  assert.equal(plans.CONTENT_WORKSPACE_TRIAL_DAYS, 3);
  for (const plan of plans.CONTENT_WORKSPACE_PLAN_ORDER) {
    const owner = account(plan, 'TRIAL', future());
    assert.equal(entitlements.getContentWorkspacePlan(owner), 'UNLIMITED');
    for (const feature of Object.keys(plans.CONTENT_WORKSPACE_FEATURES)) assert.equal(entitlements.canUseContentWorkspaceFeature(owner, feature), !["aiAutoReplies", "performanceRecommendations"].includes(feature));
    assert.equal(owner.contentWorkspacePlan, plan);
  }
});
test('early payment retains Agency trial access, expiry enforces paid tier, upgrade restores access immediately', () => {
  const owner = account('CREATOR', 'ACTIVE', future());
  assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'aiAutoReplies'), true);
  owner.contentWorkspaceTrialEndsAt = new Date(Date.now() - 1);
  assert.equal(entitlements.getContentWorkspacePlan(owner), 'CREATOR');
  assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'socialInbox'), false);
  owner.contentWorkspacePlan = 'STUDIO';
  assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'socialInbox'), true);
  assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'aiAutoReplies'), false);
  owner.contentWorkspacePlan = 'UNLIMITED';
  assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'aiAutoReplies'), true);
});
test('expired unpaid trials and offline subscriptions cannot use premium features', () => {
  for (const status of ['TRIAL', 'OFFLINE', 'PENDING_SETUP']) {
    const owner = account('UNLIMITED', status, new Date(Date.now() - 1));
    assert.equal(entitlements.canAccessContentWorkspace(owner), false);
    assert.equal(entitlements.canUseContentWorkspaceFeature(owner, 'aiAutoReplies'), false);
  }
});
test('trial usage falls back to paid quotas without deleting excess stored data', async () => {
  const usage = { cycleStart: new Date(), storageBytes: 20_000_000_000n, storageReservedBytes: 0n, aiGenerationsUsed: 120, aiRegenerationsUsed: 5, trialAiCreditsUsed: 17 };
  const api = service({ socialCalendar: { count: async () => 8 }, calendarCollaborator: { count: async () => 8 }, contentWorkspaceUsage: { upsert: async () => usage } });
  const owner = account('CREATOR', 'TRIAL', future());
  const trial = await api.getContentWorkspaceUsage(owner);
  assert.deepEqual([trial.workspaceLimit, trial.aiGenerationLimit, trial.aiGenerationsRemaining], [1, 10, 0]);
  owner.contentWorkspaceBillingStatus = 'ACTIVE'; owner.contentWorkspaceTrialEndsAt = new Date(Date.now() - 1);
  const summary = await api.getContentWorkspaceUsage(owner);
  assert.deepEqual([summary.workspaceLimit, summary.collaboratorLimit, summary.storageLimitBytes, summary.aiGenerationLimit], [5, 3, 5e9, 100]);
  assert.deepEqual([summary.activeWorkspaces, summary.collaborators, summary.storageBytes, summary.aiGenerationsUsed], [8, 8, 20e9, 120]);
  assert.equal(summary.storageRemainingBytes, 0); assert.equal(summary.aiGenerationsRemaining, 0);
  assert.equal((await api.canCreateContentWorkspace(owner)).allowed, false);
  assert.equal((await api.canAddContentWorkspaceCollaborator(owner)).allowed, false);
});
test('concurrent AI requests cannot consume more than the monthly allowance', async () => {
  const row = { cycleStart: new Date(), aiGenerationsUsed: 99, aiRegenerationsUsed: 0 };
  const api = service({ creator: { findUnique: async () => account() }, contentWorkspaceUsage: {
    upsert: async () => ({ ...row }), findUniqueOrThrow: async () => ({ ...row }),
    updateMany: async ({ where, data }) => {
      if (row.aiGenerationsUsed >= where.aiGenerationsUsed.lt) return { count: 0 };
      row.aiGenerationsUsed += data.aiGenerationsUsed.increment; return { count: 1 };
    },
  } });
  const results = await Promise.all(Array.from({ length: 8 }, () => api.consumeAiGeneration('owner')));
  assert.equal(results.filter(result => result.allowed).length, 1);
  assert.equal(row.aiGenerationsUsed, 100);
});
test('monthly AI resets clamp short months and also work for annual subscriptions', () => {
  assert.equal(entitlements.currentAiCycleStart(new Date('2026-01-31T12:00:00Z'), new Date('2026-02-28T12:00:00Z')).toISOString(), '2026-02-28T12:00:00.000Z');
  assert.equal(entitlements.currentAiCycleStart(new Date('2026-01-04T12:00:00Z'), new Date('2026-10-04T11:00:00Z')).toISOString(), '2026-09-04T12:00:00.000Z');
});
test('API gates block direct requests and allow them immediately after upgrade', async () => {
  let owner = account();
  const db = { socialCalendar: { findUnique: async () => ({ managerId: 'owner', manager: owner }), findMany: async () => [{ id: 'workspace' }] } };
  const api = load('lib/calendarPermissions.ts', { '@/lib/db': { db }, '@/lib/contentWorkspaceUsage': entitlements, '@/lib/contentWorkspaceEntitlements': plans });
  const lock = await api.calendarFeatureGate('workspace', 'socialInbox');
  assert.equal(lock.status, 403); assert.equal((await lock.json()).requiredPlan, 'STUDIO');
  owner = account('STUDIO'); assert.equal(await api.calendarFeatureGate('workspace', 'socialInbox'), null);
  assert.equal((await api.calendarFeatureGate('workspace', 'aiAutoReplies')).status, 403);
});
test('excess trial workspaces remain readable but cannot mutate until upgraded', async () => {
  let owner = account();
  const db = { socialCalendar: { findUnique: async () => ({ managerId: 'owner', manager: owner }), findMany: async () => [{ id: 'covered' }] } };
  const api = load('lib/calendarPermissions.ts', { '@/lib/db': { db }, '@/lib/contentWorkspaceUsage': entitlements, '@/lib/contentWorkspaceEntitlements': plans });
  assert.equal(await api.canAccessCalendarById('excess'), false);
  assert.equal(await api.hasCalendarPermission('owner', 'excess', 'VIEW_ONLY'), true);
  assert.equal(await api.hasCalendarPermission('owner', 'excess', 'EDIT_CALENDAR'), false);
  owner = account('UNLIMITED'); assert.equal(await api.hasCalendarPermission('owner', 'excess', 'EDIT_CALENDAR'), true);
});
test('automatic reply worker leaves queued messages untouched when Agency is unavailable', async () => {
  const api = load('lib/socialMessaging/autoReply.ts', { '@/lib/contentWorkspaceUsage': { consumeCalendarAiGeneration: async () => { throw new Error('Locked worker must not consume AI'); } },
    '@/lib/calendarPermissions': { canUseCalendarFeature: async () => false },
    '@/lib/db': { db: { socialInboxSettings: { findMany: async () => [{ calendarId: 'workspace' }] } } },
    '@/lib/openai': {}, '@/lib/socialMessaging/registry': {}, '@/lib/socialMessaging/whatsapp': {}, '@/lib/socialMessaging/replyProfile': {},
  });
  assert.deepEqual(await api.processSocialInboxAutoReplies(), { workspaces: 1, analyzed: 0, sent: 0, handedOff: 0, failed: 0 });
});
test('automatic reply settings reject Studio requests without persisting any settings', async () => {
  const api = load('app/api/calendars/[id]/inbox/settings/route.ts', {
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/db': { db: { socialCalendar: { findUnique: async () => ({ managerId: 'owner' }) } } },
    '@/lib/calendarPermissions': { hasCalendarPermission: async () => true, calendarFeatureGate: async (_id, feature) => {
      assert.equal(feature, 'aiAutoReplies'); return require('next/server').NextResponse.json({ error: plans.workspaceFeatureUpgradeMessage(feature) }, { status: 403 });
    } },
    '@/lib/socialMessaging/replyProfile': {},
  });
  const result = await api.POST({ json: async () => ({ clientAccessEnabled: true, aiAutoReplyEnabled: true, aiAutoReplyInstructions: '' }) }, { params: Promise.resolve({ id: 'workspace' }) });
  assert.equal(result.status, 403); assert.match((await result.json()).error, /Agency/);
});

test('the content generation API honors denied quota results instead of treating objects as approval', async () => {
  const api = load('lib/calendarAiGeneration.ts', {
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/calendarPermissions': { hasCalendarPermission: async () => true },
    '@/lib/db': { db: { socialCalendar: { findUnique: async () => ({ managerId: 'owner', aiBusinessSummary: 'Brand context' }) }, creator: { findUnique: async () => account() }, calendarBusinessDocument: { count: async () => 1 }, calendarPost: { findFirst: async () => null }, calendarPostAiGeneration: { findFirst: async () => null } } },
    '@/lib/contentWorkspaceUsage': { getContentWorkspacePlan: () => 'CREATOR', consumeAiGeneration: async () => ({ allowed: false, limit: 100 }) },
    '@/lib/openai': { generateContentCalendar: async () => { throw new Error('Quota must stop the model call'); } },
  });
  const result = await api.generateCalendarDrafts({ json: async () => ({ startDate: '2026-10-04', endDate: '2026-10-11', platforms: ['INSTAGRAM'] }) }, { params: Promise.resolve({ id: 'workspace' }) }, { id: 'owner' });
  assert.equal(result.status, 403); assert.equal((await result.json()).code, 'AI_GENERATION_LIMIT_REACHED');
});

test('monthly reset preserves all storage and checks the previous cycle before resetting AI', async () => {
  const row = { cycleStart: new Date('2025-01-01T00:00:00Z'), storageBytes: 19_000_000_000n, storageReservedBytes: 123n, aiGenerationsUsed: 500, aiRegenerationsUsed: 50 };
  let reset;
  const api = service({ contentWorkspaceUsage: {
    upsert: async () => ({ ...row }),
    updateMany: async ({ where, data }) => { reset = { where, data }; Object.assign(row, data); return { count: 1 }; },
    findUniqueOrThrow: async () => row,
  } });
  const summary = await api.getOrCreateContentWorkspaceUsage('owner');
  assert.equal(summary.storageBytes, 19_000_000_000n); assert.equal(summary.storageReservedBytes, 123n);
  assert.equal(summary.aiGenerationsUsed, 0); assert.equal(summary.aiRegenerationsUsed, 0);
  assert.equal(reset.where.cycleStart.toISOString(), '2025-01-01T00:00:00.000Z');
  assert.equal(Object.hasOwn(reset.data, 'storageBytes'), false);
});

test('regenerating drafts uses the same budget as content, reporting and inbox generations', async () => {
  const row = { cycleStart: new Date(), aiGenerationsUsed: 99, aiRegenerationsUsed: 0 };
  const api = service({ creator: { findUnique: async () => account() }, contentWorkspaceUsage: {
    upsert: async () => ({ ...row }), findUniqueOrThrow: async () => ({ ...row }),
    updateMany: async ({ where, data }) => {
      if (row.aiGenerationsUsed >= where.aiGenerationsUsed.lt) return { count: 0 };
      for (const [field, value] of Object.entries(data)) row[field] += value.increment;
      return { count: 1 };
    },
  } });
  assert.equal((await api.consumeAiRegeneration('owner')).allowed, true);
  assert.equal(row.aiGenerationsUsed, 100); assert.equal(row.aiRegenerationsUsed, 1);
  assert.equal((await api.consumeAiGeneration('owner')).allowed, false);
  assert.equal((await api.consumeAiRegeneration('owner')).allowed, false);
});
