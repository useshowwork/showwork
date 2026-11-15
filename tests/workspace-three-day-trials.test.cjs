const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-typescript.cjs");
const policy = load("lib/contentWorkspacePolicy.ts");
const plans = load("lib/contentWorkspaceEntitlements.ts");
const account = (plan) => ({
  id: "owner",
  email: "trial@example.test",
  contentWorkspacePlan: plan,
  contentWorkspaceBillingStatus: "PENDING_SETUP",
  contentWorkspaceTrialUsedAt: null,
  contentWorkspaceTrialEndsAt: null,
  contentWorkspaceBillingCycle: null,
  isComped: false,
  compedUntil: null,
});

for (const plan of ["ENGAGE", "CREATOR"])
  test(`${plan} first business starts exactly three days of free access without Paystack`, async () => {
    const owner = account(plan);
    let count = 0;
    const db = {
      creator: {
        findUnique: async () => ({ ...owner }),
        findUniqueOrThrow: async () => ({ ...owner }),
        update: async ({ data }) => Object.assign(owner, data),
      },
      socialCalendar: {
        findUnique: async () => null,
        count: async () => count,
        create: async ({ data }) => {
          count++;
          return { id: "business", ...data };
        },
      },
      calendarCollaborator: { count: async () => 0 },
      contentWorkspaceUsage: {
        upsert: async () => ({
          cycleStart: new Date(),
          storageBytes: 0n,
          storageReservedBytes: 0n,
          aiGenerationsUsed: 0,
          aiRegenerationsUsed: 0,
        }),
      },
      $queryRaw: async () => [],
    };
    db.$transaction = async (fn) => fn(db);
    const route = load("app/api/calendars/route.ts", {
      "@/lib/db": { db },
      "@/lib/auth": {
        getCurrentCreator: async () => ({ id: "owner" }),
        hashPassword: async () => "hashed",
      },
      "@/lib/billingOffers": {
        initializeOfferSubscription: async () =>
          assert.fail("A free trial must never initialize a payment"),
      },
    });
    const before = Date.now();
    const response = await route.POST({
      json: async () => ({ plan, clientName: "Trial business" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.trial, true);
    assert.equal(owner.contentWorkspaceBillingStatus, "TRIAL");
    const duration = owner.contentWorkspaceTrialEndsAt.getTime() - before;
    assert.ok(duration >= 3 * 86400000 && duration <= 3 * 86400000 + 2000);
    assert.equal(policy.canAccessContentWorkspace(owner), true);
    assert.equal(
      policy.getContentWorkspacePlan(owner),
      plan === "ENGAGE" ? "ENGAGE" : "UNLIMITED",
    );
    assert.equal(
      policy.canUseContentWorkspaceFeature(owner, "aiAutoReplies"),
      true,
    );
    if (plan === "ENGAGE") {
      assert.equal(
        policy.canUseContentWorkspaceFeature(owner, "randyStudio"),
        false,
      );
      const again = await route.POST({
        json: async () => ({ plan, clientName: "Second business" }),
      });
      assert.equal(again.status, 403);
      assert.equal(count, 1);
    }
    const originalEnd = owner.contentWorkspaceTrialEndsAt;
    owner.contentWorkspaceTrialEndsAt = new Date(Date.now() - 1);
    assert.equal(policy.canAccessContentWorkspace(owner), false);
    assert.equal(
      policy.canUseContentWorkspaceFeature(owner, "aiAutoReplies"),
      false,
    );
    // Deleting the business must not give another trial.
    count = 0;
    const expired = await route.POST({
      json: async () => ({ plan, clientName: "Restart attempt" }),
    });
    assert.equal(expired.status, 403);
    assert.ok(owner.contentWorkspaceTrialUsedAt);
    owner.contentWorkspaceBillingStatus = "ACTIVE";
    assert.equal(policy.canAccessContentWorkspace(owner), true);
    assert.equal(plans.CONTENT_WORKSPACE_TRIAL_DAYS, 3);
  });
