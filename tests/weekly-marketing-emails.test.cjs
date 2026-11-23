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
test('the retired weekly marketing scheduler performs no database or email work', async () => {
  const fail = () => assert.fail('The retired campaign must not load a database or mailer');
  const mocks = Object.fromEntries(['@/lib/db', '@/lib/resend'].map(key => [key, new Proxy({}, {get: fail})]));
  const {runLifecycleEmailCheck} = load('lib/lifecycleEmails.ts', mocks);
  for (const summary of await Promise.all([runLifecycleEmailCheck(), runLifecycleEmailCheck()])) {
    assert.deepEqual(summary, {processed:0, weeklyMarketingSent:0, skipped:0, failed:0, disabled:true});
  }
});

test('the existing authenticated endpoint reports that weekly marketing is disabled', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'weekly-email-cron-fixture';
  try {
    const {POST} = load('app/api/cron/lifecycle-emails/route.ts');
    assert.equal((await POST(new Request('https://showwork.test'))).status, 401);
    const response = await POST(new Request('https://showwork.test', {headers:{authorization:'Bearer weekly-email-cron-fixture'}}));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).disabled, true);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
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
