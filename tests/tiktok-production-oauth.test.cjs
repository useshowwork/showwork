const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const approved = 'https://useshowwork.com/api/calendars/tiktok/callback';
afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ['NODE_ENV', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'JWT_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
});
test('production OAuth lets TikTok manage login and uses the approved callback and scopes', async () => {
  process.env.NODE_ENV = 'production';
  process.env.TIKTOK_CLIENT_KEY = 'live-key-test'; process.env.TIKTOK_CLIENT_SECRET = 'private-secret-test';
  const { tikTokRedirectUri } = load('lib/tiktokOAuthConfig.ts', { '@/lib/url': { appUrl: () => 'https://www.useshowwork.com' } });
  const redirectUri = tikTokRedirectUri(); assert.equal(redirectUri, approved);
  const api = load('lib/tiktok.ts', {
    '@/lib/publishing/applicationBoundary': {},
    '@/lib/publishing/executionContext': { publishingFetch: (...args) => global.fetch(...args) },
  });
  const url = new URL(api.buildTikTokAuthUrl({ redirectUri, state: 'signed-state', codeChallenge: 'challenge' }));
  assert.equal(url.searchParams.get('scope'), 'user.info.basic,user.info.stats,video.list,video.publish');
  assert.equal(url.searchParams.get('client_key'), 'live-key-test');
  assert.equal(url.searchParams.has('disable_auto_auth'), false);
  assert.equal(url.searchParams.get('redirect_uri'), approved);
  assert.equal(url.searchParams.get('state'), 'signed-state');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge');
  assert.ok(!url.toString().includes('private-secret-test'));
  let calls = 0;
  global.fetch = async (input, init) => {
    calls++;assert.equal(input, 'https://open.tiktokapis.com/v2/oauth/token/');
    const body = new URLSearchParams(init.body);
    assert.equal(body.get('client_key'), 'live-key-test');assert.equal(body.get('client_secret'), 'private-secret-test');
    assert.equal(body.get('redirect_uri'), approved);assert.equal(body.get('code_verifier'), 'verifier');
    return Response.json({ open_id: 'account', access_token: 'access', refresh_token: 'refresh', expires_in: 86400, refresh_expires_in: 864000, scope: 'user.info.basic,video.publish' });
  };
  const token = await api.exchangeCodeForTikTokTokens('code', redirectUri, 'verifier');
  assert.equal(calls, 1);assert.equal(token.scope, 'user.info.basic,video.publish');
});
test('development callback retains the configured development origin', () => {
  process.env.NODE_ENV = 'development';
  assert.equal(load('lib/tiktokOAuthConfig.ts', { '@/lib/url': { appUrl: () => 'http://localhost:3000' } }).tikTokRedirectUri(), 'http://localhost:3000/api/calendars/tiktok/callback');
});
function reporting() {
  return load('lib/reporting/adapters/tiktok.ts', { '@/lib/db': {}, '@/lib/tiktokConnection': {} }).tiktokReportingAdapter;
}
test('production publishing-only grant does not call analytics APIs or invent zero counters', async () => {
  global.fetch = async () => { throw Error('No analytics API call should be made'); };
  const api = reporting();const connection = { accessToken: 'token', tokenScopes: 'user.info.basic,video.publish' };
  const metrics = await api.fetchAccountMetrics(connection);
  assert.equal(metrics.followers, null);assert.equal(metrics.views, null);assert.deepEqual(metrics.accountPosts, []);
  assert.equal(metrics.additionalMetrics.reportedVideos, undefined);
  assert.match(metrics.reportingWarnings[0], /user.info.stats, video.list/);
  assert.equal((await api.fetchPostMetrics(connection, [{id:'post',platformPostId:'video'}])).size, 0);
});
test('existing analytics grants retain their supported metrics independently', async () => {
  for (const scope of ['user.info.stats', 'video.list', 'user.info.stats,video.list']) {
    const calls = [];
    global.fetch = async input => {
      calls.push(input);
      return Response.json({ error: { code: 'ok' }, data: input.includes('/user/info/') ? { user: { follower_count: 12 } } : {
        videos: [{ id: 'video', create_time: 1780000000, view_count: 40, like_count: 3, comment_count: 1, share_count: 2 }], has_more: false,
      } });
    };
    const metrics = await reporting().fetchAccountMetrics({ accessToken: 'token', tokenScopes: scope });
    assert.equal(calls.some(url => url.includes('/user/info/')), scope.includes('user.info.stats'));
    assert.equal(calls.some(url => url.includes('/video/list/')), scope.includes('video.list'));
    assert.equal(metrics.followers, scope.includes('user.info.stats') ? 12 : null);
    assert.equal(metrics.accountPosts.length, scope.includes('video.list') ? 1 : 0);
  }
});
test('callback stages the account and only explicit confirmation saves it', async () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'test-only-selection-secret';
  const { NextRequest } = require('next/server');
  const saved = [], schedules = [];
  let actor = 'creator';
  const db = {
    socialCalendar: {
      findUnique: async () => ({ id: 'calendar', tikTokConnectedAt: null }),
      updateMany: async input => { saved.push(input); return { count: 1 }; },
    },
    calendarPost: { updateMany: async input => schedules.push(input) },
  };
  const mocks = {
    '@/lib/publishing/applicationBoundary': { publishingIntegrationInstalled: () => false },
    '@/lib/auth': { getCurrentCreator: async () => ({ id: actor }) },
    '@/lib/calendarPermissions': { hasCalendarPermission: async () => true },
    '@/lib/channelOAuthState': { verifyChannelOAuthState: () => 'calendar', channelOAuthCookieOptions: () => ({ path: '/api/calendars/tiktok/callback', httpOnly: true, maxAge: 0 }) },
    '@/lib/tiktokOAuthPkce': { readTikTokVerifier: () => 'verifier', TIKTOK_PKCE_COOKIE: 'showwork_tiktok_pkce' },
    '@/lib/url': { appUrl: () => 'https://www.useshowwork.com' },
    '@/lib/db': { db },
    '@/lib/socialReporting': { upsertSocialConnection: async (input, _db, beforeUpsert) => { await beforeUpsert(db); saved.push(input); } },
    '@/lib/tiktok': {
      exchangeCodeForTikTokTokens: async (code, redirect, verifier) => {
        assert.equal(redirect, approved); assert.equal(verifier, 'verifier'); assert.equal(code, 'code');
        return { open_id: 'account', access_token: 'private-token', refresh_token: 'private-refresh', expires_in: 86400, refresh_expires_in: 864000, scope: 'user.info.basic,video.publish' };
      },
      getTikTokAccountProfile: async () => ({ displayName: 'Test creator', avatarUrl: 'https://example.test/avatar.png' }),
    },
  };
  const callback = load('app/api/calendars/tiktok/callback/route.ts', mocks);
  const selection = load('app/api/calendars/[id]/tiktok/select-account/route.ts', mocks);
  const context = { params: Promise.resolve({ id: 'calendar' }) };
  const start = async () => {
    const result = await callback.GET(new NextRequest(approved+'?code=code&state=signed'));
    const attempt = new URL(result.headers.get('location')).searchParams.get('tiktokSelection');
    const cookie = result.cookies.get('showwork_tiktok_account_selection');
    assert.ok(attempt);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.path, '/api/calendars/calendar/tiktok/select-account');
    assert.doesNotMatch(cookie.value, /private-token|private-refresh/);
    assert.equal(result.cookies.get('showwork_tiktok_pkce').maxAge, 0);
    assert.equal(saved.length, 0);
    return { attempt, cookie: cookie.name+'='+cookie.value };
  };
  const endpoint = 'https://www.useshowwork.com/api/calendars/calendar/tiktok/select-account';
  const post = (pending, action, origin = 'https://www.useshowwork.com') => selection.POST(
    new NextRequest(endpoint, { method: 'POST', headers: { cookie: pending.cookie, origin }, body: JSON.stringify({ attempt: pending.attempt, action }) }), context,
  );
  const first = await start();
  const preview = await selection.GET(new NextRequest(endpoint+'?attempt='+first.attempt, { headers: { cookie: first.cookie } }), context);
  assert.deepEqual(await preview.json(), { displayName: 'Test creator', avatarUrl: 'https://example.test/avatar.png' });
  assert.equal((await post(first, 'confirm', 'https://other.example')).status, 403);
  actor = 'another-creator';
  assert.equal((await post(first, 'confirm')).status, 409);
  actor = 'creator';
  assert.equal(saved.length, 0);
  const cancelled = await post(first, 'cancel');
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.cookies.get('showwork_tiktok_account_selection').maxAge, 0);
  const second = await start();
  assert.equal((await post({ ...second, attempt: first.attempt }, 'confirm')).status, 409);
  assert.equal((await post(second, 'confirm')).status, 200);
  assert.equal(saved[1].tokenScopes, 'user.info.basic,video.publish');
  assert.equal(schedules[0].where.tikTokPublishStatus, 'SCHEDULED');
  assert.deepEqual(schedules[0].where.tikTokConsentAccountId, { not: 'account' });
});
test('approved TikTok analytics maps real response fields into account, video and linked-post metrics', async () => {
  const calls=[];
  const video={id:'video',create_time:Math.floor(Date.now()/1000),view_count:120,like_count:8,comment_count:2,share_count:3,video_description:'Native video',share_url:'https://www.tiktok.com/@test/video/1'};
  global.fetch=async (url,init)=>{
    calls.push({url,init});assert.equal(init.headers.Authorization,'Bearer token');
    return Response.json({error:{code:'ok'},data:url.includes('/user/info/')?{user:{follower_count:100,following_count:12,likes_count:500,video_count:4}}:{videos:[video],has_more:false}});
  };
  const api=reporting(),connection={accessToken:'token',tokenScopes:'user.info.basic,user.info.stats,video.list,video.publish'};
  const account=await api.fetchAccountMetrics(connection);
  assert.equal(account.followers,100);assert.equal(account.additionalMetrics.totalLikes,500);
  assert.equal(account.accountPosts[0].views,120);assert.equal(account.accountPosts[0].engagement,13);
  assert.equal(account.views,null); // Lifetime video totals are not daily account activity.
  const posts=await api.fetchPostMetrics(connection,[{id:'internal',platformPostId:'video'}]);
  assert.equal(posts.get('internal').shares,3);assert.equal(posts.get('internal').engagementRate,13/120);
  assert.deepEqual(JSON.parse(calls.find(c=>c.url.includes('/video/query/')).init.body),{filters:{video_ids:['video']}});
});
test('TikTok video discovery follows cursors and does not fabricate unavailable metrics', async () => {
 let calls=0;
 global.fetch=async (_url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.cursor,calls===1?undefined:123);return Response.json({error:{code:'ok'},data:{videos:[{id:String(calls),create_time:Math.floor(Date.now()/1000)}],has_more:calls===1,cursor:123}});};
 const result=await reporting().fetchAccountMetrics({accessToken:'token',tokenScopes:'video.list'});
 assert.equal(calls,2);assert.equal(result.accountPosts.length,2);assert.equal(result.accountPosts[0].engagement,null);assert.equal(result.followers,null);
});
test('TikTok analytics reports expired credentials and rate limits without inventing results',async()=>{
 for(const [code,status,pattern] of [['access_token_invalid',401,/expired/],['scope_not_authorized',403,/permission is missing/],['rate_limit_exceeded',429,/rate limit/]]) {
  global.fetch=async()=>Response.json({error:{code}},{status});
  await assert.rejects(reporting().fetchAccountMetrics({accessToken:'token',tokenScopes:'user.info.stats'}),pattern);
 }
});
test('analytics permission status uses the stored grant, is workspace scoped and excludes credentials',async()=>{
 const route=load('app/api/calendars/[id]/tiktok/analytics-access/route.ts',{
  '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},
  '@/lib/db':{db:{socialConnection:{findFirst:async input=>{assert.equal(input.where.calendarId,'workspace');assert.deepEqual(input.select,{tokenScopes:true});return {tokenScopes:'user.info.basic,video.publish'};}}}},
 });
 const response=await route.GET(null,{params:Promise.resolve({id:'workspace'})});const data=await response.json();
 assert.equal(data.analyticsGranted,false);assert.deepEqual(data.missingScopes,['user.info.stats','video.list']);assert.equal(data.accessToken,undefined);
});
test('TikTok dashboard comparison uses lifetime video counts and current follower snapshots',()=>{
 const {compareAccounts}=load('lib/reporting/comparison.ts');
 const result=compareAccounts([{id:'connection',platform:'TIKTOK',status:'CONNECTED',accountMetricSnapshots:[{snapshotDate:'2026-10-22',followers:100,reach:null,views:null,engagement:null}],accountPosts:[{publishedAt:'2026-10-21',views:120,likes:8,engagement:13,reach:null}]}],new Date('2026-10-01'),new Date('2026-10-23'),new Date('2026-09-08'));
 assert.equal(result.followers.value,100);assert.equal(result.views.value,120);assert.equal(result.engagement.value,13);assert.equal(result.reach.value,null);assert.match(result.views.basis,/lifetime totals/);
});
