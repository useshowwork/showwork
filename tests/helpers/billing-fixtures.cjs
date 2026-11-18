// Existing route tests isolate catalogue checkout from offer policy. Offer policy
// and provider transitions are exercised against the real module in billing-offers.test.cjs.
const fs = require('node:fs');
const ts = require('typescript');
function pure(file) {
  const mod = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod, mod.exports);
  return mod.exports;
}
const access = pure('lib/complimentaryAccess.ts');
const delivery = pure('lib/subscriptionTiers.ts');
const workspace = pure('lib/contentWorkspaceEntitlements.ts');
const {load}=require('./load-typescript.cjs');
// Load the real extracted policy/request modules for legacy behavior tests.
// Canonical installation/dispatch is covered separately by PostgreSQL handlers.
const policy=load('lib/contentWorkspacePolicy.ts');
const boundary=load('lib/publishing/applicationBoundary.ts');
const requests=load('lib/publishing/clientRequests.ts');
exports.withBillingDependencies = dependencies => ({
  './contentWorkspacePolicy': policy,
  './publishing/nativeApplicationContext': load('lib/publishing/nativeApplicationContext.ts'),
  '@/lib/publishing/nativeApplicationContext': load('lib/publishing/nativeApplicationContext.ts'),
  '@/lib/publishing/applicationBoundary': boundary,
  '@/lib/publishing/clientRequests': requests,
  '@/lib/complimentaryAccess': access,
  '@/lib/calendarTeamPolicy': pure('lib/calendarTeamPolicy.ts'),
  '@/lib/paystackPlan': pure('lib/paystackPlan.ts'),
  '@/lib/paymentSync': { syncVerifiedPayment: async () => ({ payment: { id: 'verified', creatorId: 'owner' } }) },
  '@/lib/partnerCommissions': { processReferralCommission: async () => {} },
  '@/components/billing/SubscriptionCheckoutButton': { default: ({ label }) => require('react').createElement('button', null, label), __esModule: true },
  './BillingHistory': { default: () => null, __esModule: true },
 './BillingDashboard.module.css': { default: {}, __esModule: true },
 './BillingAccountControls': { BillingCancellation: () => null, BillingDetailsForm: () => null, BillingPaymentMethod: () => null },
 '@/components/billing/BillingBenefits': { default: () => null, __esModule: true },
  '@/lib/billingOffers': {
    initializeOfferSubscription: params => dependencies['@/lib/paystack'].initializeSubscription(params),
    resolveDeliveryPlan: async code => (dependencies["@/lib/subscriptionTiers"] ?? delivery).tierFromPlanCode(code),
    resolveWorkspacePlan: async code => (dependencies["@/lib/contentWorkspaceEntitlements"] ?? workspace).contentWorkspacePlanFromPaystackPlanCode(code),
    recordOfferPayment: async () => {}, offerSubscriptionId: async () => null, billingPriceQuotes: async () => ({}),
  },
  ...dependencies,
});
