const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup(referral = { id: 'ref', status: 'PENDING' }, failOnce = false) {
  const records = new Map();
  let transactions = 0;
  const tx = {
    paymentRecord: { findUnique: async () => null },
    referral: { findUnique: async () => referral, update: async ({ data }) => Object.assign(referral, data) },
    referralCommission: {
      findUnique: async ({ where }) => records.get(where.paymentRecordId),
      create: async ({ data }) => records.set(data.paymentRecordId, data),
    },
  };
  const db = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (++transactions === 1 && failOnce) throw Object.assign(new Error('conflict'), { code: 'P2034' });
    return fn(tx);
  } };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/partnerCommissions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({ db }), mod, mod.exports);
  return { run: mod.exports.processReferralCommission, records, referral };
}
const payment = { id: 'pay', creatorId: 'customer', amountNgn: 4900, type: 'CONTENT_WORKSPACE_SUBSCRIPTION_INITIAL', revenueStatus: 'LIVE', createdAt: new Date('2026-10-06T10:00:00Z') };
test('all qualifying products and cycles earn 10% of the actual payment', async () => {
  for (const type of ['SUBSCRIPTION_INITIAL', 'SUBSCRIPTION_RENEWAL', 'CONTENT_WORKSPACE_SUBSCRIPTION_INITIAL', 'CONTENT_WORKSPACE_SUBSCRIPTION_RENEWAL']) {
    const s = setup();
    await s.run({ ...payment, type, amountNgn: 55860 });
    assert.equal(s.records.get('pay').commissionAmountNgn, 5586);
    assert.equal(s.records.get('pay').status, 'PENDING');
  }
});
test('test, unverified, excluded, non-subscription and invalid amounts do not activate referrals', async () => {
  for (const change of [{ revenueStatus: 'EXCLUDED' }, { revenueStatus: 'UNVERIFIED' }, { revenueStatus: undefined }, { type: 'PORTFOLIO' }, { amountNgn: 0 }, { amountNgn: -1 }, { amountNgn: NaN }]) {
    const s = setup(); await s.run({ ...payment, ...change });
    assert.equal(s.records.size, 0); assert.equal(s.referral.status, 'PENDING');
  }
});
test('duplicate delivery is idempotent and serialization conflicts are retried', async () => {
  const s = setup(undefined, true); await s.run(payment); await s.run(payment);
  assert.equal(s.records.size, 1);
  assert.equal(s.referral.commissionEndsAt.toISOString(), '2027-10-06T10:00:00.000Z');
});
test('renewals qualify strictly inside the 12-month window', async () => {
  const s = setup(); await s.run(payment);
  await s.run({ ...payment, id: 'renew', createdAt: new Date('2027-10-06T09:59:59Z') });
  await s.run({ ...payment, id: 'expired', createdAt: new Date('2027-10-06T10:00:00Z') });
  await s.run({ ...payment, id: 'early', createdAt: new Date('2026-10-05T10:00:00Z') });
  assert.deepEqual([...s.records.keys()], ['pay', 'renew']);
});
test('leap-day window ends in February and disqualified referrals do not earn', async () => {
  const s = setup(); await s.run({ ...payment, createdAt: new Date('2024-02-29T10:00:00Z') });
  assert.equal(s.referral.commissionEndsAt.toISOString(), '2025-02-28T10:00:00.000Z');
  const blocked = setup({ id: 'ref', status: 'DISQUALIFIED' }); await blocked.run(payment);
  assert.equal(blocked.records.size, 0);
});
function loadRoute(file, db, extras = {}) {
  const mod = { exports: {} };
  const deps = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/db': { db }, ...extras,
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => deps[name], mod, mod.exports);
  return mod.exports;
}
test('payout API requires a bank account before allocating earnings', async () => {
  const db = {
    partnerProfile: { findUnique: async () => ({ id: 'partner', status: 'ACTIVE' }) },
    $transaction: async fn => fn({ partnerPayoutAccount: { findUnique: async () => null } }),
  };
  const response = await loadRoute('app/api/partners/payouts/route.ts', db).POST();
  assert.equal(response.status, 400); assert.match(response.body.error, /payout account/);
});
test('email outages do not turn saved applications into failed submissions', async () => {
  const route = loadRoute('app/api/partners/enroll/route.ts', {
    creator: { findUnique: async () => ({ id: 'owner', email: 'owner@example.com' }) },
    partnerProfile: { create: async () => ({ id: 'partner', status: 'PENDING' }) },
  }, { '@/lib/resend': {
    sendPartnerApplicationReceivedEmail: async () => { throw new Error('outage'); },
    sendPartnerApplicationNotificationEmail: async () => { throw new Error('outage'); },
  } });
  const response = await route.POST(); assert.equal(response.status, 200); assert.equal(response.body.status, 'PENDING');
});
test('custom agreement determines commission and expiry, including month-end clamping', async () => {
  const s = setup({ id: 'ref', status: 'PENDING', commissionPercent: 25, commissionMonths: 3 });
  const start = new Date('2026-01-31T10:00:00Z');
  await s.run({ ...payment, amountNgn: 12900, createdAt: start });
  assert.equal(s.records.get('pay').commissionAmountNgn, 3225);
  assert.equal(s.records.get('pay').commissionPercent, 25);
  assert.equal(s.referral.commissionEndsAt.toISOString(), '2026-04-30T10:00:00.000Z');
  await s.run({ ...payment, id: 'expired-custom', createdAt: new Date('2026-04-30T10:00:00Z') });
  assert.equal(s.records.has('expired-custom'), false);
});
test('zero commission agreement generates no commission', async () => {
  const s = setup({ id:'ref', status:'PENDING', commissionPercent:0, commissionMonths:6 });
  await s.run(payment); assert.equal(s.records.size,0);
});
