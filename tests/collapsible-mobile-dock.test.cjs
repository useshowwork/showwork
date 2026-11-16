const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { load } = require('./helpers/load-typescript.cjs');

test('bottom navigation can be hidden and restored without unmounting its content', () => {
  let collapsed = false;
  let focusCalls = 0;
  const Dock = load('components/navigation/CollapsibleMobileDock.tsx', {
    react: { ...React, useState: () => [collapsed, update => { collapsed = update(collapsed); }], useRef: () => ({ current: { focus() { focusCalls++; } } }) },
  }).default;
  const content = React.createElement('nav', null, 'Calendar');
  const render = (hidden = false) => Dock({ children: content, hidden });
  let tree = render();
  let [menu, toggle] = tree.props.children;
  assert.equal(menu.props.hidden, false);
  assert.equal(toggle.props['aria-label'], 'Hide bottom navigation');
  toggle.props.onClick();
  tree = render();
  [menu, toggle] = tree.props.children;
  assert.equal(menu.props.hidden, true);
  assert.equal(menu.props.children, content);
  assert.equal(toggle.props['aria-expanded'], false);
  assert.equal(toggle.props['aria-label'], 'Show bottom navigation');
  toggle.props.onClick();
  [menu, toggle] = render().props.children;
  assert.equal(menu.props.hidden, false);
  assert.equal(toggle.props['aria-expanded'], true);
  assert.equal(focusCalls, 2);
  assert.equal(render(true).props.hidden, true);
});
