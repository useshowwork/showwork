const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
process.env.JWT_SECRET = 'weekly-email-test-secret-only';
function load(file, mocks = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, mocks, cache);
    return require(name);
  }, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}
const day = 86400000;
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(condition => matches(row, condition));
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (value === null) return row[key] == null;
    if (typeof value === 'object') return row[key] != null && row[key] <= value.lte;
    return row[key] === value;
  });
}
function fixture(overrides = {}, fail = '') {
  const row = { id: 'recipient', email: 'person@example.com', name: 'Name',
    createdAt: new Date(Date.now() - 20 * day), isDeactivated: false,
    marketingEmailsUnsubscribedAt: null, weeklyMarketingEmailCount: 0, ...overrides };
  const sent = [];
  const db = { creator: {
    findMany: async ({ where }) => matches(row, where) ? [{ ...row }] : [],
    updateMany: async ({ where, data }) => {
      if (!matches(row, where)) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    },
    findUnique: async () => row,
    update: async ({ data }) => {
      if (fail === 'ack') throw Error('lost acknowledgement');
      row.weeklyMarketingEmailSentAt = data.weeklyMarketingEmailSentAt;
      row.weeklyMarketingEmailCount += data.weeklyMarketingEmailCount.increment;
    },
  }};
  const worker = load('lib/lifecycleEmails.ts', { '@/lib/db': { db }, '@/lib/resend': {
    sendWeeklyMarketingWorkspaceEmail: async (...args) => {
      sent.push(args); if (fail === 'provider') throw Error('provider timeout');
    },
  }});
  return { row, sent, worker };
}

