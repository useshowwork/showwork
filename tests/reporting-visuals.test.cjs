const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./helpers/load-typescript.cjs');
const Visuals = load('components/calendars/ReportingVisuals.tsx').default;
const render = props => renderToStaticMarkup(React.createElement(Visuals, props));
test('reach chart preserves missing observations as gaps and includes observed zero values', () => {
  const html = render({ timeline: [['2026-10-01', 0], ['2026-10-02', null], ['2026-10-03', 20]], posts: [] });
  assert.ok(html.includes('2026-10-01: 0 reach'));
  assert.ok(html.includes('2026-10-03: 20 reach'));
  assert.ok(!html.includes('2026-10-02: 0 reach'));
  assert.ok(html.includes('2 observed'));
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
});
test('interaction chart sums measured components and does not count engagement totals twice', () => {
  const html = render({ timeline: [], posts: [{ likes: 10, comments: 3, shares: null, saves: null, engagement: 13 }] });
  assert.ok(html.includes('Likes 10, Comments 3, Shares unavailable, Saves unavailable'));
  assert.ok(html.includes('>13</strong>'));
  assert.ok(!html.includes('>26</strong>'));
});
test('unavailable and observed-zero metrics remain distinct without invalid SVG geometry', () => {
  const missing = render({ timeline: [], posts: [] });
  const zero = render({ timeline: [['2026-10-01', 0]], posts: [{ likes: 0, comments: 0, shares: 0, saves: 0 }] });
  assert.ok(missing.includes('No recorded interactions available'));
  assert.ok(missing.includes('No daily reach observations yet.'));
  assert.ok(zero.includes('Likes 0, Comments 0, Shares 0, Saves 0'));
  for (const html of [missing, zero]) assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
});
