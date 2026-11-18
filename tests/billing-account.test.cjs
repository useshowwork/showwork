const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-typescript.cjs");

test("payment method management uses the selected product's subscription for the signed-in account", async () => {
  const calls = [];
  const { POST, GET } = load("app/api/billing/payment-method/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({
      id: "owner", subscriptionActive: true, paystackSubscriptionCode: "delivery-saved",
      contentWorkspacePlan: "ENGAGE", contentWorkspacePaystackSubscriptionCode: "engage-saved",
    }) },
    "@/lib/paystack": {
      getSubscriptionCard: async (code) => { calls.push(code); return { brand: "Visa", last4: "4242" }; },
      getSubscriptionManagementLink: async (code) => { calls.push(code); return "https://paystack.com/manage/subscriptions/sample"; },
    },
  });
  const get = (product) => GET(new Request(`https://showwork.test/api/billing/payment-method?product=${product}`));
  assert.deepEqual(await (await get("content-workspace")).json(), { card: null, canUpdate: false });
  assert.equal((await get("engage")).status, 200);
  assert.equal((await POST(new Request("https://showwork.test/api/billing/payment-method?product=delivery&code=untrusted", {
    method: "POST", headers: { "Content-Type": "application/json" },
  }))).status, 200);
  assert.deepEqual(calls, ["engage-saved", "delivery-saved"]);
});

test("receipts require a successful payment belonging to the signed-in creator", async () => {
  const { GET } = load("app/api/billing/receipts/[id]/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/db": { db: { paymentRecord: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: "receipt", creatorId: "owner", revenueStatus: "LIVE", paystackReference: { not: null } });
      return null;
    } } } },
  });
  const result = await GET(new Request("https://showwork.test"), { params: Promise.resolve({ id: "receipt" }) });
  assert.equal(result.status, 404);
});

test("billing details are validated and saved only for the current creator", async () => {
  let saved;
  const { PATCH } = load("app/api/billing/details/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/db": { db: { accountBillingDetails: { upsert: async (args) => { saved = args; } } } },
  });
  const patch = (email) => PATCH(new Request("https://showwork.test", {
    method: "PATCH",
    body: JSON.stringify({ creatorId: "another-user", name: " My Company ", email, address: "", taxId: "" }),
  }));
  assert.equal((await patch("bad email")).status, 400);
  assert.equal(saved, undefined);
  assert.equal((await patch("billing@example.test")).status, 200);
  assert.deepEqual(saved.where, { creatorId: "owner" });
  assert.deepEqual(saved.create, { creatorId: "owner", name: "My Company", email: "billing@example.test", address: null, taxId: null });
});

test("a paid workspace starts a new-cycle checkout without changing its current cycle", async () => {
  const calls = [];
  const updates = [];
  const plans = load("lib/contentWorkspaceEntitlements.ts");
  const { POST } = load("app/api/calendars/subscribe/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/db": { db: { creator: {
      findUnique: async () => ({ id: "owner", email: "owner@example.test", contentWorkspacePlan: "GROWTH",
        contentWorkspaceBillingStatus: "ACTIVE", contentWorkspaceBillingCycle: "MONTHLY" }),
      update: async (args) => updates.push(args.data),
    } } },
    "@/lib/contentWorkspaceEntitlements": { ...plans, getContentWorkspacePlanCode: () => "growth-yearly" },
    "@/lib/calendarPaymentReturn": { calendarPaymentReturn: async () => "https://showwork.test/return" },
    "@/lib/billingOffers": { initializeOfferSubscription: async (input) => {
      calls.push(input);
      return { data: { authorization_url: "https://checkout.example.test" } };
    } },
  });
  const request = (plan, billingCycle) => POST(new Request("https://showwork.test", {
    method: "POST", body: JSON.stringify({ plan, billingCycle }),
  }));
  assert.equal((await request("STUDIO", "ANNUAL")).status, 400);
  assert.equal((await request("GROWTH", "MONTHLY")).status, 400);
  assert.equal((await request("GROWTH", "ANNUAL")).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].metadata.billingCycle, "ANNUAL");
  assert.deepEqual(Object.keys(updates[0]), ["contentWorkspacePendingSubscriptionRef"]);
});
