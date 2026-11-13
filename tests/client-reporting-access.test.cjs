const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function reportingRoute({ token = 'valid', active = true, exists = true, lookupError = null, reportError = null } = {}) {
  const calls = [];
  const mocks = {
    "@/lib/reporting/jobs": { enqueueReportingSync: async () => ({ queued: false }), runNextReportingJob: async () => {} },
    "@/lib/complimentaryAccess": require("./helpers/billing-fixtures.cjs").withBillingDependencies({})["@/lib/complimentaryAccess"],
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/db': { db: { socialCalendar: { findUnique: async () => { if (lookupError) throw lookupError; return exists ? { id: 'calendar', manager: {}, reportingPermission: { enabled: false } } : null; } } } },
    '@/lib/auth': { verifyViewerToken: (value, id) => value === 'valid' && id === 'calendar' },
    '@/lib/calendarPermissions': { canAccessCalendar: () => active },
    '@/lib/reporting/data': { reportingPeriod: () => ({}), getCalendarReportingData: async (...args) => { if (reportError) throw reportError; calls.push(args); return { insights: [{ recommendation: 'Try videos' }] }; } },
  };
  const mod = { exports: {} };
  const source = fs.readFileSync('app/api/social-calendar/[slug]/reporting/route.ts', 'utf8');
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => {
    assert.ok(mocks[name], `Unexpected dependency ${name}`);
    return mocks[name];
  }, mod, mod.exports);
  return { calls, get: () => mod.exports.GET({ cookies: { get: () => token ? { value: token } : undefined }, nextUrl: { searchParams: new URLSearchParams() } }, { params: Promise.resolve({ slug: 'client' }) }) };
}

test('unlocked clients can read recommendations even when legacy sharing is disabled', async () => {
  const route = reportingRoute();
  const response = await route.get();
  assert.equal(response.status, 200);
  assert.equal(response.body.insights[0].recommendation, 'Try videos');
  assert.equal(route.calls[0][0], 'calendar');
  assert.equal(route.calls[0][2], false);
  assert.equal(route.calls[0][3], false);
  assert.equal(route.calls[0][4], true);
});

test('client reporting still requires a valid workspace password token', async () => {
  for (const token of [null, 'invalid']) {
    const route = reportingRoute({ token });
    assert.equal((await route.get()).status, 401);
    assert.equal(route.calls.length, 0);
  }
});

test('client reporting respects inactive and missing workspaces', async () => {
  assert.equal((await reportingRoute({ active: false }).get()).status, 403);
  assert.equal((await reportingRoute({ exists: false }).get()).status, 404);
});

for (const stage of ['lookupError', 'reportError']) {
  test(`database connection failures during ${stage} return a retryable error`, async () => {
    const response = await reportingRoute({ [stage]: Object.assign(new Error('Sensitive database details'), { code: 'P1001' }) }).get();
    assert.equal(response.status, 503);
    assert.match(response.body.error, /temporarily unavailable/);
    assert.doesNotMatch(response.body.error, /Sensitive/);
  });
}
