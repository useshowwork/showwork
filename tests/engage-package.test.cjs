const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./helpers/load-typescript.cjs");
const plans = load("lib/contentWorkspaceEntitlements.ts");
const policy = load("lib/contentWorkspacePolicy.ts");
const { packagePermissions, ENGAGE_PERMISSIONS } = load("lib/engagePolicy.ts");
const { ALL_TEAM_PERMISSIONS, effectiveTeamPermissions } = load(
  "lib/calendarTeamPolicy.ts",
);
const owner = (extra = {}) => ({
  id: "owner",
  contentWorkspacePlan: "ENGAGE",
  contentWorkspaceBillingStatus: "ACTIVE",
  contentWorkspaceBillingCycle: "ANNUAL",
  contentWorkspaceTrialUsedAt: null,
  contentWorkspaceTrialEndsAt: new Date(Date.now() + 86400000),
  isComped: false,
  compedUntil: null,
  ...extra,
});

test("Engage has separate package rights and does not change Marketing ranking or trial rights", () => {
  const engage = plans.CONTENT_WORKSPACE_PLANS.ENGAGE;
  assert.deepEqual(
    [
      engage.priceNgnMonthly,
      engage.priceNgnAnnual,
      engage.activeWorkspaces,
      engage.collaborators,
      engage.aiGenerations,
    ],
    [14900, 149000, 1, 2, 1000],
  );
  assert.deepEqual(plans.CONTENT_WORKSPACE_PLAN_ORDER, [
    "CREATOR",
    "GROWTH",
    "STUDIO",
    "UNLIMITED",
  ]);
  for (const feature of [
    "socialInbox",
    "leadManagement",
    "aiInboxReplies",
    "aiAutoReplies",
  ])
    assert.equal(policy.canUseContentWorkspaceFeature(owner(), feature), true);
  for (const feature of [
    "advancedAnalytics",
    "performanceRecommendations",
    "randyStudio",
  ])
    assert.equal(policy.canUseContentWorkspaceFeature(owner(), feature), false);
  assert.equal(policy.getContentWorkspacePlan(owner()), "ENGAGE");
  for (const status of ["OFFLINE", "PENDING_SETUP"])
    assert.equal(
      policy.canAccessContentWorkspace(
        owner({ contentWorkspaceBillingStatus: status }),
      ),
      false,
    );
  assert.equal(
    policy.getContentWorkspacePlan(
      owner({
        contentWorkspacePlan: "CREATOR",
        contentWorkspaceBillingStatus: "TRIAL",
      }),
    ),
    "UNLIMITED",
  );
  assert.ok(
    !plans
      .getContentWorkspaceFeatureList("ENGAGE")
      .includes("Social publishing"),
  );
});

test("owner and team permissions cannot grant Marketing access in Engage", async () => {
  assert.deepEqual(
    packagePermissions("ENGAGE", ALL_TEAM_PERMISSIONS),
    [...ENGAGE_PERMISSIONS].sort(
      (a, b) =>
        ALL_TEAM_PERMISSIONS.indexOf(a) - ALL_TEAM_PERMISSIONS.indexOf(b),
    ),
  );
  for (const permission of [
    "calendar.edit",
    "calendar.view",
    "ai.generate",
    "publishing.manage",
    "analytics.view",
    "internal_review.manage",
    "creatives.upload",
  ])
    assert.equal(packagePermissions("ENGAGE", [permission]).length, 0);
  assert.deepEqual(
    packagePermissions("STUDIO", ALL_TEAM_PERMISSIONS),
    ALL_TEAM_PERMISSIONS,
  );
  const access = load("lib/calendarPermissions.ts", {
    "@/lib/db": {
      db: {
        socialCalendar: {
          findUnique: async () => ({
            managerId: "owner",
            manager: { contentWorkspacePlan: "ENGAGE" },
          }),
        },
        calendarCollaborator: {
          findUnique: async () => ({
            id: "member",
            role: "MANAGER",
            permissions: [],
            customPermissions: false,
          }),
        },
      },
    },
  });
  for (const actor of ["owner", "member"]) {
    const result = await access.getCalendarAccess(actor, "business");
    assert.equal(result.permissions.includes("inbox.reply"), true);
    assert.equal(result.permissions.includes("publishing.manage"), false);
    assert.equal(
      await access.hasCalendarPermission(actor, "business", "calendar.edit"),
      false,
    );
  }
  assert.deepEqual(
    packagePermissions("ENGAGE", effectiveTeamPermissions("INBOX_AGENT")),
    ["inbox.view", "inbox.reply"],
  );
});

