const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "@/components/brand/ShowworkLogo") return require("./helpers/load-typescript.cjs").load("components/brand/ShowworkLogo.tsx");
    if (name === "@/components/uploads/WorkspaceUploadTray") return { __esModule: true, default: () => null };
    if (name === '@/components/help/HelpLink') return require('./helpers/load-typescript.cjs').load('components/help/HelpLink.tsx');
    if (name.endsWith('.module.css')) return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};
    if (['./ChannelCapabilities','./PlatformBrandIcon'].includes(name)) return require('./helpers/load-typescript.cjs').load('components/calendars/' + name.slice(2) + '.tsx');
    return require(name);
  }, mod, mod.exports);
  return mod.exports.default;
}
const stub = { __esModule: true, default: () => null };
const sections = ['overview', 'content', 'channels', 'inbox', 'knowledge', 'generate', 'team', 'analytics', 'leads', 'access', 'publish'].map(id => ({ id, label: id, title: id, group: 'Workspace', eyebrow: id, description: id, content: React.createElement('div', { 'data-panel': id }, id) }));
function manager(url, available = sections) {
  const Component = load('components/calendars/CalendarWorkspaceShell.tsx', {
    './WorkspaceMenu.module.css': { __esModule: true, default: new Proxy({}, {get: (_, key) => String(key)}) },
    './InboxHandoffAlert': { __esModule: true, default: () => null },
    'next/navigation': { useSearchParams: () => new URL(url).searchParams },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/ui/UiSymbol': stub, '@/components/navigation/MobileDrawer': stub, '@/components/calendars/WorkspaceTour': stub,
  });
  return renderToStaticMarkup(React.createElement(Component, { clientName: 'Business', clientUrl: '', isManager: true, sections: available }));
}
test('every manager deep link renders the requested section before effects or hydration', () => {
  for (const section of sections) {
    const html = manager(`https://example.test/dashboard/calendars/workspace?view=${section.id}`);
    assert.ok(html.includes(`data-panel="${section.id}"`));
    if (section.id !== 'overview') assert.ok(!html.includes('data-panel="overview"'));
  }
});
test('refreshing an OAuth return keeps Channels; removing callback flags does not change the section', () => {
  for (const query of ['view=channels&instagramConnected=true', 'view=channels&facebookError=denied', 'view=channels']) {
    const html = manager(`https://example.test/dashboard/calendars/workspace?${query}`);
    assert.ok(html.includes('data-panel="channels"'));
    assert.ok(!html.includes('data-panel="overview"'));
  }
});
test('unavailable sections fall back only to a permitted section', () => {
  const html = manager('https://example.test/dashboard/calendars/workspace?view=channels', [sections[1]]);
  assert.ok(html.includes('data-panel="content"'));
  assert.ok(!html.includes('data-panel="channels"'));
});
test('client workspace deep links render their requested section before effects', () => {
  const Component = load('components/calendars/ClientCalendarWorkspace.tsx', {
    'next/navigation': { useSearchParams: () => new URLSearchParams('view=review') },
    'next/image': { __esModule: true, default: props => React.createElement('img', { src: props.src, alt: props.alt }) },
    '@/components/navigation/MobileDrawer': { ...stub, NavigationToggle: () => null },
    '@/components/calendars/CalendarReportingPanel': stub, '@/components/calendars/ClientCalendarView': stub,
    '@/components/calendars/SocialFeedPreview': stub, '@/components/calendars/InstagramPreview': stub, '@/components/calendars/TikTokPreview': stub,
  });
  const html = renderToStaticMarkup(React.createElement(Component, { slug: 'business', clientName: 'Business', displayTitle: 'Business', displayDescription: '', planStatus: 'PUBLISHED', desktopBannerUrl: null, mobileBannerUrl: null, posts: [], stats: { totalPosts: 0, approvedPosts: 0, pendingPosts: 0, revisionPosts: 0, totalAssets: 0, approvalPercentage: 0 } }));
  assert.ok(!html.includes('posts in workspace'));
  assert.ok(html.includes('review') || html.includes('Review'));
});
test('channel callback cleanup preserves section, unrelated filters and hash without router navigation', () => {
  const originalWindow = global.window;
  try {
    for (const [file, props, flags] of [
      ['InstagramConnectionCard', { username: null, connectedAt: null }, 'instagramConnected=true'],
      ['TikTokConnectionCard', { username: null, connectedAt: null }, 'tiktokMessagingConnected=true'],
      ['AdditionalChannelCard', { channel: 'facebook', accountName: null, connectedAt: null }, 'facebookError=denied'],
    ]) {
      const effects = []; let result;
      const url = new URL(`https://example.test/dashboard/calendars/id?view=channels&month=2026-10&${flags}#connections`);
      global.window = { location: { href: url.href }, history: { replaceState: (_state, _title, href) => { result = new URL(href, url); } } };
      const Component = load(`components/calendars/${file}.tsx`, {
        react: { ...React, useEffect: fn => { effects.push(fn); } },
        'next/navigation': { useSearchParams: () => url.searchParams, useRouter: () => ({ replace: () => assert.fail('cleanup must not navigate'), refresh: () => assert.fail('cleanup must not refresh') }) },
        '@/lib/publishing/clientRequests': {}, '@/components/ui/UiSymbol': stub,
        './LinkedInPagePicker': stub, './TikTokMessagingPanel': stub,
      });
      renderToStaticMarkup(React.createElement(Component, { ...props, calendarId: 'id', isManager: true }));
      effects.forEach(fn => fn());
      assert.equal(result.searchParams.get('view'), 'channels');
      assert.equal(result.searchParams.get('month'), '2026-10');
      assert.equal(result.hash, '#connections');
      assert.equal(result.searchParams.has(flags.split('=')[0]), false);
    }
  } finally { global.window = originalWindow; }
});
test('mobile workspace navigation exposes primary destinations and groups AI tools', () => {
  const html = manager('https://example.test/dashboard/calendars/workspace?view=research', [...sections, {id:'research',label:'Research',title:'Research',group:'AI Studio',eyebrow:'Research',description:'',content:React.createElement('div',{'data-panel':'research'})}]);
  const bar = html.match(/<nav[^>]*aria-label="Mobile workspace navigation"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(bar);for (const label of ['Home','content','inbox','AI Studio','More']) assert.ok(bar.includes(label));
  assert.ok(!bar.includes('>knowledge<'));assert.ok(!bar.includes('>analytics<'));
  assert.ok(html.includes('data-panel="research"'));assert.ok(html.includes('env(safe-area-inset-bottom)'));
});
test('mobile navigation does not invent inaccessible workspace destinations', () => {
  const html = manager('https://example.test/dashboard/calendars/workspace?view=content',[sections[1]]);
  const bar = html.match(/<nav[^>]*aria-label="Mobile workspace navigation"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(bar.includes('content'));assert.ok(!bar.includes('AI Studio'));assert.ok(!bar.includes('>inbox<'));assert.ok(!bar.includes('>Home<'));
});
test('drawer adds a bottom-sheet presentation without changing existing side drawers', () => {
  const Drawer = load('components/navigation/MobileDrawer.tsx', {});
  const props = {open:false,onClose:()=>{},label:'More workspace options',children:React.createElement('button',null,'Analytics')};
  const bottom=renderToStaticMarkup(React.createElement(Drawer,{...props,placement:'bottom'}));
  const side=renderToStaticMarkup(React.createElement(Drawer,props));
  assert.ok(bottom.includes('aria-label="More workspace options"'));
  assert.ok(bottom.includes('max-h-[85dvh]'));assert.ok(bottom.includes('rounded-t-3xl'));assert.ok(bottom.includes('translate-y-full'));
  assert.ok(side.includes('-translate-x-full'));assert.ok(!side.includes('max-h-[85dvh]'));
});
test('workspace menu exposes a semantic active item and distinct icons for each section', () => {
  const available=[...sections,{id:'research',label:'Research',title:'Research',group:'AI Studio',eyebrow:'Research',description:'',content:React.createElement('div',{'data-panel':'research'})}];
  const html=manager('https://example.test/dashboard/calendars/workspace?view=research',available);
  assert.match(html,/<button[^>]*data-section="research"[^>]*aria-current="page"/);
  assert.doesNotMatch(html,/<button[^>]*data-section="knowledge"[^>]*aria-current="page"/);
  for(const icon of ['layout-dashboard','calendar-range','users-round','chart-no-axes-combined','messages-square','contact-round','panels-top-left','cable','brain-circuit','book-open-text','wand-sparkles','send-horizontal']) assert.ok(html.includes(`lucide-${icon}`),icon);
  assert.ok(html.includes('lucide-chevrons-left'));assert.ok(!html.includes('lucide-panel-left-close'));
});

test('workspace help opens independently without replacing the current workspace', () => {
  const html = manager('https://example.test/dashboard/calendars/workspace?view=content');
  assert.match(html, /href="\/help\/workspace" target="_blank" rel="noopener noreferrer"/);
  assert.ok(html.includes('Help &amp; guides'));
  assert.ok(html.includes('data-workspace-panel="content"'));
});
