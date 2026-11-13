const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/reporting/comparison.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(moduleUnderTest, moduleUnderTest.exports);
const { change, compareAccounts } = moduleUnderTest.exports;
const start = new Date('2026-10-01T00:00:00Z');
const end = new Date('2026-10-02T23:59:59.999Z');
const previousStart = new Date('2026-09-29T00:00:00Z');
const snapshot = (day, reach, followers = 100, views = null, engagement = null) => ({ snapshotDate: `${day}T00:00:00Z`, reach, followers, views, engagement });
const account = (snapshots, platform = 'FACEBOOK') => ({ id: 'a', platform, status: 'CONNECTED', accountMetricSnapshots: snapshots });
test('compares full equal periods, not first and last daily values', () => {
  const result = compareAccounts([account([snapshot('2026-09-29', 20), snapshot('2026-09-30', 40), snapshot('2026-10-01', 50), snapshot('2026-10-02', 40, 110)])], start, end, previousStart);
  assert.deepEqual(result.reach, { value: 90, delta: 30, percent: 50, basis: 'observed totals vs previous period' });
  assert.equal(result.followers.delta, 10);
});
test('declines are negative and zero baseline never produces infinity', () => {
  assert.deepEqual(change(0, 10, 'test'), { value: 0, delta: -10, percent: -100, basis: 'test' });
  assert.equal(change(10, 0, 'test').percent, null);
  assert.equal(change(0, 0, 'test').delta, 0);
});
test('missing days and missing follower baselines do not imply zero', () => {
  const result = compareAccounts([account([snapshot('2026-10-01', 50), snapshot('2026-10-02', 70)])], start, end, previousStart);
  assert.equal(result.reach.value, 120);
  assert.equal(result.reach.delta, null);
  assert.equal(result.followers.delta, 0);
  assert.equal(result.followers.basis, 'between available follower snapshots');
  const partial = compareAccounts([account([snapshot('2026-09-29', 5), snapshot('2026-10-01', 50), snapshot('2026-10-02', 70)])], start, end, previousStart);
  assert.equal(partial.reach.delta, 115);
});
test('rolling Instagram totals use the latest value and compare between syncs', () => {
  const result = compareAccounts([account([snapshot('2026-10-01', 10, 100, 1000, 50), snapshot('2026-10-02', 20, 100, 1100, 60)], 'INSTAGRAM')], start, end, previousStart);
  assert.equal(result.views.value, 1100);
  assert.equal(result.views.delta, 100);
  assert.equal(result.views.basis, "rolling total change between syncs");
  assert.equal(result.engagement.value, 60);
  assert.equal(result.engagement.delta, 10);
  assert.equal(result.reach.value, 30);
});
test('accounts with only earlier observations cannot silently distort comparisons', () => {
  const result = compareAccounts([account([snapshot('2026-09-29', 20), snapshot('2026-09-30', 40)]), account([snapshot('2026-09-29', 20), snapshot('2026-09-30', 40), snapshot('2026-10-01', 50), snapshot('2026-10-02', 40)])], start, end, previousStart);
  assert.equal(result.reach.delta, null);
});
test('disconnected accounts and empty histories are excluded', () => {
  const result = compareAccounts([{ ...account([snapshot('2026-10-01', 100)]), status: 'DISCONNECTED' }], start, end, previousStart);
  assert.equal(result.followers.value, null);
  assert.equal(result.reach.value, null);
});
function reportingData(leadQueries = [], reportQueries = [], historyStart = new Date("2020-01-01")) {
  const db = {
    calendarReportingPermission: { findUnique: async () => null },
    socialConnection: { findMany: async args => { reportQueries.push(args); return []; }, findFirst: async args => { if (args.where.platform === "FACEBOOK") reportQueries.push("facebook"); return null; } },
    publishedSocialPost: { findMany: async args => { reportQueries.push(args); return []; } },
    reportingInsight: { findMany: async args => { reportQueries.push(args); return []; } },
    leadAnalyticsTracking: { findUnique: async () => historyStart ? {startedAt:historyStart} : null },
    calendarLead: { count: async args => { leadQueries.push(args); return 0; }, findMany: async args => { leadQueries.push(args); return []; } },
  };
  const mod = { exports: {} };
  const mocks = { '@/lib/calendarPermissions': { canUseCalendarFeature: async () => true }, '@/lib/db': { db }, '@/lib/r2': { publicUrlFor: () => null }, '@/lib/reporting/adapters': { getSocialReportingAdapter: () => null }, '@/lib/reporting/comparison': moduleUnderTest.exports };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/reporting/data.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => { if (name === '@/lib/reporting/monthlyStrategy') return require('./helpers/load-typescript.cjs').load('lib/reporting/monthlyStrategy.ts'); assert.ok(mocks[name], `Unexpected dependency ${name}`); return mocks[name]; }, mod, mod.exports);
  return mod.exports;
}
test('rejects impossible calendar dates and uses whole-day default periods', () => {
  const { reportingPeriod } = reportingData();
  assert.throws(() => reportingPeriod(new URLSearchParams({ from: '2026-02-30', to: '2026-03-05' })), /valid/);
  const period = reportingPeriod(new URLSearchParams({ to: '2026-10-02' }));
  assert.equal(period.start.toISOString(), '2026-09-03T00:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-10-02T23:59:59.999Z');
});
test('shared reports do not query or expose private lead records', async () => {
  const calls = [];
  const report = await reportingData(calls).getCalendarReportingData('workspace', new URLSearchParams({ from: '2026-10-01', to: '2026-10-02' }), false);
  assert.equal(report.leads, null);
  assert.equal(calls.length, 0);
  assert.deepEqual(report.comparisonPeriod, { start: '2026-09-29T00:00:00.000Z', end: '2026-09-30T23:59:59.999Z' });
});
test('hot-lead shortlist stays in workspace, period and platform and excludes closed leads', async () => {
  const calls = [];
  await reportingData(calls).getCalendarReportingData('workspace', new URLSearchParams({ from: '2026-10-01', to: '2026-10-02', platform: 'INSTAGRAM' }), true);
  const query = calls.at(-1);
  assert.equal(query.take, 5);
  assert.equal(query.where.calendarId, 'workspace');
  assert.equal(query.where.temperature, 'HOT');
  assert.deepEqual(query.where.status, { notIn: ['CUSTOMER', 'LOST'] });
  assert.deepEqual(query.where.socialConversation, { platform: { in: ['INSTAGRAM'] } });
  assert.equal(query.where.milestones.some.occurredAt.gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(query.select.email, undefined);
});
test('TikTok native posts restore views and engagement without inventing daily counters', () => {
  const a = account([snapshot('2026-10-02', null)], 'TIKTOK');
  a.accountPosts = [
    { publishedAt: '2026-10-01', views: 1200, engagement: 80, reach: null, likes: 60 },
    { publishedAt: '2026-09-29', views: 1000, engagement: 100, reach: null, likes: 70 },
  ];
  const result = compareAccounts([a], start, end, previousStart);
  assert.equal(result.views.value, 1200);
  assert.equal(result.views.delta, 200);
  assert.equal(result.engagement.delta, -20);
  assert.equal(result.views.basis, 'lifetime totals of posts published in each period');
});
test('single rolling snapshot displays totals with a specific missing-history explanation', () => {
  const result = compareAccounts([account([snapshot('2026-10-02', 20, 100, 1100, 60)], 'INSTAGRAM')], start, end, previousStart);
  assert.equal(result.views.value, 1100);
  assert.equal(result.engagement.value, 60);
  assert.equal(result.views.delta, null);
  assert.match(result.views.note, /No earlier matching data/);
  assert.equal(result.followers.delta, null);
});
test('unchanged follower totals explain the actual counts and limited history', () => {
  const result = compareAccounts([account([snapshot('2026-10-01', 10, 55), snapshot('2026-10-02', 20, 55)])], start, end, previousStart);
  assert.equal(result.followers.value, 55);
  assert.equal(result.followers.delta, 0);
  assert.match(result.followers.note, /55 → 55/);
  assert.match(result.followers.note, /2026-10-01 → 2026-10-02/);
  assert.match(result.followers.note, /History before the first recorded count is unavailable/);
});
test('follower gains use the earlier recorded count rather than the total audience', () => {
  const result = compareAccounts([account([snapshot('2026-09-30', 10, 50), snapshot('2026-10-02', 20, 55)])], start, end, previousStart);
  assert.equal(result.followers.delta, 5);
  assert.match(result.followers.note, /50 → 55/);
});

test('live Facebook follower and daily values show without fabricated history or deltas', () => {
  const { applyLiveFacebookOverview } = moduleUnderTest.exports;
  const empty=compareAccounts([account([])],start,end,previousStart);
  const result=applyLiveFacebookOverview(empty,{followers:15,latestMetrics:{asOf:'2026-10-02T12:00:00Z',reach:0,views:0,engagement:0}},start,end);
  assert.equal(result.followers.value,15);assert.equal(result.followers.delta,null);assert.match(result.followers.basis,/Current Facebook/);
  assert.equal(result.reach.value,0);assert.equal(result.views.value,0);assert.equal(result.engagement.value,0);
  assert.equal(result.reach.delta,null);assert.match(result.reach.basis,/Latest available/);
});
test('current live daily values do not become historical period totals or overwrite saved daily history',()=>{
  const { applyLiveFacebookOverview }=moduleUnderTest.exports;
  const real=compareAccounts([account([snapshot('2026-10-01',50)])],start,end,previousStart);
  const live={followers:15,latestMetrics:{asOf:'2026-10-06T12:00:00Z',reach:0,views:0,engagement:0}};
  const result=applyLiveFacebookOverview(real,live,start,end);assert.equal(result.reach.value,50);assert.equal(result.views.value,null);
  const inPeriod=applyLiveFacebookOverview(real,{...live,latestMetrics:{...live.latestMetrics,asOf:'2026-10-02T12:00:00Z'}},start,end);
  assert.equal(inPeriod.reach.value,50);
});
test('report reads use persisted Facebook observations and never call the provider',async()=>{
  const savedSnapshot={snapshotDate:new Date('2026-10-06'),followers:15,reach:20,views:30,engagement:4};
  const savedPost={id:'saved',platformPostId:'post',publishedAt:new Date('2026-08-09'),caption:'Saved content',likes:4,comments:0,shares:0,reach:269,impressions:283,engagement:4,metricsUpdatedAt:new Date('2026-10-06')};
  const connection={id:'fb',platform:'FACEBOOK',platformAccountId:'page',accountName:'Page',status:'CONNECTED',accountMetricSnapshots:[savedSnapshot],accountPosts:[savedPost]};
  const db={leadAnalyticsTracking:{findUnique:async()=>({startedAt:new Date("2020-01-01")})},socialConnection:{findMany:async()=>[connection],findFirst:async()=>connection},publishedSocialPost:{findMany:async()=>[]},reportingInsight:{findMany:async()=>[]},calendarLead:{count:async()=>0,findMany:async()=>[]}};
  const deps={'@/lib/calendarPermissions':{canUseCalendarFeature:async()=>true},'@/lib/db':{db},'@/lib/r2':{publicUrlFor:()=>null},'@/lib/reporting/comparison':moduleUnderTest.exports};
  const {load}=require('./helpers/load-typescript.cjs');
  const original=global.fetch;global.fetch=()=>{throw Error('Provider IO forbidden on report reads');};
  try{
    const result=await load('lib/reporting/data.ts',deps).getCalendarReportingData('workspace',new URLSearchParams({from:'2026-01-01',to:'2026-10-06',platform:'FACEBOOK'}),true);
    assert.equal(result.performance.followers.value,15);assert.equal(result.performance.reach.value,20);
    assert.equal(result.performance.postMediaViews.value,283);assert.equal(result.accountPosts[0].likes,4);
    assert.deepEqual(result.connections[0].accountMetricSnapshots,[savedSnapshot]);
  }finally{global.fetch=original;}
});

test('multiple platforms restrict every report query and reject unknown platforms', async () => {
  const calls = [];
  const queries = [];
  const data = reportingData(calls, queries);
  await data.getCalendarReportingData('workspace', new URLSearchParams({ platform: 'INSTAGRAM,TIKTOK' }), true);
  assert.deepEqual(calls.at(-1).where.socialConversation, { platform: { in: ['INSTAGRAM', 'TIKTOK'] } });
  assert.deepEqual(queries[0].where.platform, { in: ['INSTAGRAM', 'TIKTOK'] });
  assert.deepEqual(queries[1].where.platform, { in: ['INSTAGRAM', 'TIKTOK'] });
  assert.deepEqual(queries[2].where.OR[0].platform, { in: ['INSTAGRAM', 'TIKTOK'] });
  assert.ok(!queries.includes('facebook'));
  await data.getCalendarReportingData('workspace', new URLSearchParams({ platform: 'INSTAGRAM,FACEBOOK' }), true);
  assert.ok(queries.includes('facebook'));
  await assert.rejects(data.getCalendarReportingData('workspace', new URLSearchParams({ platform: 'INSTAGRAM,INVALID' }), true), /supported social platform/);
});

test('client lead summaries return counts scoped to workspace, period and channel without private records',async()=>{
 const queries=[];
 const report=await reportingData(queries).getCalendarReportingData('workspace',new URLSearchParams({from:'2026-10-01',to:'2026-10-02',platform:'INSTAGRAM'}),false,false,true);
 assert.equal(report.leads.total,0);assert.equal(report.leads.hotCount,0);assert.equal(report.leads.customers,0);assert.deepEqual(report.leads.hottest,[]);
 assert.equal(queries.length,5);assert.ok(queries.every(query=>query.select===undefined&&query.take===undefined));
 for(const query of queries){assert.equal(query.where.calendarId,'workspace');assert.deepEqual(query.where.socialConversation,{platform:{in:['INSTAGRAM']}});}
 assert.equal(queries[3].where.milestones.some.kind,'HOT');assert.equal(queries[4].where.milestones.some.kind,'CUSTOMER');
 assert.equal(queries[3].where.createdAt,undefined);assert.equal(queries[4].where.createdAt,undefined);
 assert.equal(queries[4].where.milestones.some.occurredAt.gte.toISOString(),'2026-10-01T00:00:00.000Z');
});
test('team members without lead access do not query or receive lead analytics',async()=>{
 const queries=[];const report=await reportingData(queries).getCalendarReportingData('workspace',new URLSearchParams({from:'2026-10-01',to:'2026-10-02'}),true,false);
 assert.equal(report.leads,null);assert.equal(queries.length,0);
});

test('partial periods retain recorded milestone counts instead of hiding the whole card',async()=>{
 const queries=[];const report=await reportingData(queries,[],new Date('2026-10-02T12:00:00Z')).getCalendarReportingData('workspace',new URLSearchParams({from:'2026-10-01',to:'2026-10-02'}),false,false,true);
 assert.equal(report.leads.milestoneCountsAvailable,true);assert.equal(report.leads.milestoneCountsComplete,false);assert.equal(report.leads.milestoneBasis,'tracked-period');assert.equal(report.leads.hotCount,0);assert.equal(report.leads.customers,0);assert.equal(queries.length,5);
});
test('periods entirely before tracking keep historical milestone totals unavailable',async()=>{
 const queries=[];const report=await reportingData(queries,[],new Date('2026-10-03T12:00:00Z')).getCalendarReportingData('workspace',new URLSearchParams({from:'2026-10-01',to:'2026-10-02'}),false,false,true);
 assert.equal(report.leads.milestoneBasis,'unavailable');assert.equal(report.leads.hotCount,null);assert.equal(report.leads.customers,null);assert.equal(queries.length,3);
});
