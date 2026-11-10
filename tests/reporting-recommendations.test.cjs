const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
function load(file, deps = {}) {
  deps={ '@/lib/publishing/clientRequests':require('./helpers/load-typescript.cjs').load('lib/publishing/clientRequests.ts'),...deps};
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in deps) return deps[name];
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === '@/components/ui/IconText') return require('./helpers/load-typescript.cjs').load('components/ui/IconText.tsx');
    if (name === '@/lib/aiGenerationResponse') return require('./helpers/load-typescript.cjs').load('lib/aiGenerationResponse.ts');
    if (name.startsWith('./Reporting')) return load(require('node:path').join(require('node:path').dirname(file), name + '.tsx'), deps);
    if (name === './WorkspaceFeatureNotice') return { __esModule: true, default: () => null };
    if (name.startsWith('@/') || name.startsWith('./')) {
      const path = require('node:path');
      const target = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
      const resolved = fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx';
      return require('./helpers/load-typescript.cjs').load(resolved, deps);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
function hooks() {
  let cursor = 0;
  const cells = [], effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { ...React,
    useMemo: fn => fn(),
    useState(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [cells[index].value, value => { cells[index].value = typeof value === 'function' ? value(cells[index].value) : value; }];
    },
    useRef(initial) { return cells[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: fn, deps };
      return cells[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!cells[index] || !same(cells[index].deps, deps)) {
        const previous = cells[index]; cells[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); cells[index].cleanup = fn(); });
      }
    },
  };
  return { react, render(component, props) { cursor = 0; return component(props); }, flush() { while (effects.length) effects.shift()(); }, unmount() { cells.forEach(cell => cell.cleanup?.()); } };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  if (!React.isValidElement(node)) return [];
  if (typeof node.type === 'function' && ['ReportingInsights', 'ReportingChannels'].includes(node.type.name)) return find(node.type(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...find(node.props.children, predicate)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (React.isValidElement(node)) {
    if (typeof node.type === 'function' && ['ReportingInsights', 'ReportingChannels'].includes(node.type.name)) return text(node.type(node.props));
    return text(node.props.children);
  }
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node).includes(label))[0];
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = data => ({ ok: true, json: async () => data });
function browser(blocked = false) {
  const original = { window: global.window, fetch: global.fetch, CustomEvent: global.CustomEvent, document: global.document, requestAnimationFrame: global.requestAnimationFrame };
  const events = new EventTarget(), storage = new Map(), timers = [];
  global.CustomEvent = class extends Event { constructor(name, options) { super(name); this.detail = options?.detail; } };
  global.requestAnimationFrame = fn => fn();
  global.document = { visibilityState: "visible" };
  global.window = Object.assign(events, {
    sessionStorage: { getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); }, removeItem: key => { if (blocked) throw Error('blocked'); storage.delete(key); } },
    setInterval: fn => { timers.push(fn); return timers.length; }, clearInterval: () => {},
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
  });
  return { timers, restore() { Object.assign(global, original); } };
}
function generator(handoff, h) {
  return load('components/calendars/AiContentGeneratorCard.tsx', { react: h.react, '@/lib/reporting/recommendationHandoff': handoff, '@/components/calendars/WorkspaceFeatureNotice': { default: () => null, __esModule: true }, '@/components/calendars/AiDraftReviewModal': { default: () => null, __esModule: true } }).default;
}
const props = { calendarId: 'a', hasBusinessSummary: true };
test('recommendations load on first mount and every later application, without losing batch settings', () => {
  const b = browser();
  try {
    const handoff = load('lib/reporting/recommendationHandoff.ts');
    handoff.queueReportingRecommendation('a', 'First recommendation');
    const h = hooks(), Card = generator(handoff, h);
    const render = () => h.render(Card, props);
    render(); h.flush();
    assert.equal(find(render(), n => n.type === 'textarea')[0].props.value, 'First recommendation');
    const date = find(render(), n => n.type === 'input' && n.props.type === 'date')[0];
    date.props.onChange({ target: { value: '2026-12-01' } });
    handoff.queueReportingRecommendation('a', 'Filtered next recommendation');
    assert.equal(find(render(), n => n.type === 'textarea')[0].props.value, 'Filtered next recommendation');
    assert.equal(find(render(), n => n.type === 'input' && n.props.type === 'date')[0].props.value, '2026-12-01');
    handoff.queueReportingRecommendation('other', 'Other workspace');
    assert.equal(find(render(), n => n.type === 'textarea')[0].props.value, 'Filtered next recommendation');
    assert.equal(handoff.consumeReportingRecommendation('a'), null);
    find(render(), n => n.type === 'textarea')[0].props.onChange({ target: { value: '' } });
    assert.equal(find(render(), n => n.props.role === 'status').length, 0);
    h.unmount();
    handoff.queueReportingRecommendation('a', 'After remount');
    const next = hooks(), NextCard = generator(handoff, next);
    next.render(NextCard, props); next.flush();
    assert.equal(find(next.render(NextCard, props), n => n.type === 'textarea')[0].props.value, 'After remount');
    next.unmount();
  } finally { b.restore(); }
});
test('blocked storage still delivers recommendations and empty instructions cannot replace them', () => {
  const b = browser(true);
  try {
    const handoff = load('lib/reporting/recommendationHandoff.ts'), h = hooks(), Card = generator(handoff, h);
    handoff.queueReportingRecommendation('a', 'Queued without storage');
    h.render(Card, props); h.flush();
    assert.equal(find(h.render(Card, props), n => n.type === 'textarea')[0].props.value, 'Queued without storage');
    assert.equal(handoff.queueReportingRecommendation('a', '   '), false);
    handoff.queueReportingRecommendation('a', 'Live without storage');
    assert.equal(find(h.render(Card, props), n => n.type === 'textarea')[0].props.value, 'Live without storage');
    h.unmount();
  } finally { b.restore(); }
});
const insight = (id, type, recommendation) => ({ id, type, recommendation, title: `${id} title`, description: `${id} evidence ${'e'.repeat(1500)} ${id} evidence end`, platform: 'INSTAGRAM', generatedAt: new Date().toISOString() });
function report(insights) {
  return { insights, comparisonPeriod: { start: '2026-09-01', end: '2026-09-30' }, period: { start: '2026-10-01', end: '2026-10-30' }, performance: {}, connections: [], accountPosts: [], posts: [], leads: null, facebookPageActivity: null, facebookPageActivityError: null };
}
function panel(h, handoff) {
  return load('components/calendars/CalendarReportingPanel.tsx', { react: h.react, '@/lib/reporting/recommendationHandoff': handoff, '@/components/calendars/WorkspaceFeatureNotice': { default: () => null, __esModule: true }, '@/components/ui/UiSymbol': { default: () => null, __esModule: true } }).default;
}
const panelProps = { calendarId: 'a', isManager: true, canAnalyze: true, canApplyRecommendations: true };
test('apply all uses only filtered, nonempty recommendations; single apply preserves long evidence', async () => {
  const b = browser();
  try {
    const h = hooks(), handoff = load('lib/reporting/recommendationHandoff.ts'), Panel = panel(h, handoff);
    let navigations = 0;
    window.addEventListener('showwork-workspace-navigate', () => navigations++);
    global.fetch = async () => response(report([insight('win', 'WHAT_WORKED', 'Win experiment'), insight('improve', 'UNDERPERFORMED', 'Improve experiment'), insight('blank', 'TREND', '   ')]));
    const render = () => h.render(Panel, panelProps);
    render(); h.flush(); await tick();
    button(render(), 'Wins').props.onClick();
    button(render(), 'Apply all recommendations').props.onClick();
    const instructions = handoff.consumeReportingRecommendation('a');
    assert.match(instructions, /Win experiment/); assert.doesNotMatch(instructions, /Improve experiment/);
    button(render(), 'Trends').props.onClick();
    assert.equal(button(render(), 'Apply all recommendations'), undefined);
    assert.equal(button(render(), 'Create content from this insight'), undefined);
    assert.equal(navigations, 1);
    button(render(), 'Improve').props.onClick();
    button(render(), 'Create content from this insight').props.onClick();
    const single = handoff.consumeReportingRecommendation('a');
    assert.match(single, /Improve experiment/);
    assert.match(single, /improve evidence end/);
    assert.ok(single.length > 1200);
    button(render(), 'Update now').props.onClick();
    await tick(); h.unmount();
  } finally { b.restore(); }
});
test('filter changes hide stale actions immediately and late requests cannot replace current recommendations', async () => {
  const b = browser();
  try {
    const h = hooks(), handoff = load('lib/reporting/recommendationHandoff.ts'), Panel = panel(h, handoff);
    const requests = [];
    global.fetch = url => { const d = deferred(); requests.push({ ...d, url }); return d.promise; };
    const render = () => h.render(Panel, panelProps);
    render(); h.flush();
    requests[0].resolve(response(report([insight('old', 'TREND', 'Old experiment')]))); await tick();
    find(render(), node=>node.type==='input' && node.props.value==='FACEBOOK')[0].props.onChange();
    assert.equal(button(render(), 'Apply all recommendations'), undefined);
    render(); h.flush();
    assert.equal(requests.length,2,'channel selection immediately fetches the report');
    find(render(), node=>node.type==='input' && node.props.value==='LINKEDIN')[0].props.onChange();
    render(); h.flush();
    requests[2].resolve(response(report([insight('current', 'TREND', 'Current experiment')]))); await tick();
    requests[1].resolve(response(report([insight('late', 'TREND', 'Late old experiment')]))); await tick();
    button(render(), 'Apply all recommendations').props.onClick();
    assert.match(handoff.consumeReportingRecommendation('a'), /Current experiment/);
    assert.match(requests[2].url, /platform=FACEBOOK%2CLINKEDIN/);
    h.unmount();
  } finally { b.restore(); }
});
test('analysis completion and delayed sync refresh the latest selected filters', async () => {
  const b = browser();
  try {
    const h = hooks(), handoff = load('lib/reporting/recommendationHandoff.ts'), Panel = panel(h, handoff), analysis = deferred(), urls = [];
    global.fetch = (url, options) => { urls.push(url); if (url.includes('/reporting/sync?')) return Promise.resolve(response({ completed: true, failed: 0 })); if (url.endsWith('/reporting/sync')) return Promise.resolve(response({ queued: true, queuedAt: new Date().toISOString() })); return url.endsWith('/analyze') ? analysis.promise : Promise.resolve(response({ ...report([insight('a', 'TREND', 'Experiment')]), connections: [{ id: 'connected', platform: 'INSTAGRAM', status: 'CONNECTED', accountMetricSnapshots: [], lastSyncAt: null }] })); };
    const render = () => h.render(Panel, panelProps);
    render(); h.flush(); await tick();
    const analyzing = button(render(), 'Refresh AI analysis').props.onClick();
    find(render(), node=>node.type==='input' && node.props.value==='FACEBOOK')[0].props.onChange();
    render(); h.flush(); await tick();
    assert.equal(button(render(), 'Apply all recommendations').props.disabled, true);
    analysis.resolve(response({ generated: 1 })); await analyzing; await tick();
    assert.match(urls.at(-1), /platform=FACEBOOK/);
    assert.equal(button(render(), 'Update now').props.disabled, false);
    button(render(), 'Update now').props.onClick(); await tick();
    find(render(), node=>node.type==='input' && node.props.value==='LINKEDIN')[0].props.onChange();
    render(); h.flush(); await tick();
    b.timers.at(-1)(); await tick();
    assert.match(urls.at(-1), /platform=FACEBOOK%2CLINKEDIN/);
    h.unmount();
  } finally { b.restore(); }
});
test('applying filtered recommendations twice populates the mounted generator and submits the latest batch', async () => {
  const b = browser();
  try {
    const handoff = load('lib/reporting/recommendationHandoff.ts');
    const ph = hooks(), Panel = panel(ph, handoff), gh = hooks(), Card = generator(handoff, gh);
    let sent;
    global.fetch = async (url, options) => {
      if (url.endsWith('/ai-generate')) { sent = JSON.parse(options.body); return response({}); }
      return response(report([insight('win', 'WHAT_WORKED', 'First experiment'), insight('improve', 'UNDERPERFORMED', 'Latest experiment')]));
    };
    const renderPanel = () => ph.render(Panel, panelProps);
    const renderCard = () => gh.render(Card, props);
    renderPanel(); ph.flush(); await tick();
    button(renderPanel(), 'Wins').props.onClick();
    button(renderPanel(), 'Apply all recommendations').props.onClick();
    renderCard(); gh.flush();
    assert.match(find(renderCard(), n => n.type === 'textarea')[0].props.value, /First experiment/);
    button(renderPanel(), 'Improve').props.onClick();
    button(renderPanel(), 'Apply all recommendations').props.onClick();
    const creativeDirection = find(renderCard(), n => n.type === 'textarea')[0].props.value;
    assert.match(creativeDirection, /Latest experiment/);
    assert.doesNotMatch(creativeDirection, /First experiment/);
    button(renderCard(), 'Next').props.onClick();
    button(renderCard(), 'Next').props.onClick();
    button(renderCard(), 'Generate calendar').props.onClick(); await tick();
    assert.equal(sent.customInstructions, creativeDirection);
    assert.equal(find(renderCard(), n => n.props.role === 'status').length, 1);
    ph.unmount(); gh.unmount();
  } finally { b.restore(); }
});
test('locked recommendations stay visible but cannot be applied', async () => {
  const b = browser();
  try {
    const h = hooks(), handoff = load('lib/reporting/recommendationHandoff.ts'), Panel = panel(h, handoff);
    global.fetch = async () => response(report([insight('saved', 'TREND', 'Saved recommendation')]));
    const render = () => h.render(Panel, { ...panelProps, canApplyRecommendations: false, recommendationsAccess: false });
    render(); h.flush(); await tick();
    assert.doesNotMatch(text(render()), /Saved recommendation/);
    assert.match(text(render()), /AI recommendations are available from Studio/);
    assert.equal(find(render(), n => n.props['aria-hidden'] === true && n.props.className?.includes('blur-sm')).length, 0);
    assert.equal(find(render(), n => n.type === 'a' && text(n).includes('Explore Studio'))[0].props.href, '/dashboard/billing?product=content-workspace#content-workspace-plans');
    assert.equal(button(render(), 'Apply all recommendations').props.disabled, true);
    button(render(), 'Apply all recommendations').props.onClick();
    assert.equal(button(render(), 'Create content from this insight'), undefined);
    assert.equal(handoff.consumeReportingRecommendation('a'), null);
    h.unmount();
  } finally { b.restore(); }
});
test('channel dropdown supports one, two and three selections, removal and all-channel reset', async () => {
  const b=browser();
  try {
    const h=hooks(),handoff=load('lib/reporting/recommendationHandoff.ts'),Panel=panel(h,handoff),urls=[];
    global.fetch=async url=>{urls.push(url);return response(report([]));};
    const render=()=>h.render(Panel,panelProps);
    render();h.flush();await tick();
    const toggle=async key=>{find(render(),node=>node.type==='input' && node.props.value===key)[0].props.onChange();render();h.flush();await tick();};
    await toggle('INSTAGRAM');assert.match(urls.at(-1),/platform=INSTAGRAM/);
    await toggle('FACEBOOK');assert.match(urls.at(-1),/platform=FACEBOOK%2CINSTAGRAM/);
    await toggle('LINKEDIN');assert.match(urls.at(-1),/platform=FACEBOOK%2CINSTAGRAM%2CLINKEDIN/);
    assert.match(text(render()),/3 channels/);
    await toggle('FACEBOOK');assert.match(urls.at(-1),/platform=INSTAGRAM%2CLINKEDIN/);
    await toggle('ALL');assert.doesNotMatch(urls.at(-1),/platform=/);
    assert.equal(find(render(),node=>node.type==='input' && node.props.value==='ALL')[0].props.checked,true);
    h.unmount();
  } finally {b.restore();}
});
test('a channel-change event removes cached analytics before reloading current connections',async()=>{
 const b=browser();
 try {
  const h=hooks(),Panel=panel(h,load('lib/reporting/recommendationHandoff.ts'));
  let request=0;const next=deferred();global.fetch=async()=>++request===1?response(report([insight('old','TREND','Old experiment')])):next.promise;
  const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();assert.ok(button(render(),'Apply all recommendations'));
  window.dispatchEvent(new CustomEvent('showwork-reporting-channels-changed',{detail:{calendarId:'different'}}));assert.equal(request,1);
  window.dispatchEvent(new CustomEvent('showwork-reporting-channels-changed',{detail:{calendarId:'a'}}));assert.equal(button(render(),'Apply all recommendations'),undefined);
  next.resolve(response(report([])));await tick();assert.equal(button(render(),'Apply all recommendations'),undefined);h.unmount();
 }finally{b.restore();}
});
