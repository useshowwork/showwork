const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function loadPage({ total = 12, matches = total, billing = null, signedIn = true } = {}) {
  const calls = [];
  const stub = { default: () => null, __esModule: true };
  const retryModule = { exports: {} };
  const retryCode = ts.transpileModule(fs.readFileSync("lib/retryDatabaseRead.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("module", "exports", retryCode)(retryModule, retryModule.exports);
  const mocks = {
    "@/components/brand/ShowworkLogo": stub,
    "@/components/help/HelpLink": stub,
    "@/lib/calendarTeamPolicy": require("./helpers/billing-fixtures.cjs").withBillingDependencies({})["@/lib/calendarTeamPolicy"],
    "@/lib/retryDatabaseRead": retryModule.exports,
    "@/components/calendars/CalendarDashboard.module.css": { default: new Proxy({}, { get: (_, key) => String(key) }), __esModule: true },
    "@/lib/complimentaryAccess": require("./helpers/billing-fixtures.cjs").withBillingDependencies({})["@/lib/complimentaryAccess"],
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true },
    'next/navigation': { redirect: href => { throw new Error(`redirect:${href}`); } },
    '@/lib/auth': { getCurrentCreator: async () => signedIn ? { id: 'owner' } : null },
    '@/lib/syncContentWorkspaceRenewal': { syncContentWorkspaceRenewal: async () => null },
    '@/lib/db': { db: {
      creator: { findUnique: async args => { calls.push(['creator', args]); return billing; } },
      socialCalendar: {
        count: async args => { calls.push(['count', args]); return args.where.clientName ? matches : total; },
        findMany: async args => { calls.push(['workspaces', args]); return []; },
      },
      calendarCollaborator: { findMany: async args => { calls.push(['shared', args]); return []; } },
    } },
    '@/components/calendars/CreateCalendarForm': stub,
    '@/components/calendars/CalendarCard': stub,
    '@/components/calendars/CalendarPaymentCallbackHandler': stub,
    '@/components/calendars/WorkspaceOnboarding': { ...stub, DashboardTourButton: () => null },
  };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/dashboard/calendars/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports);
  return { page: params => mod.exports.default({ searchParams: Promise.resolve(params) }), calls };
}
test('workspace search stays scoped to the owner and collaborator membership', async () => {
  const { page, calls } = loadPage({ total: 30, matches: 12 });
  const html = renderToStaticMarkup(await page({ q: ' Alpha ', page: '2' }));
  const owned = calls.find(([kind]) => kind === 'workspaces')[1];
  assert.deepEqual(owned.where, { managerId: 'owner', clientName: { contains: 'Alpha', mode: 'insensitive' } });
  assert.equal(owned.skip, 9);
  assert.equal(owned.take, 9);
  const shared = calls.find(([kind]) => kind === 'shared')[1];
  assert.deepEqual(shared.where, { creatorId: 'owner', calendar: { clientName: { contains: 'Alpha', mode: 'insensitive' } } });
  assert.match(html, /href="\/dashboard\/calendars\?q=Alpha"/);
  assert.match(html, /Search marketing workspaces/);
});
test('out-of-range and invalid pages are clamped without dropping ownership', async () => {
  for (const [input, skip] of [['999', 9], ['-3', 0], ['invalid', 0], ['1.9', 0]]) {
    const { page, calls } = loadPage();
    await page({ page: input });
    const args = calls.find(([kind]) => kind === 'workspaces')[1];
    assert.equal(args.skip, skip);
    assert.equal(args.where.managerId, 'owner');
  }
});
test('expired trials link to billing while complimentary access avoids a false warning', async () => {
  const billing = { contentWorkspacePlan: 'CREATOR', contentWorkspaceBillingStatus: 'TRIAL', contentWorkspaceTrialEndsAt: new Date(0), isComped: false, compedUntil: null };
  let html = renderToStaticMarkup(await loadPage({ billing }).page({}));
  assert.match(html, /Subscribe to restore workspace access/);
  assert.match(html, /href="\/dashboard\/billing\?product=content-workspace#content-workspace-plans"/);
  html = renderToStaticMarkup(await loadPage({ billing: { ...billing, isComped: true } }).page({}));
  assert.doesNotMatch(html, /Subscribe to restore workspace access/);
});
test('unsigned visitors cannot query workspace data', async () => {
  const { page, calls } = loadPage({ signedIn: false });
  await assert.rejects(page({}), /redirect:\/login/);
  assert.equal(calls.length, 0);
});

test('Billing shows the workspace tier and remaining trial days together', async () => {
  for (const [tier, name, days] of [['CREATOR', 'Creator', 3], ['STUDIO', 'Studio', 1], ['UNLIMITED', 'Agency', 7]]) {
    const billing = { contentWorkspacePlan: tier, contentWorkspaceBillingStatus: 'TRIAL', contentWorkspaceTrialEndsAt: new Date(Date.now() + (days - 0.5) * 86400000), isComped: false, compedUntil: null };
    const html = renderToStaticMarkup(await loadPage({ billing }).page({}));
    const nav = html.match(/<nav[^>]*aria-label="Dashboard navigation"[\s\S]*?<\/nav>/)[0];
    assert.ok(nav.includes(name));
    assert.ok(nav.includes(`Trial · ${days} ${days === 1 ? 'day' : 'days'} left`));
    assert.doesNotMatch(html, /aria-label="Workspace access"/);
  }
});

test('Billing distinguishes active, expired, complimentary and unselected plans', async () => {
  const base = { contentWorkspacePlan: 'CREATOR', contentWorkspaceBillingStatus: 'TRIAL', contentWorkspaceTrialEndsAt: new Date(0), isComped: false, compedUntil: null };
  for (const [billing, label] of [
    [{ ...base, contentWorkspaceBillingStatus: 'ACTIVE' }, 'Active'],
    [base, 'Trial ended'],
    [{ ...base, contentWorkspaceBillingStatus: 'OFFLINE' }, 'Access paused'],
    [{ ...base, isComped: true }, 'Complimentary'],
    [null, 'No plan'],
  ]) {
    const html = renderToStaticMarkup(await loadPage({ billing }).page({}));
    const nav = html.match(/<nav[^>]*aria-label="Dashboard navigation"[\s\S]*?<\/nav>/)[0];
    assert.ok(nav.includes(label));
    assert.doesNotMatch(nav, /days left|day left/);
  }
});

test('first-time users see one creation prompt without an empty workspace list', async () => {
  const html = renderToStaticMarkup(await loadPage({ total: 0 }).page({}));
  assert.match(html, /Create your first workspace/);
  assert.match(html, /One workspace for each business or client/);
  assert.doesNotMatch(html, /id="your-workspaces"|Your clients start here/);
});
