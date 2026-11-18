const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
function load(file, deps = {}, extra = '') {
  deps = require("./helpers/billing-fixtures.cjs").withBillingDependencies(deps);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), mod, mod.exports);
  return mod.exports;
}
const plans = load('lib/contentWorkspaceEntitlements.ts');
function hooks() {
  let cursor = 0;
  const cells = [], effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [cells[index].value, value => { cells[index].value = typeof value === 'function' ? value(cells[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return cells[index] ||= { current: initial }; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: fn(), deps };
      return cells[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!cells[index] || !same(cells[index].deps, deps)) { cells[index] = { deps }; effects.push(fn); }
    },
  };
  return { react, render: (component, props) => { cursor = 0; return component(props); }, flush: () => { while (effects.length) effects.shift()(); } };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...find(node.props.children, predicate)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (React.isValidElement(node)) return text(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const state = (plan, status = 'ACTIVE') => ({ contentWorkspacePlan: plan, contentWorkspaceBillingStatus: status, contentWorkspaceBillingCycle: 'MONTHLY', contentWorkspaceTrialEndsAt: null, isComped: false, compedUntil: null });
const placeholder = () => null;
function comparisonHarness() {
  const h = hooks();
  const component = load('app/dashboard/billing/BillingSubscriptions.tsx', {
    react: h.react, '@/lib/contentWorkspaceEntitlements': plans,
    '@/lib/subscriptionTiers': load('lib/subscriptionTiers.ts'),
    '@/components/ui/UiSymbol': { default: placeholder, __esModule: true },
    'next/link': { default: placeholder, __esModule: true },
    '@/components/SubscribeButton': { default: placeholder, __esModule: true },
    '@/components/CancelSubscriptionButton': { default: placeholder, __esModule: true },
    '@/components/calendars/TrialCountdownBanner': { default: placeholder, __esModule: true },
    '@/components/calendars/CalendarBillingSettings': { default: placeholder, __esModule: true },
  }, '\nexport { ContentWorkspaceSubscription };').ContentWorkspaceSubscription;
  return { ...h, component };
}
test('every non-current comparison card requests a tier switch with the selected billing cycle', () => {
  for (const current of plans.CONTENT_WORKSPACE_PLAN_ORDER) {
    for (const cycle of ['MONTHLY', 'ANNUAL']) {
      const h = comparisonHarness();
      const props = { workspaceBilling: state(current), selectedCycle: cycle };
      const tree = h.render(h.component, props);
      const comparison = find(tree, node => node.type?.name === 'WorkspacePlanComparison')[0];
      const cards = comparison.type(comparison.props);
      const switches = find(cards, node => node.type === 'button' && text(node).startsWith('Switch to'));
      assert.equal(switches.length, plans.CONTENT_WORKSPACE_PLAN_ORDER.length - 1);
      for (const button of switches) {
        assert.equal(button.props.href, undefined);
        button.props.onClick();
        const rerendered = h.render(h.component, props);
        const controller = find(rerendered, node => node.type === placeholder && node.props.switchRequest)[0];
        const target = plans.CONTENT_WORKSPACE_PLAN_ORDER.find(key => text(button).includes(plans.CONTENT_WORKSPACE_PLANS[key].name));
        assert.deepEqual(controller.props.switchRequest, { plan: target, billingCycle: cycle });
      }
    }
  }
});
function controllerHarness() {
  const h = hooks(), calls = [];
  const component = load('components/calendars/CalendarBillingSettings.tsx', {
    react: h.react, '@/lib/contentWorkspaceEntitlements': plans,
    'next/navigation': { useRouter: () => ({ refresh: () => calls.push('refresh') }) },
  }).default;
  return { ...h, calls, component };
}
async function settle() { await new Promise(resolve => setImmediate(resolve)); }
test('comparison requests use existing upgrade/downgrade checkout endpoints and only redirect to Paystack', async () => {
  const originalFetch = global.fetch, originalWindow = global.window;
  try {
    for (const [current, target, endpoint] of [['CREATOR', 'STUDIO', 'upgrade-to-company'], ['STUDIO', 'UNLIMITED', 'upgrade-to-company'], ['UNLIMITED', 'STUDIO', 'downgrade-to-individual'], ['STUDIO', 'CREATOR', 'downgrade-to-individual']]) {
      const h = controllerHarness();
      global.window = { location: { href: '' } };
      global.fetch = async (url, options) => { if (url.startsWith('/api/billing/quote')) { h.calls.push({ url }); return { ok: true, json: async () => ({ amountNgn: 10000, standardPriceNgn: 10000, offer: null }) }; } h.calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ authorizationUrl: 'https://checkout.paystack.com/test' }) }; };
      const props = { plan: current, billingStatus: 'ACTIVE', billingCycle: 'MONTHLY', subscriptionRenewsAt: null, trialEndsAt: null, switchRequest: null };
      h.render(h.component, props); h.flush();
      const request = { plan: target, billingCycle: 'ANNUAL' };
      h.render(h.component, { ...props, switchRequest: request }); h.flush(); await settle();
      assert.equal(h.calls.length, 0, 'show confirmation before requesting checkout');
      let tree = h.render(h.component, { ...props, switchRequest: request }); h.flush(); await settle();
      tree = h.render(h.component, { ...props, switchRequest: request });
      const pay = find(tree, node => node.type === 'button' && text(node).startsWith('Pay '))[0];
      assert.ok(pay); assert.equal(pay.props.disabled, false); pay.props.onClick(); await settle();
      assert.deepEqual(h.calls[1], { url: `/api/calendars/${endpoint}`, body: { payNow: true, expectedQuote: { amountNgn: 10000, offerId: null }, plan: target, billingCycle: 'ANNUAL' } });
      assert.equal(global.window.location.href, 'https://checkout.paystack.com/test');
      h.render(h.component, { ...props, switchRequest: request }); h.flush();
      assert.equal(h.calls.filter(call => call.body).length, 1, 'rerenders must not create duplicate checkouts');
    }
  } finally { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
});
test('trial comparison requests open the existing trial choice and preserve the selected tier and cycle', async () => {
  const originalFetch = global.fetch, originalWindow = global.window;
  try {
    const h = controllerHarness(); global.window = { location: { href: '' } };
    global.fetch = async (url, options) => { h.calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ stillInTrial: true }) }; };
    const props = { plan: 'STUDIO', billingStatus: 'TRIAL', billingCycle: 'MONTHLY', subscriptionRenewsAt: null, trialEndsAt: new Date(Date.now() + 86400000).toISOString(), switchRequest: { plan: 'CREATOR', billingCycle: 'ANNUAL' } };
    h.render(h.component, props); h.flush();
    assert.equal(h.calls.length, 0, 'trial choices must appear before payment');
    const tree = h.render(h.component, props);
    assert.equal(find(tree, node => node.props.role === 'dialog').length, 1);
    const keepTrial = find(tree, node => node.type === 'button' && text(node).includes('Switch plan and keep my trial'))[0];
    assert.ok(keepTrial); keepTrial.props.onClick(); await settle();
    assert.deepEqual(h.calls[0], { url: '/api/calendars/downgrade-to-individual', body: { payNow: false, plan: 'CREATOR', billingCycle: 'ANNUAL' } });
    assert.equal(global.window.location.href, ''); assert.equal(h.calls[1], 'refresh');
  } finally { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
});
test('failed switches display the backend error and keep the user on billing', async () => {
  const originalFetch = global.fetch, originalWindow = global.window;
  try {
    const h = controllerHarness(); global.window = { location: { href: '' } };
    global.fetch = async () => ({ ok: false, json: async () => ({ error: 'Billing is not configured yet.' }) });
    const props = { plan: 'CREATOR', billingStatus: 'ACTIVE', billingCycle: 'MONTHLY', subscriptionRenewsAt: null, trialEndsAt: null, switchRequest: { plan: 'STUDIO', billingCycle: 'MONTHLY' } };
    h.render(h.component, props); h.flush(); await settle();
    h.render(h.component, props); h.flush(); await settle();
    const tree = h.render(h.component, props);
    assert.ok(text(tree).includes('Billing is not configured yet.'));
    const pay = find(tree, node => node.type === 'button' && text(node).startsWith('Pay '))[0];
    assert.equal(pay.props.disabled, true);
    assert.equal(global.window.location.href, '');
  } finally { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; }
});
