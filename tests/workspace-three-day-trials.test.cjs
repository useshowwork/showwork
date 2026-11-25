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
          trialAiCreditsUsed: 0,
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
      false,
    );
    if (plan === "ENGAGE") {
      assert.equal(
        policy.canUseContentWorkspaceFeature(owner, "randyStudio"),
        false,
      );
    }
    const again = await route.POST({
      json: async () => ({ plan, clientName: "Second business" }),
    });
    assert.equal(again.status, 403);
    assert.equal(count, 1);
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

test("prior trial use and concurrent AI actions share a cap, then paid usage starts separately", async () => {
  const owner = {
    ...account("CREATOR"),
    contentWorkspaceBillingStatus: "TRIAL",
    contentWorkspaceTrialEndsAt: new Date(Date.now() + 86400000),
  };
  const row = { cycleStart: new Date(), trialAiCreditsUsed: 7, aiGenerationsUsed: 0, aiRegenerationsUsed: 0 };
  const db = {
    creator: { findUnique: async () => owner },
    contentWorkspaceUsage: {
      upsert: async () => ({ ...row }),
      findUniqueOrThrow: async () => ({ ...row }),
      updateMany: async ({ where, data }) => {
        if (where.trialAiCreditsUsed && row.trialAiCreditsUsed > where.trialAiCreditsUsed.lte) return { count: 0 };
        for (const [key, value] of Object.entries(data)) row[key] += value.increment;
        return { count: 1 };
      },
    },
  };
  const usage = load("lib/contentWorkspaceUsage.ts", { "@/lib/db": { db } });
  assert.equal((await usage.consumeAiGeneration(owner.id, 3)).allowed, true);
  const denied = await Promise.all([usage.consumeAiGeneration(owner.id), usage.consumeAiRegeneration(owner.id)]);
  assert.ok(denied.every(result => !result.allowed && result.freeTrial && result.remaining === 0));
  assert.equal(row.trialAiCreditsUsed, 10);

  row.trialAiCreditsUsed = 9;
  const race = await Promise.all([usage.consumeAiGeneration(owner.id), usage.consumeAiRegeneration(owner.id)]);
  assert.equal(race.filter(result => result.allowed).length, 1);
  assert.equal(row.trialAiCreditsUsed, 10);

  row.trialAiCreditsUsed = 17;
  assert.equal((await usage.consumeAiGeneration(owner.id)).allowed, false);
  owner.contentWorkspaceBillingStatus = "ACTIVE";
  const paid = await usage.consumeAiGeneration(owner.id);
  assert.deepEqual([paid.allowed, paid.freeTrial, paid.limit, paid.remaining], [true, false, 100, 99]);
  assert.equal(row.trialAiCreditsUsed, 17);
});

test("the generation request prompts to subscribe before starting a job and allows a one-credit draft", async () => {
  let remaining = 0;
  let enqueued = 0;
  const { POST } = load("app/api/calendars/[id]/ai-generate/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/calendarPermissions": { hasCalendarPermission: async () => true },
    "@/lib/contentWorkspaceUsage": {
      getCalendarFreeTrialOwner: async () => ({ id: "owner" }),
      getTrialAiCreditsRemaining: async () => remaining,
    },
    "@/lib/workspaceSetupServer": { getWorkspaceSetup: async () => null },
    "@/lib/publishing/applicationBoundary": { publishingIntegrationInstalled: () => false },
    "@/lib/knowledge/generationPreflight": { generationPreflight: async () => assert.fail("An uncharged trial request must not call AI preflight") },
    "@/lib/aiGenerationJobs": { enqueueAiGeneration: async () => { enqueued++; return new Response(null, { status: 202 }); } },
  });
  const call = (postsPerWeek) => POST(new Request("https://example.test/api/calendars/business/ai-generate", {
    method: "POST",
    body: JSON.stringify({ startDate: "2026-11-25", endDate: "2026-12-01", platforms: ["INSTAGRAM"], postsPerWeek }),
  }), { params: Promise.resolve({ id: "business" }) });

  const exhausted = await call(1);
  assert.equal(exhausted.status, 403);
  assert.equal((await exhausted.json()).requiresUpgrade, true);
  assert.equal(enqueued, 0);

  remaining = 1;
  assert.equal((await call(3)).status, 403);
  assert.equal((await call(1)).status, 202);
  assert.equal(enqueued, 1);
});
