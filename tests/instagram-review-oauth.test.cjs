const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');
const { NextRequest } = require('next/server');
const originalEnv = { ...process.env };
afterEach(() => {
  for (const key of ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'INSTAGRAM_REQUEST_INSIGHTS_SCOPE', 'INSTAGRAM_INSIGHTS_REVIEW_CREATOR_IDS', 'JWT_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
});
function oauth() {
  process.env.INSTAGRAM_APP_ID = 'review-app'; process.env.INSTAGRAM_APP_SECRET = 'test-secret';
  return load('lib/instagram.ts', { '@/lib/publishing/applicationBoundary': {}, '@/lib/publishing/executionContext': { publishingFetch: global.fetch } });
}
test('Insights is restricted to allowlisted reviewers until globally enabled; existing scopes remain', () => {
  process.env.INSTAGRAM_REQUEST_INSIGHTS_SCOPE = 'false'; process.env.INSTAGRAM_INSIGHTS_REVIEW_CREATOR_IDS = 'reviewer';
  const { buildInstagramAuthUrl } = oauth();
  for (const creatorId of ['reviewer', 'ordinary', undefined]) {
    const url = new URL(buildInstagramAuthUrl({ redirectUri: 'https://showwork.test/callback', state: 'signed-state', creatorId }));
    const scopes = url.searchParams.get('scope').split(',');
    assert.equal(scopes.includes('instagram_manage_insights'), creatorId === 'reviewer');
    for (const required of ['instagram_basic','instagram_content_publish','instagram_manage_messages','pages_read_engagement','pages_show_list','pages_manage_metadata']) assert.ok(scopes.includes(required));
    assert.equal(url.searchParams.get('auth_type'), 'rerequest');
    assert.equal(url.searchParams.get('state'), 'signed-state');
  }
});
test('approved global scope flag includes Insights without a reviewer allowlist', () => {
  process.env.INSTAGRAM_REQUEST_INSIGHTS_SCOPE = 'true';
  assert.match(new URL(oauth().buildInstagramAuthUrl({redirectUri:'https://test/callback',state:'s'})).searchParams.get('scope'), /instagram_manage_insights/);
});
function picker({ actor = 'reviewer', allowed = true } = {}) {
  process.env.JWT_SECRET = 'test-selection-secret';
  const selections = load('lib/facebookPageSelection.ts');
  const session = selections.createFacebookPageSelection({ calendarId:'workspace', pages:[{id:'reviewer',name:'selection',accessToken:'secret-user-token'}],grantedPermissions:['instagram_manage_insights'],userTokenExpiresAt:Date.now()+60000 });
  const calls = [];
  const route = load('app/api/calendars/[id]/instagram/select-account/route.ts', {
    '@/lib/publishing/applicationBoundary': { publishingIntegrationInstalled:()=>false },
    '@/lib/auth': { getCurrentCreator:async()=>({id:actor}) },
    '@/lib/calendarPermissions': { hasCalendarPermission:async()=>allowed },
    '@/lib/instagram': { listInstagramGrantedPermissions:async()=>['instagram_manage_insights'], listManagedPages:async()=>[{id:'page',name:'Business Page',access_token:'secret-page-token',tasks:['MESSAGING'],instagram_business_account:{id:'ig',username:'review'}}] },
    '@/lib/instagramConnection': { completeInstagramConnection:async(...args)=>calls.push(args) },
  });
  const request = (method='GET', body, origin='https://showwork.test')=>new NextRequest('https://showwork.test/api/calendars/workspace/instagram/select-account', { method, headers:{cookie:`showwork_instagram_legacy_selection=${session.value}`,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}) });
  const context = {params:Promise.resolve({id:'workspace'})};
  return {route,request,context,calls};
}
test('picker exposes Page/account names and grant evidence, never tokens', async()=>{
  const p=picker();const response=await p.route.GET(p.request(),p.context);const text=await response.text();
  assert.equal(response.status,200);assert.ok(!text.includes('secret-'));assert.equal(JSON.parse(text).insightsGranted,true);assert.deepEqual(JSON.parse(text).grantedPermissions,['instagram_manage_insights']);assert.match(text,/@review/);assert.equal(p.calls.length,0);
});
test('picker rejects another creator and insufficient workspace permissions', async()=>{
  for(const config of [{actor:'other'},{allowed:false}]){const p=picker(config);const response=await p.route.GET(p.request(),p.context);assert.ok([403,409].includes(response.status));assert.equal(p.calls.length,0);}
});
test('picker only connects the selected authorized account and clears the session',async()=>{
  const p=picker();assert.equal((await p.route.POST(p.request('POST',{accountId:'foreign'}),p.context)).status,400);
  assert.equal((await p.route.POST(p.request('POST',{accountId:'ig'},'https://evil.test'),p.context)).status,403);
  const result=await p.route.POST(p.request('POST',{accountId:'ig'}),p.context);
  assert.equal(result.status,200);assert.equal(p.calls.length,1);assert.equal(p.calls[0][1].instagram_business_account.id,'ig');assert.deepEqual(p.calls[0][2],['instagram_manage_insights']);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
});
test('selected legacy account preserves publishing credentials and both messaging subscriptions', async()=>{
  const updates=[],subscriptions=[];
  const helper=load('lib/instagramConnection.ts',{
    '@/lib/db':{db:{socialCalendar:{update:async value=>updates.push(value)},socialConnection:{update:async value=>updates.push(value)}}},
    '@/lib/instagram':{getInstagramUsername:async()=> 'review'},
    '@/lib/socialReporting':{upsertSocialConnection:async value=>{updates.push(value);return {id:'connection'};}},
    '@/lib/socialMessaging/meta':{subscribeMetaMessagingAccount:async(...args)=>subscriptions.push(args)},
  });
  await helper.completeInstagramConnection('workspace',{id:'page',name:'Page',access_token:'page-token',tasks:['MESSAGING'],instagram_business_account:{id:'ig'}},['instagram_basic','instagram_manage_insights'],new Date('2027-01-01'));
  assert.equal(updates[0].data.instagramAccountId,'ig');assert.equal(updates[0].data.instagramAccessToken,'page-token');
  assert.equal(updates[1].tokenScopes,'instagram_basic,instagram_manage_insights');
  assert.deepEqual(subscriptions,[['page','page-token','INSTAGRAM'],['ig','page-token','INSTAGRAM']]);
  subscriptions.length=0;
  await helper.completeInstagramConnection('workspace',{id:'page',name:'Page',access_token:'page-token',instagram_business_account:{id:'ig'}},['instagram_basic'],new Date('2027-01-01'));
  assert.deepEqual(subscriptions,[['page','page-token','INSTAGRAM'],['ig','page-token','INSTAGRAM']]);
  subscriptions.length=0;
  await helper.completeInstagramConnection('workspace',{id:'page',name:'Page',access_token:'page-token',tasks:['ANALYZE'],instagram_business_account:{id:'ig'}},['instagram_basic'],new Date('2027-01-01'));
  assert.equal(subscriptions.length,0);

});
