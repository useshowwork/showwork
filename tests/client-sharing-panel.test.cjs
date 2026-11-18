const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./helpers/load-typescript.cjs");

const Panel = load("components/calendars/ClientSharingPanel.tsx", {
  "next/navigation": { useRouter: () => ({ refresh() {} }) },
  "@/lib/publishing/clientRequests": { calendarMutationFetch: () => assert.fail("No mutation during render") },
}).default;

test("the link and password have direct copy actions before secondary actions", () => {
  const html = renderToStaticMarkup(React.createElement(Panel, {
    calendarId: "workspace",
    clientUrl: "https://example.test/social-calendar/sample",
    clientName: "Sample",
    accessCode: "sample-code",
    canManage: true,
  }));
  let previous = -1;
  for (const label of ["Copy link", "Copy password", "Change password", "Copy invitation", "Preview client page"]) {
    const position = html.indexOf(label);
    assert.ok(position > previous, `${label} is missing or out of order`);
    previous = position;
  }
  assert.match(html, /readonly=""[^>]*value="sample-code"/i);
  assert.doesNotMatch(html, /New client password/);
});

test("password editing is available only to workspace managers", () => {
  const html = renderToStaticMarkup(React.createElement(Panel, {
    calendarId: "workspace",
    clientUrl: "https://example.test/social-calendar/sample",
    clientName: "Sample",
    accessCode: "sample-code",
    canManage: false,
  }));
  assert.match(html, /Copy password/);
  assert.doesNotMatch(html, /Change password|Set password/);
});