test("publishing and canonical content generation reject Engage even with residual trial or complimentary access", async () => {
  const { workspaceEligibility } = load("lib/publishing/eligibilityPolicy.ts");
  assert.equal(
    workspaceEligibility(owner({ isComped: true }), 1, new Date()).allowed,
    false,
  );
  assert.equal(
    workspaceEligibility(owner(), 1, new Date(), "WORKSPACE").allowed,
    true,
  );
  assert.equal(
    workspaceEligibility(owner(), 2, new Date(), "WORKSPACE").allowed,
    false,
  );
  assert.equal(
    workspaceEligibility(
      owner({ contentWorkspaceBillingStatus: "TRIAL" }),
      1,
      new Date(),
      "WORKSPACE",
    ).allowed,
    true,
  );
  assert.equal(
    workspaceEligibility(
      owner({ contentWorkspacePlan: "STUDIO" }),
      1,
      new Date(),
    ).allowed,
    true,
  );
  await assert.rejects(
    policy.validateCanonicalWorkspaceUsage(
      { query: async () => ({ rows: [owner()] }) },
      { calendarId: "business", kind: "AI_DRAFT" },
    ),
    /MARKETING_WORKSPACE_REQUIRED/,
  );
});

function usageService(account, used = 999, cycleStart = new Date()) {
  let record = {
    creatorId: "owner",
    cycleStart,
    storageBytes: 0n,
    storageReservedBytes: 0n,
    aiGenerationsUsed: used,
    aiRegenerationsUsed: 0,
  };
  const db = {
    creator: { findUnique: async () => account },
    socialCalendar: { count: async () => 0 },
    calendarCollaborator: { count: async () => 0 },
    contentWorkspaceUsage: {
      upsert: async () => ({ ...record }),
      findUniqueOrThrow: async () => ({ ...record }),
      updateMany: async ({ where, data }) => {
        if (record.cycleStart.getTime() !== where.cycleStart.getTime())
          return { count: 0 };
        if (
          where.aiGenerationsUsed &&
          record.aiGenerationsUsed >= where.aiGenerationsUsed.lt
        )
          return { count: 0 };
        if (data.aiGenerationsUsed?.increment)
          record.aiGenerationsUsed += data.aiGenerationsUsed.increment;
        else record = { ...record, ...data };
        return { count: 1 };
      },
    },
  };
  return load("lib/contentWorkspaceUsage.ts", { "@/lib/db": { db } });
}
test("concurrent drafts/automatic replies share the final included reply; human reply entitlement survives exhaustion", async () => {
  const service = usageService(owner());
  const results = await Promise.all([
    service.consumeAiGeneration("owner"),
    service.consumeAiGeneration("owner"),
  ]);
  assert.equal(results.filter((result) => result.allowed).length, 1);
  assert.ok(
    results.every((result) => result.remaining === 0 && result.limit === 1000),
  );
  assert.equal((await service.consumeAiGeneration("owner")).allowed, false);
  assert.equal(
    policy.canUseContentWorkspaceFeature(owner(), "socialInbox"),
    true,
  );
});
test("Engage trial shares 50 replies across concurrent requests without a monthly reset", async () => {
  const account = owner({ contentWorkspaceBillingStatus: "TRIAL" });
  const service = usageService(account, 49, new Date("2024-01-15T00:00:00Z"));
  const before = await service.getContentWorkspaceUsage(account);
  assert.equal(before.aiGenerationLimit, 50);
  assert.equal(before.aiGenerationsRemaining, 1);
  const results = await Promise.all([
    service.consumeAiGeneration("owner"),
    service.consumeAiGeneration("owner"),
  ]);
  assert.equal(results.filter(result => result.allowed).length, 1);
  assert.ok(results.every(result => result.limit === 50 && result.remaining === 0));
  assert.equal((await service.consumeAiGeneration("owner")).allowed, false);
  assert.equal(policy.canUseContentWorkspaceFeature(account, "socialInbox"), true);
});
test("Engage can create its first business for a trial, but cannot restart an exhausted trial", async () => {
  const account = owner({ contentWorkspaceBillingStatus: "PENDING_SETUP" });
  assert.equal(
    (await usageService(account, 0).canCreateContentWorkspace(account)).allowed,
    true,
  );
  const expired = { ...account, contentWorkspaceTrialUsedAt: new Date(0), contentWorkspaceTrialEndsAt: new Date(0) };
  assert.equal((await usageService(expired, 0).canCreateContentWorkspace(expired)).allowed, false);
  assert.equal(
    (await usageService(owner(), 0).canCreateContentWorkspace(owner())).allowed,
    true,
  );
});
test("both Engage billing codes round-trip for webhook activation", () => {
  for (const cycle of ["MONTHLY", "ANNUAL"]) {
    const key = plans.getContentWorkspacePlanCodeEnv("ENGAGE", cycle),
      old = process.env[key];
    try {
      process.env[key] = `engage_test_${cycle}`;
      assert.deepEqual(
        plans.contentWorkspacePlanFromPaystackPlanCode(process.env[key]),
        { plan: "ENGAGE", cycle },
      );
    } finally {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
});
test("Engage authentication preserves its destination through signup and login", () => {
  const journey = load("lib/productJourney.ts");
  assert.equal(journey.productDestination("engage"), "/dashboard/engage");
  assert.equal(
    journey.readProductJourney(
      new URLSearchParams({ next: "/dashboard/engage" }),
    ).product,
    "engage",
  );
  assert.equal(
    journey.productEntryHref("engage"),
    "/signup?next=%2Fdashboard%2Fengage",
  );
});
test("Engage navigation renders all four tools and defaults to Conversations without a content tab", () => {
  const stub = { __esModule: true, default: () => null };
  const Shell = load("components/calendars/CalendarWorkspaceShell.tsx", {
    "next/navigation": {
      useSearchParams: () => new URLSearchParams("view=content"),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "@/components/navigation/MobileDrawer": stub,
    "@/components/calendars/WorkspaceSetup": stub,
    "@/components/uploads/WorkspaceUploadTray": stub,
    "./InboxHandoffAlert": stub,
  }).default;
  const sections = ["inbox", "leads", "channels", "knowledge"].map((id) => ({
    id,
    label: id === "inbox" ? "Conversations" : id,
    title: id,
    group: "Workspace",
    eyebrow: id,
    description: "",
    content: React.createElement("div", { "data-panel": id }),
  }));
  const html = renderToStaticMarkup(
    React.createElement(Shell, {
      product: "engage",
      calendarId: "business",
      clientName: "Business",
      clientUrl: "",
      isManager: true,
      sections,
    }),
  );
  assert.match(html, /data-panel="inbox"/);
  assert.doesNotMatch(
    html,
    /Marketing workspace|AI Studio|Generate calendar|data-panel="content"/,
  );
  assert.match(html, /Conversations/);
  for (const section of sections)
    assert.match(html, new RegExp(`data-section="${section.id}"`));
});

test("Engage checkout charges the selected cycle and never grants unpaid access", async () => {
  for (const cycle of ["MONTHLY", "ANNUAL"]) {
    const checkout = [],
      updates = [];
    const account = owner({
      email: "business@example.test",
      contentWorkspacePlan: null,
      contentWorkspaceBillingStatus: "PENDING_SETUP",
      contentWorkspaceTrialEndsAt: null,
    });
    const route = load("app/api/calendars/subscribe/route.ts", {
      "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
      "@/lib/db": {
        db: {
          creator: {
            findUnique: async () => account,
            update: async ({ data }) => updates.push(data),
          },
          socialCalendar: { count: async () => 0 },
          calendarCollaborator: { count: async () => 0 },
          socialConnection: { count: async () => 6 },
        },
      },
      "@/lib/contentWorkspaceEntitlements": {
        ...plans,
        getContentWorkspacePlanCode: () => `engage_${cycle}`,
      },
      "@/lib/calendarPaymentReturn": {
        calendarPaymentReturn: async () =>
          "https://example.test/dashboard/engage?subscriptionPayment=callback",
      },
      "@/lib/billingOffers": {
        initializeOfferSubscription: async (input) => {
          checkout.push(input);
          return {
            data: { authorization_url: "https://checkout.example.test" },
          };
        },
      },
    });
    const response = await route.POST({
      json: async () => ({ plan: "ENGAGE", billingCycle: cycle }),
    });
    assert.equal(response.status, 200);
    assert.equal(checkout[0].amount, cycle === "ANNUAL" ? 14900000 : 1490000);
    assert.equal(checkout[0].metadata.contentWorkspacePlan, "ENGAGE");
    assert.deepEqual(Object.keys(updates[0]), ["contentWorkspacePendingSubscriptionRef"]);
    assert.equal(
      policy.canAccessContentWorkspace({ ...account, ...updates[0] }),
      false,
    );
  }
});

test("canonical workspace permissions allow Engage channel administration but reject content actions", async () => {
  const { createPublishingValidationAdapters } = load(
    "lib/publishing/validationAdapters.ts",
  );
  const tx = {
    query: async (sql) => {
      if (sql === "SHOW transaction_isolation")
        return { rows: [{ transaction_isolation: "read committed" }] };
      if (sql.includes("PublishingEligibilityFence"))
        return { rows: [{ version: 1 }] };
      if (sql.includes("to_regclass")) return { rows: [{ present: false }] };
      if (sql.includes("count(*)::integer AS ordinal"))
        return { rows: [{ ordinal: 1 }] };
      if (sql.includes('FROM "SocialCalendar"'))
        return { rows: [{ id: "business", managerId: "owner" }] };
      if (sql.includes('FROM "Creator"'))
        return { rows: [owner({ isDeactivated: false })] };
      if (sql.includes("clock_timestamp()"))
        return { rows: [{ now: new Date() }] };
      throw Error("Unexpected SQL: " + sql);
    },
  };
  const adapters = createPublishingValidationAdapters({
    database: {},
    verifyViewer: async () => {
      throw Error("unused");
    },
    verifyRetryEvidence: async () => {
      throw Error("unused");
    },
  });
  assert.equal(
    (
      await adapters.validateWorkspacePermission(tx, {
        calendarId: "business",
        actor: "owner",
        permission: "channels.manage",
      })
    ).permission,
    "channels.manage",
  );
  await assert.rejects(
    adapters.validateWorkspacePermission(tx, {
      calendarId: "business",
      actor: "owner",
      permission: "calendar.edit",
    }),
    /WORKSPACE_PERMISSION_DENIED/,
  );
});

test("an Engage to Marketing switch requires payment without replacing business data or granting a leftover trial", async () => {
  const checkouts = [],
    updates = [];
  const account = owner({
    email: "owner@example.test",
    contentWorkspaceBillingStatus: "TRIAL",
  });
  const route = load("app/api/calendars/upgrade-to-company/route.ts", {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/db": {
      db: {
        creator: {
          findUnique: async () => account,
          update: async ({ data }) => updates.push(data),
        },
      },
    },
    "@/lib/contentWorkspaceEntitlements": {
      ...plans,
      getContentWorkspacePlanCode: () => "studio_annual",
    },
    "@/lib/calendarPaymentReturn": {
      calendarPaymentReturn: async () => "https://example.test/callback",
    },
    "@/lib/billingOffers": {
      initializeOfferSubscription: async (input) => {
        checkouts.push(input);
        return { data: { authorization_url: "https://checkout.example.test" } };
      },
    },
  });
  const response = await route.POST({
    json: async () => ({ plan: "STUDIO", billingCycle: "ANNUAL" }),
  });
  assert.equal(response.status, 200);
  assert.equal(checkouts.length, 1);
  assert.equal(checkouts[0].metadata.contentWorkspacePlan, "STUDIO");
  assert.equal(
    checkouts[0].amount,
    plans.CONTENT_WORKSPACE_PLANS.STUDIO.priceNgnAnnual * 100,
  );
  assert.ok(updates.every((data) => !("contentWorkspacePlan" in data)));
});

test("an Engage account can open the All tools dashboard", async () => {
  const Dashboard = load("app/dashboard/page.tsx", {
    "next/navigation": { redirect: (href) => assert.fail(`Unexpected redirect to ${href}`) },
    "@/lib/auth": { getCurrentCreator: async () => ({ ...owner(), name: "Owner", email: "owner@example.test" }) },
    "@/lib/admin": { isAdminEmail: () => false },
    "@/lib/db": { db: {
      portfolio: { findFirst: async () => null },
      socialCalendar: { findFirst: async () => ({ id: "engage-workspace" }) },
      project: { count: async () => 0 },
    } },
    "@/components/billing/BillingBenefits": { __esModule: true, default: () => null },
    "@/components/LogoutButton": { __esModule: true, default: () => null },
  }).default;

  const html = renderToStaticMarkup(await Dashboard());
  assert.match(html, /Choose the right tool for your work/);
  assert.match(html, /href="\/dashboard\/engage"/);
  assert.match(html, /href="\/dashboard\/portfolio"/);
  assert.match(html, /href="\/dashboard\/billing\?product=content-workspace"/);
});

test("a current Marketing Workspace grant restores access after an Engage trial expires", () => {
  const now = new Date();
  const grantEnd = new Date(now.getTime() + 86400000);
  const account = owner({
    contentWorkspaceBillingStatus: "TRIAL",
    contentWorkspaceTrialEndsAt: new Date(now.getTime() - 86400000),
    billingComplimentaryGrants: [{ product: "CONTENT_WORKSPACE", plan: "STUDIO", endsAt: grantEnd.toISOString() }],
  });
  const { workspaceEligibility } = load("lib/publishing/eligibilityPolicy.ts");
  assert.equal(policy.canAccessContentWorkspace(account), true);
  assert.equal(policy.getContentWorkspacePlan(account), "STUDIO");
  assert.equal(policy.canUseContentWorkspaceFeature(account, "performanceRecommendations"), true);
  assert.deepEqual(workspaceEligibility(account, 1, now), { allowed: true, plan: "STUDIO" });
  const expired = { ...account, billingComplimentaryGrants: [{ product: "CONTENT_WORKSPACE", plan: "STUDIO", endsAt: now.toISOString() }] };
  assert.equal(policy.canAccessContentWorkspace(expired), false);
  assert.equal(policy.getContentWorkspacePlan(expired), "ENGAGE");
});
