const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');
function setup({ authorized = true, active = true, queued = true, jobs = [] } = {}) {
  const deferred = [], calls = [];
  const api = load('app/api/calendars/[id]/reporting/sync/route.ts', {
    'next/server': { after: fn => deferred.push(fn), NextResponse: { json: (body, opts) => ({ body, status: opts?.status ?? 200, headers: opts?.headers }) } },
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'owner' }) },
    '@/lib/calendarPermissions': { hasCalendarPermission: async (_u,_c,permission) => { calls.push(['permission',permission]); return authorized; }, canAccessCalendarById: async () => active },
    '@/lib/db': { db: { reportingSyncJob: { findMany: async args => { calls.push(['status', args]); return jobs; } } } },
    '@/lib/reporting/jobs': { enqueueReportingSync: async (id,mode) => { calls.push(['enqueue',id,mode]); return { queued, eligible: 1 }; }, runNextReportingJob: async id => calls.push(['drain',id]) },
  });
  const context = { params: Promise.resolve({ id: 'workspace' }) };
  return { deferred, calls, run: (automatic=false) => api.POST({url:'https://example.test/sync'+(automatic?'?automatic=1':'')}, context), status: () => api.GET({}, context) };
}
test('manual update persists work before opportunistic draining', async () => {
  const f = setup(); const r = await f.run(); assert.equal(r.status,202); assert.equal(r.body.queued,true);
  assert.deepEqual(f.calls.slice(0,2),[['permission','analytics.manage'],['enqueue','workspace','manual']]);
  assert.equal(f.deferred.length,1); await f.deferred[0](); assert.deepEqual(f.calls.at(-1),['drain','workspace']);
});
test('permission and inactive workspace checks prevent all queue writes', async () => {
  for (const config of [{authorized:false},{active:false}]) { const f=setup(config);assert.equal((await f.run()).status,403);assert.equal(f.deferred.length,0);assert.ok(!f.calls.some(c=>c[0]==='enqueue')); }
});
test('automatic update uses server freshness rules and read permission, never manual bypass',async()=>{
  const f=setup({queued:false});assert.equal((await f.run(true)).status,200);assert.equal(f.deferred.length,0);
  assert.deepEqual(f.calls,[['permission','analytics.view'],['enqueue','workspace','automatic']]);
});
test('status tracks durable pending work rather than timestamps or unsupported platform lists',async()=>{
  const f=setup({jobs:[{status:'COMPLETE'},{status:'RUNNING'},{status:'PENDING'}]});const r=await f.status();assert.deepEqual(r.body,{completed:false,failed:0});assert.equal(r.headers['Cache-Control'],'no-store, private');
  assert.deepEqual((await setup({jobs:[{status:'COMPLETE'},{status:'FAILED'}]}).status()).body,{completed:true,failed:1});
});
