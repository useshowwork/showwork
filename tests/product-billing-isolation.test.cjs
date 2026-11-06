const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, dependencies = {}) {
  dependencies = require("./helpers/billing-fixtures.cjs").withBillingDependencies(dependencies);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in dependencies ? dependencies[name] : require(name), mod, mod.exports);
  return mod.exports;
}
const plans = load('lib/contentWorkspaceEntitlements.ts');
const tiers = load('lib/subscriptionTiers.ts');
const uiSymbol = load('components/ui/UiSymbol.tsx');
const View = load('app/dashboard/billing/BillingSubscriptions.tsx', {
  '@/components/ui/UiSymbol': uiSymbol,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true },
  '@/lib/contentWorkspaceEntitlements': plans,
  '@/lib/subscriptionTiers': tiers,
  '@/components/SubscribeButton': { default: () => null, __esModule: true },
  '@/components/CancelSubscriptionButton': { default: () => null, __esModule: true },
  '@/components/calendars/TrialCountdownBanner': load('components/calendars/TrialCountdownBanner.tsx', { '@/lib/contentWorkspaceEntitlements': plans }),
  '@/components/calendars/CalendarBillingSettings': { default: () => null, __esModule: true },
}).default;
for (const product of ['delivery', 'content-workspace']) {
  test(`${product} billing shows every product with the selected management controls`, () => {
    const html = renderToStaticMarkup(React.createElement(View, {
      creator: { name: 'Test', email: 'test@example.com' },
      usage: { tier: 'FREE', used: 0, limit: 3, remaining: 3, atCap: false },
      workspaceBilling: null, selectedProduct: product, selectedTier: null, selectedCycle: 'MONTHLY',
    }));
    assert.match(html, /Billing &amp; subscriptions/);
    for (const name of ['Project Delivery', 'Marketing Workspace', 'Portfolio', 'No subscription required']) assert.ok(html.includes(name));
    assert.match(html, /href="\/dashboard\/portfolio"/);
    assert.match(html, new RegExp(product === 'delivery' ? '1 project per 30 days' : 'Start Marketing Workspace'));
    assert.doesNotMatch(html, /role="tablist"/);
  });
  test(`${product} billing loads both paid products`, async () => {
    let deliveryReads = 0, workspaceReads = 0;
    const Page = load('app/dashboard/billing/page.tsx', {
      '@/lib/syncContentWorkspaceRenewal': { syncContentWorkspaceRenewal: async () => null },
      'next/navigation': { redirect: () => { throw new Error('Unexpected redirect'); } },
      '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner', name: 'Test', email: 'test@example.com' }) },
      '@/lib/db': { db: { creator: { findUnique: async () => { workspaceReads++; return null; } } } },
      '@/lib/subscriptionUsage': { getCreatorUsage: async () => { deliveryReads++; return { tier: 'FREE' }; } },
      '@/lib/subscriptionTiers': tiers,
      '@/lib/paystack': {},
      './BillingSubscriptions': { default: View, __esModule: true },
    }).default;
    const result = await Page({ searchParams: Promise.resolve(product === 'delivery' ? {} : { product }) });
    assert.equal(result.props.selectedProduct, product);
    assert.equal(deliveryReads, 1);
    assert.equal(workspaceReads, 1);
  });
}

test('a paid downgrade determines delivery usage even with complimentary access', async () => {
  const usageModule = load('lib/subscriptionUsage.ts', {
    '@/lib/db': { db: { project: { count: async () => 2 } } },
    '@/lib/subscriptionTiers': tiers,
  });
  for (const tier of ['STARTER', 'GROWTH', 'UNLIMITED']) {
    const usage = await usageModule.getCreatorUsage({
      id: 'owner', subscriptionActive: true, subscriptionTier: tier,
      isComped: true, freeTierLimitOverride: null, currentCycleStart: new Date(),
    });
    assert.equal(usage.tier, tier);
    assert.equal(usage.limit, tiers.tierLimit(tier));
  }
});

for (const stale of [false, true]) {
test(stale ? 'old delivery callbacks cannot restore a previous plan' : 'verified delivery checkout clears callback parameters before billing is rendered', async () => {
  const account = { id: 'owner', subscriptionTier: 'UNLIMITED', subscriptionActive: true,
    subscriptionCycle: 'MONTHLY', currentCycleStart: new Date('2026-10-03T12:00:00Z'), isComped: true, paystackSubscriptionCode: 'old', paystackEmailToken: 'old-token' };
  const cancellations = [], updates = [];
  const Page = load('app/dashboard/billing/page.tsx', {
    '@/lib/syncContentWorkspaceRenewal': {},
    'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
    '@/lib/auth': { getCurrentCreator: async () => account },
    '@/lib/db': { db: { creator: { update: async ({ data }) => { updates.push(data); return { ...account, ...data }; } } } },
    '@/lib/subscriptionUsage': { getCreatorUsage: async () => { throw new Error('Callback should redirect before rendering'); } },
    '@/lib/subscriptionTiers': { ...tiers, tierFromPlanCode: () => ({ tier: 'STARTER', cycle: 'MONTHLY' }) },
    '@/lib/paystack': {
      verifyTransaction: async () => ({ data: { status: 'success', paid_at: stale ? '2026-10-02T12:00:00Z' : '2026-10-03T13:00:00Z', plan: 'starter', customer: { customer_code: 'customer' } } }),
      fetchCustomerSubscriptions: async () => ({ data: [{ plan: 'starter', subscription_code: 'new', email_token: 'new-token' }] }),
      cancelSubscription: async code => cancellations.push(code),
    },
    './BillingSubscriptions': { default: View, __esModule: true },
  }).default;
  await assert.rejects(Page({ searchParams: Promise.resolve({ product: 'delivery', payment: 'callback', reference: 'showwork_sub_owner_transaction' }) }),
    error => error.url === '/dashboard/billing?product=delivery&cycle=MONTHLY');
  if (stale) {
    assert.deepEqual(updates, []);
    assert.deepEqual(cancellations, []);
  } else {
    assert.equal(updates[0].subscriptionTier, 'STARTER');
    assert.deepEqual(cancellations, ['old']);
  }
});
}

