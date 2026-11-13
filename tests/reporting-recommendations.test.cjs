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
const { strategy } = require('./fixtures/monthly-strategy.cjs');
const insight = (id, type, recommendation) => ({ id, type: 'RECOMMENDATION', recommendation: recommendation.trim() ? recommendation : '', title: `${id} title`, description: `${id} evidence`, platform: null, strategy: strategy(recommendation.trim() || 'A learning plan'), generatedAt: new Date().toISOString() });
function report(insights) {
  return { insights, comparisonPeriod: { start: '2026-09-01', end: '2026-09-30' }, period: { start: '2026-10-01', end: '2026-10-30' }, performance: {}, connections: [], accountPosts: [], posts: [], leads: null, facebookPageActivity: null, facebookPageActivityError: null };
}
function panel(h, handoff) {
  return load('components/calendars/CalendarReportingPanel.tsx', { react: h.react, '@/lib/reporting/recommendationHandoff': handoff, '@/components/calendars/WorkspaceFeatureNotice': { default: () => null, __esModule: true }, '@/components/ui/UiSymbol': { default: () => null, __esModule: true } }).default;
}
const panelProps = { calendarId: 'a', isManager: true, canAnalyze: true, canApplyRecommendations: true };
test('one monthly strategy hands off all evidence and suggested settings without legacy actions', async () => {
 const b=browser();try {
 const h=hooks(),handoff=load('lib/reporting/recommendationHandoff.ts'),Panel=panel(h,handoff);
 global.fetch=async()=>response(report([insight('plan','RECOMMENDATION','A specific monthly experiment')]));
 const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();
 assert.equal(button(render(),'Apply all recommendations'),undefined);
 button(render(),'Generate next calendar').props.onClick();
 const brief=handoff.consumeReportingRecommendation('a');assert.match(brief,/A specific monthly experiment/);assert.match(brief,/Promotion status is unknown/);assert.doesNotMatch(brief,/WEEKLY PLAN|CHANNEL EXECUTION/);
 assert.equal(handoff.consumeStrategySettings,undefined);
 h.unmount();}finally{b.restore();}
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
    assert.equal(button(render(), 'Generate next calendar'), undefined);
    render(); h.flush();
    assert.equal(requests.length,2,'channel selection immediately fetches the report');
    find(render(), node=>node.type==='input' && node.props.value==='LINKEDIN')[0].props.onChange();
    render(); h.flush();
    requests[2].resolve(response(report([insight('current', 'TREND', 'Current experiment')]))); await tick();
    requests[1].resolve(response(report([insight('late', 'TREND', 'Late old experiment')]))); await tick();
    button(render(), 'Generate next calendar').props.onClick();
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
    const analyzing = button(render(), 'Refresh strategy').props.onClick();
    find(render(), node=>node.type==='input' && node.props.value==='FACEBOOK')[0].props.onChange();
    render(); h.flush(); await tick();
    assert.equal(button(render(), 'Generate next calendar').props.disabled, true);
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
test('strategy handoff preserves the user’s chosen dates, frequency and platforms', async () => {
 const b=browser();try {
 const handoff=load('lib/reporting/recommendationHandoff.ts'),h=hooks(),Card=generator(handoff,h);let sent;
 global.fetch=async(url,options)=>{sent=JSON.parse(options.body);return response({});};
 const render=()=>h.render(Card,props);render();h.flush();
 button(render(),'Next').props.onClick();
 const dates=find(render(),n=>n.type==='input'&&n.props.type==='date');dates[0].props.onChange({target:{value:'2027-03-01'}});dates[1].props.onChange({target:{value:'2027-03-21'}});
 find(render(),n=>n.type==='input'&&n.props.type==='number')[0].props.onChange({target:{value:'3'}});
 const brief=load('lib/reporting/monthlyStrategy.ts').strategyBrief(strategy('Specific new calendar direction'));
 handoff.queueReportingRecommendation('a',brief);
 assert.equal(find(render(),n=>n.type==='textarea')[0].props.value,brief);
 assert.equal(find(render(),n=>n.type==='input'&&n.props.type==='date')[0].props.value,'2027-03-01');
 button(render(),'Next').props.onClick();button(render(),'Generate calendar').props.onClick();await tick();
 assert.equal(sent.customInstructions,brief);assert.equal(sent.usePerformanceRecommendations,true);assert.equal(sent.postsPerWeek,3);assert.equal(sent.endDate,'2027-03-21');assert.deepEqual(sent.platforms,['INSTAGRAM']);h.unmount();
 }finally{b.restore();}
});
test('locked strategies cannot be applied', async () => {
 const b=browser();try{const h=hooks(),handoff=load('lib/reporting/recommendationHandoff.ts'),Panel=panel(h,handoff);
 global.fetch=async()=>response(report([insight('locked','RECOMMENDATION','Experiment')]));const render=()=>h.render(Panel,{...panelProps,recommendationsAccess:false});render();h.flush();await tick();assert.equal(button(render(),'Generate next calendar'),undefined);assert.equal(handoff.consumeReportingRecommendation('a'),null);h.unmount();}finally{b.restore();}
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
  const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();assert.ok(button(render(),'Generate next calendar'));
  window.dispatchEvent(new CustomEvent('showwork-reporting-channels-changed',{detail:{calendarId:'different'}}));assert.equal(request,1);
  window.dispatchEvent(new CustomEvent('showwork-reporting-channels-changed',{detail:{calendarId:'a'}}));assert.equal(button(render(),'Generate next calendar'),undefined);
  next.resolve(response(report([])));await tick();assert.equal(button(render(),'Generate next calendar'),undefined);h.unmount();
 }finally{b.restore();}
});

test('editing the only goal field refreshes the strategy without asking for ad context',async()=>{
 const b=browser();try{
 const h=hooks(),handoff=load('lib/reporting/recommendationHandoff.ts'),Panel=panel(h,handoff);let request;
 global.fetch=async(url,options)=>{if(url.endsWith('/analyze')){request=JSON.parse(options.body);return response({generated:1});}return response({...report([insight('ready','RECOMMENDATION','Specific plan')]),connections:[{id:'current',status:'CONNECTED',platform:'INSTAGRAM',lastSyncAt:'2026-11-13',accountMetricSnapshots:[]}]});};
 const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();
 assert.equal(button(render(),'Generate next calendar').props.disabled,false);
 const goal=find(render(),n=>n.type==='input' && n.props.placeholder==='For example: attract more qualified enquiries')[0];goal.props.onChange({target:{value:'Attract qualified wedding enquiries'}});assert.equal(find(render(),n=>n.type==='textarea').length,0);
 assert.equal(button(render(),'Generate next calendar').props.disabled,true);
 await button(render(),'Refresh strategy').props.onClick();await tick();
 assert.equal(request.objective,'Attract qualified wedding enquiries');assert.equal(request.promotion,undefined);assert.equal(request.context,undefined);assert.equal(button(render(),'Generate next calendar').props.disabled,false);
 h.unmount();}finally{b.restore();}
});

test('background refresh keeps recommendation actions usable with the current scoped report',async()=>{
 const b=browser();try{
  const h=hooks(),handoff=load('lib/reporting/recommendationHandoff.ts'),Panel=panel(h,handoff),refresh=deferred();let count=0;
  const data={...report([insight('saved','RECOMMENDATION','Current direction')]),connections:[{id:'current',status:'CONNECTED',platform:'INSTAGRAM',lastSyncAt:'2026-11-13',accountMetricSnapshots:[]}]};
  global.fetch=()=>++count===1?Promise.resolve(response(data)):refresh.promise;
  const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();
  window.dispatchEvent(new Event('focus'));assert.equal(count,2);
  assert.equal(button(render(),'Refresh strategy').props.disabled,false);
  assert.equal(button(render(),'Generate next calendar').props.disabled,false);
  button(render(),'Generate next calendar').props.onClick();assert.match(handoff.consumeReportingRecommendation('a'),/Current direction/);
  refresh.resolve(response(data));await tick();h.unmount();
 }finally{b.restore();}
});

test('overview invitation opens recommendations at the top and focuses the revealed panel',async()=>{
 const b=browser();try{
  const h=hooks(),Panel=panel(h,load('lib/reporting/recommendationHandoff.ts'));const calls=[];
  global.document.getElementById=id=>({scrollIntoView:options=>calls.push({id,scroll:options}),focus:options=>calls.push({id,focus:options})});
  global.fetch=async()=>response(report([insight('saved','RECOMMENDATION','Direction')]));
  const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();
  const headline=find(render(),n=>n.type==='h2'&&text(n).includes('Before your next post'));assert.equal(headline.length,1);
  button(render(),'See my recommendation').props.onClick();const tree=render();h.flush();
  const panelNode=find(tree,n=>n.props.id==='analytics-panel-ai-insights')[0];assert.equal(panelNode.props.hidden,false);
  assert.deepEqual(calls,[{id:'analytics-panel-ai-insights',scroll:{block:'start',behavior:'instant'}},{id:'analytics-panel-ai-insights',focus:{preventScroll:true}}]);h.unmount();
 }finally{b.restore();}
});

test('overview invitation never renders a stored internal calendar-generation brief',async()=>{
 const b=browser();try{
  const h=hooks(),Panel=panel(h,load('lib/reporting/recommendationHandoff.ts'));
  const stored={id:'legacy',type:'RECOMMENDATION',platform:null,title:'Show one client workflow',description:'Diagnosis',recommendation:'MONTHLY CONTENT STRATEGY V1\nMONTHLY OBJECTIVE: internal planning details\n'+'INTERNAL BRIEF MUST NOT APPEAR '.repeat(500),generatedAt:new Date().toISOString()};
  global.fetch=async()=>response(report([stored]));const render=()=>h.render(Panel,panelProps);render();h.flush();await tick();
  const card=find(render(),n=>n.type==='section'&&n.props['aria-labelledby']==='next-move-title')[0];
  assert.ok(card);const copy=text(card);assert.match(copy,/Before your next post/);assert.match(copy,/Show one client workflow/);assert.match(copy,/See my recommendation/);
  assert.doesNotMatch(copy,/MONTHLY CONTENT STRATEGY|MONTHLY OBJECTIVE|INTERNAL BRIEF/);assert.ok(copy.length<400);h.unmount();
 }finally{b.restore();}
});
