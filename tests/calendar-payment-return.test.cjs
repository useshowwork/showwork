const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
const mocks = {
  '@/lib/url': { appUrl: () => 'https://showwork.test' },
  '@/lib/db': { db: { socialCalendar: { findUnique: async ({ where }) => ({ managerId: where.id === 'owned' ? 'owner' : 'other' }) } } },
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/calendarPaymentReturn.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => mocks[name], mod, mod.exports);
const returnUrl = (ref, plan) => mod.exports.calendarPaymentReturn(new Request('https://showwork.test/api/calendars/subscribe', { headers: ref ? { referer: ref } : {} }), 'owner', plan);
test('payment returns to the originating owned workspace section', async () => {
  assert.equal(await returnUrl('https://showwork.test/dashboard/calendars/owned?view=team&old=1'), 'https://showwork.test/dashboard/calendars/owned?view=team&subscriptionPayment=callback');
});
test('payment return rejects foreign origins and other owners', async () => {
  for (const ref of [null, 'https://evil.test/dashboard/calendars/owned', 'https://showwork.test/dashboard/calendars/other', 'https://showwork.test/dashboard/calendars']) {
    assert.equal(await returnUrl(ref), 'https://showwork.test/dashboard/calendars?subscriptionPayment=callback');
  }
});

test('callback follows the purchased product across both switching directions', async () => {
  assert.equal(await returnUrl('https://showwork.test/dashboard/engage', 'STUDIO'), 'https://showwork.test/dashboard/calendars?subscriptionPayment=callback');
  assert.equal(await returnUrl('https://showwork.test/dashboard/calendars/owned?view=team', 'ENGAGE'), 'https://showwork.test/dashboard/engage?subscriptionPayment=callback');
  assert.equal(await returnUrl(null, 'ENGAGE'), 'https://showwork.test/dashboard/engage?subscriptionPayment=callback');
  assert.equal(await returnUrl('https://showwork.test/dashboard/calendars/owned?view=team', 'GROWTH'), 'https://showwork.test/dashboard/calendars/owned?view=team&subscriptionPayment=callback');
});