test('workspace complimentary access cannot keep cancelled delivery on Unlimited', async () => {
  const usageModule = load('lib/subscriptionUsage.ts', {
    '@/lib/db': { db: { project: { count: async () => 0 } } },
    '@/lib/subscriptionTiers': tiers,
  });
  const usage = await usageModule.getCreatorUsage({ id: 'owner', subscriptionActive: false,
    subscriptionTier: 'UNLIMITED', isComped: true, freeTierLimitOverride: null, currentCycleStart: new Date() });
  assert.equal(usage.tier, 'FREE');
  assert.equal(usage.limit, 1);
});

test('delivery cancellation resets its tier without changing workspace complimentary access', async () => {
  let updated;
  const cancel = load('app/api/subscription/cancel/route.ts', {
    'next/server': { NextResponse: { json: body => body } },
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner', paystackSubscriptionCode: 'delivery-sub', paystackEmailToken: 'token', isComped: true }) },
    '@/lib/paystack': { cancelSubscription: async () => {} },
    '@/lib/db': { db: { creator: { update: async args => { updated = args.data; } } } },
  });
  assert.deepEqual(await cancel.POST(), { ok: true });
  assert.deepEqual(updated, { subscriptionActive: false, subscriptionTier: 'FREE' });
});

test('workspace trial and expired access keep their subscription checkout on Billing', () => {
  for (const status of ['TRIAL', 'OFFLINE']) {
    const html = renderToStaticMarkup(React.createElement(View, {
      creator: { name: 'Test', email: 'test@example.com' },
      usage: { tier: 'FREE', used: 0, limit: 3, remaining: 3, atCap: false },
      selectedProduct: 'content-workspace', selectedTier: null, selectedCycle: 'MONTHLY',
      workspaceBilling: {
        contentWorkspacePlan: 'CREATOR', contentWorkspaceBillingStatus: status,
        contentWorkspaceBillingCycle: 'MONTHLY', contentWorkspaceTrialUsedAt: new Date(),
        contentWorkspaceTrialEndsAt: new Date(Date.now() + (status === 'TRIAL' ? 1 : -1) * 86400000),
        contentWorkspaceSubscriptionRenewsAt: null, isComped: false, compedUntil: null,
      },
    }));
    assert.match(html, status === 'TRIAL' ? /Subscribe now/ : /Subscribe &amp; restore access/);
  }
});

 test('offline workspace billing without a trial date still offers restore checkout', () => {
  const html = renderToStaticMarkup(React.createElement(View, {
    creator: { name: 'Test', email: 'test@example.com' },
    usage: { tier: 'FREE', used: 0, limit: 3, remaining: 3, atCap: false },
    selectedProduct: 'content-workspace', selectedTier: null, selectedCycle: 'MONTHLY',
    workspaceBilling: { contentWorkspacePlan: 'CREATOR', contentWorkspaceBillingStatus: 'OFFLINE',
      contentWorkspaceBillingCycle: 'MONTHLY', contentWorkspaceTrialUsedAt: null,
      contentWorkspaceTrialEndsAt: null, contentWorkspaceSubscriptionRenewsAt: null,
      isComped: false, compedUntil: null },
  }));
  assert.match(html, /Restore workspace access/);
  assert.match(html, /Subscribe &amp; restore access/);
  assert.doesNotMatch(html, /Your trial ends today/);
});

test('Agency solution destination highlights the highest workspace plan and offers explicit checkout', () => {
  for (const workspaceBilling of [null, { contentWorkspacePlan: 'UNLIMITED', contentWorkspaceBillingStatus: 'TRIAL', contentWorkspaceBillingCycle: 'MONTHLY', contentWorkspaceTrialEndsAt: new Date(Date.now()+86400000) }]) {
    const html = renderToStaticMarkup(React.createElement(View, {
      creator: { name: 'Test', email: 'test@example.com' },
      usage: { tier: 'FREE', used: 0, limit: 3, remaining: 3, atCap: false },
      workspaceBilling, selectedProduct: 'content-workspace', selectedTier: 'UNLIMITED', selectedCycle: 'MONTHLY',
    }));
    assert.match(html, /id="workspace-plan-UNLIMITED"[^>]*data-selected="true"/);
    assert.match(html, /Subscribe to Agency/);
  }
});