test('sends one workspace email, stores success, and skips repeated runs', async () => {
  const f = fixture();
  assert.equal((await f.worker.runLifecycleEmailCheck()).weeklyMarketingSent, 1);
  await f.worker.runLifecycleEmailCheck();
  assert.equal(f.sent.length, 1);
  assert.equal(f.row.weeklyMarketingEmailCount, 1);
  assert.match(f.sent[0][0].unsubscribePath, /^\/api\/email-preferences\/marketing\?/);
  assert.match(f.sent[0][1], /^weekly-workspace\/recipient\//);
});
test('overlapping cron runs cannot both reserve the same recipient', async () => {
  const f = fixture();
  await Promise.all([f.worker.runLifecycleEmailCheck(), f.worker.runLifecycleEmailCheck()]);
  assert.equal(f.sent.length, 1);
});
test('recent signup, recent old campaign, unsubscribe and deactivation suppress marketing', async () => {
  for (const overrides of [
    { createdAt: new Date() }, { lifecycleSequenceStartedAt: new Date() },
    { welcomeEmailSentAt: new Date() }, { portfolioInviteEmailSentAt: new Date() },
    { projectManagementEmailSentAt: new Date() }, { creativoPromoEmailSentAt: new Date() },
    { lastDeliveryReminderSentAt: new Date() }, { calendarTrialFollowUpEmailSentAt: new Date() },
    { weeklyMarketingEmailSentAt: new Date() }, { marketingEmailsUnsubscribedAt: new Date() },
    { isDeactivated: true },
  ]) {
    const f = fixture(overrides); await f.worker.runLifecycleEmailCheck(); assert.equal(f.sent.length, 0);
  }
});
test('provider failures and lost DB acknowledgements cannot send twice within the week', async () => {
  for (const reason of ['provider', 'ack']) {
    const f = fixture({}, reason);
    assert.equal((await f.worker.runLifecycleEmailCheck()).failed, 1);
    await f.worker.runLifecycleEmailCheck(); assert.equal(f.sent.length, 1);
  }
});
test('missed weeks never produce catch-up messages; next eligible week changes content', async () => {
  const f = fixture(); await f.worker.runLifecycleEmailCheck();
  const first = f.sent[0][0].variant;
  f.row.weeklyMarketingEmailLastAttemptAt = f.row.weeklyMarketingEmailSentAt = new Date(Date.now() - 50 * day);
  await f.worker.runLifecycleEmailCheck();
  assert.equal(f.sent.length, 2); assert.notEqual(f.sent[1][0].variant, first);
});
test('three recipient-offset messages rotate without consecutive repetition', () => {
  const { weeklyMarketingVariant, WEEKLY_MARKETING_MESSAGES } = load('lib/weeklyMarketingContent.ts');
  const cycle = [0, 1, 2, 3].map(n => weeklyMarketingVariant('creator', n));
  assert.equal(new Set(cycle.slice(0, 3)).size, 3); assert.equal(cycle[0], cycle[3]);
  assert.equal(WEEKLY_MARKETING_MESSAGES.length, 3);
});
test('weekly emails escape names, include plain text, workspace CTA and unsubscribe headers', async () => {
  const sent = [];
  class Resend { constructor() { this.emails = { send: async (payload, options) => {
    sent.push({ payload, options }); return { data: { id: 'sent' }, error: null };
  }}; }}
  const mail = load('lib/resend.ts', { resend: { Resend },
    '@/lib/publishing/nativeApplicationContext': { nativeApplicationContext: () => undefined } });
  for (const variant of [0, 1, 2]) await mail.sendWeeklyMarketingWorkspaceEmail({
    to: 'person@example.com', name: '<script>', variant,
    unsubscribePath: '/api/email-preferences/marketing?creatorId=id&token=test',
  }, `test-${variant}`);
  assert.equal(new Set(sent.map(item => item.payload.subject)).size, 3);
  for (const { payload, options } of sent) {
    assert.match(payload.html, /&lt;script&gt;/); assert.doesNotMatch(payload.html, /<script>|Portfolio|Creativo|Project Delivery/);
    assert.match(payload.html, /\/dashboard\/calendars/); assert.match(payload.text, /Unsubscribe:/);
    assert.equal(payload.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.ok(options.idempotencyKey);
  }
});
test('unsubscribe GET is read-only; signed POST opts out; forged or changed-email tokens fail', async () => {
  const preferences = load('lib/marketingEmailPreferences.ts');
  const token = preferences.marketingUnsubscribeToken('person', 'person@example.com');
  let email = 'person@example.com', writes = 0;
  const route = load('app/api/email-preferences/marketing/route.ts', { 'next/server': {}, '@/lib/db': { db: { creator: {
    findUnique: async () => ({ id: 'person', email }),
    updateMany: async () => { writes++; return { count: 1 }; },
  }}}});
  const req = { nextUrl: new URL(`https://example.com/api/email-preferences/marketing?creatorId=person&token=${token}`) };
  assert.equal((await route.GET(req)).status, 200); assert.equal(writes, 0);
  assert.equal((await route.POST(req)).status, 200); assert.equal(writes, 1);
  email = 'changed@example.com'; assert.equal((await route.POST(req)).status, 400);
  req.nextUrl.searchParams.set('token', 'f'.repeat(64)); assert.equal((await route.POST(req)).status, 400);
  assert.equal(writes, 1);
});
test('retired trial job and portfolio script cannot send separate drip emails', async () => {
  const trial = load('lib/calendarTrialEmails.ts');
  assert.equal((await trial.runCalendarTrialEmailCheck()).disabled, true);
  assert.doesNotMatch(fs.readFileSync('scripts/send-portfolio-payment-reminders.ts', 'utf8'), /sendPortfolioOfflineReminderEmail|PrismaClient/);
  assert.match(fs.readFileSync('app/api/auth/verify-otp/route.ts', 'utf8'), /sendWelcomeEmail/);
});

test('one-time welcome introduces all three tools with direct links and an idempotency key', async () => {
  const sent = [];
  class Resend { constructor() { this.emails = { send: async (payload, options) => {
    sent.push({ payload, options }); return { data: { id: 'sent' }, error: null };
  }}; }}
  const mail = load('lib/resend.ts', { resend: { Resend },
    '@/lib/publishing/nativeApplicationContext': { nativeApplicationContext: () => undefined } });
  await mail.sendWelcomeEmail({ to: 'person@example.com', name: '<script>', creatorId: 'new-person' });
  const { payload, options } = sent[0];
  for (const path of ['/dashboard/calendars', '/dashboard/projects', '/dashboard/portfolio']) {
    assert.ok(payload.html.includes(path)); assert.ok(payload.text.includes(path));
  }
  for (const name of ['Marketing Workspace', 'Project Delivery', 'Portfolio']) assert.ok(payload.html.includes(name));
  assert.match(payload.html, /&lt;script&gt;/); assert.doesNotMatch(payload.html, /<script>/);
  assert.equal(options.idempotencyKey, 'account-welcome/new-person');
});
