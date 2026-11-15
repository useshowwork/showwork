const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./helpers/load-typescript.cjs");
const { packageAllowsChannel } = load("lib/engagePolicy.ts");

test("Engage only supports Facebook, Instagram and WhatsApp; Marketing retains its channel rights", async () => {
  for (const plan of ["ENGAGE", "STUDIO"]) {
    const owner = {
      id: "owner",
      contentWorkspacePlan: plan,
      contentWorkspaceBillingStatus: "ACTIVE",
      contentWorkspaceTrialEndsAt: null,
      isComped: false,
      compedUntil: null,
    };
    const db = {
      socialCalendar: {
        findUnique: async () => ({ managerId: "owner", manager: owner }),
        findMany: async () => [{ id: "business" }],
      },
      calendarCollaborator: {
        findUnique: async () => ({
          id: "member",
          role: "MANAGER",
          permissions: [],
          customPermissions: false,
        }),
      },
    };
    const api = load("lib/calendarPermissions.ts", { "@/lib/db": { db } });
    for (const channel of [
      "facebook",
      "instagram",
      "whatsapp",
      "tiktok",
      "linkedin",
      "x",
    ]) {
      const expected =
        plan !== "ENGAGE" ||
        ["facebook", "instagram", "whatsapp"].includes(channel);
      assert.equal(packageAllowsChannel(plan, channel), expected);
      for (const actor of ["owner", "member"])
        assert.equal(
          await api.hasCalendarPermission(
            actor,
            "business",
            "channels.manage",
            channel,
          ),
          expected,
        );
    }
  }
});

test("Engage channel branding only advertises its three platforms", () => {
  const Channels = load("components/calendars/ChannelsWorkspace.tsx").default;
  const html = renderToStaticMarkup(
    React.createElement(Channels, { engage: true, children: null }),
  );
  for (const channel of ["facebook", "instagram", "whatsapp"])
    assert.match(html, new RegExp(`/images/integrations/${channel}\\.svg`));
  for (const channel of ["tiktok", "linkedin", "x"])
    assert.doesNotMatch(
      html,
      new RegExp(`/images/integrations/${channel}\\.svg`),
    );
});

test("direct TikTok and LinkedIn/X OAuth requests are checked before contacting providers", async () => {
  const mocks = {
    "@/lib/auth": { getCurrentCreator: async () => ({ id: "owner" }) },
    "@/lib/db": {
      db: {
        socialCalendar: { findUnique: async () => ({ managerId: "owner" }) },
      },
    },
    "@/lib/calendarPermissions": {
      hasCalendarPermission: async (_actor, _id, _permission, platform) => {
        assert.ok(["TIKTOK", "linkedin", "x"].includes(platform));
        return false;
      },
    },
    "@/lib/url": { appUrl: () => "https://example.test" },
  };
  const tiktok = load("app/api/calendars/[id]/tiktok/connect/route.ts", mocks);
  const response = await tiktok.GET(
    {},
    { params: Promise.resolve({ id: "business" }) },
  );
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location"), /tiktokError=not_found/);
  const generic = load(
    "app/api/calendars/[id]/channels/[channel]/connect/route.ts",
    mocks,
  );
  for (const channel of ["linkedin", "x"]) {
    const result = await generic.GET(
      {},
      { params: Promise.resolve({ id: "business", channel }) },
    );
    assert.equal(result.status, 307);
    assert.match(result.headers.get("location"), /Error=not_found/);
  }
});
