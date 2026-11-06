const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const boundary={publishingIntegrationInstalled:()=>false};
function settings({creator={id:'owner'},allowed=true}={}) {
 let enabled=true;
 const route=load('app/api/calendars/[id]/publishing-settings/route.ts',{
  '@/lib/auth':{getCurrentCreator:async()=>creator},
  '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},
  '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({autoPublishEnabled:enabled}),updateMany:async({data})=>{enabled=data.autoPublishEnabled;return {count:1};}}}},
 });
 const context={params:Promise.resolve({id:'workspace'})};
 const request=(value,origin='https://useshowwork.com')=>({headers:new Headers({origin}),nextUrl:new URL('https://useshowwork.com/api'),json:async()=>({autoPublishEnabled:value})});
 return {route,context,request,value:()=>enabled};
}
test('authorized owner can persist off and on without changing approval records',async()=>{
 const h=settings();
 assert.equal((await (await h.route.GET(null,h.context)).json()).autoPublishEnabled,true);
 for(const value of [false,true]) {
  assert.equal((await h.route.PATCH(h.request(value),h.context)).status,200);
  assert.equal((await (await h.route.GET(null,h.context)).json()).autoPublishEnabled,value);
 }
});
test('publishing settings reject unauthenticated, unauthorized, cross-origin and malformed changes',async()=>{
 for(const [options,value,origin,status] of [[{creator:null},false,undefined,401],[{allowed:false},false,undefined,403],[{},false,'https://elsewhere.example',403],[{},'false',undefined,400]]) {
  const h=settings(options);assert.equal((await h.route.PATCH(h.request(value,origin),h.context)).status,status);assert.equal(h.value(),true);
 }
});
function workerFixture(platform,accepted=false) {
 let enabled=false,status='PUBLISHING',started=false,published=0;
 const post={id:'post',calendarId:'calendar',platform,assets:[],caption:'test'};
 const api=load('lib/publishing/worker.ts',{
  '@/lib/publishing/applicationBoundary':boundary,
  '@/lib/db':{db:{calendarPost:{
   updateMany:async({where,data})=>{
    const matches= !started && (where.calendar ? enabled===where.calendar.autoPublishEnabled && (!('tikTokPublishId' in where)||!accepted) : status==='PUBLISHING' && (enabled || platform==='TIKTOK'&&accepted));
    if(!matches)return {count:0};
    if(data.publishWorkerStartedAt)started=true;
    status=data.tikTokPublishStatus||data.instagramPublishStatus||data.publishStatus||status;return {count:1};
   },findUniqueOrThrow:async()=>({...post,tikTokPublishStatus:status,instagramPublishStatus:status,publishStatus:status})}}},
  '@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},
  '@/lib/instagramPublishing':{publishPostToInstagram:async()=>{published++;status='PUBLISHED';}},
  '@/lib/tiktokPublishing':{publishPostToTikTok:async()=>{published++;status='PUBLISHED';}},
  '@/lib/socialReporting':{},'@/lib/socialTokens':{},'./providers':{},
  './state':{PUBLISHING_PLATFORMS:['INSTAGRAM','TIKTOK'],statusWhere:()=>({}),statusUpdate:(p,s)=>p==='TIKTOK'?{tikTokPublishStatus:s}:{instagramPublishStatus:s},validatePublishContent:()=>{},buildCaption:()=>'',publishingStatus:()=>status},
 });
 return {run:()=>api.runPublishJob('post',platform,new Date()),state:()=>({status,started,published})};
}
test('a disabled workspace returns an unsent dispatch to its schedule without invoking a provider',async()=>{
 for(const platform of ['INSTAGRAM','TIKTOK']){const h=workerFixture(platform);await h.run();assert.deepEqual(h.state(),{status:'SCHEDULED',started:false,published:0});}
});
test('turning off automation still allows reconciliation of an already accepted TikTok delivery',async()=>{
 const h=workerFixture('TIKTOK',true);await h.run();assert.equal(h.state().published,1);
});
test('client approval schedules connected posts only while automation is enabled and preserves TikTok consent flow',async()=>{
 for(const [enabled,platform,expected] of [[true,'INSTAGRAM','SCHEDULED'],[false,'INSTAGRAM','NOT_SCHEDULED'],[true,'TIKTOK','NOT_SCHEDULED']]) {
  const field=platform==='TIKTOK'?'tikTokPublishStatus':'instagramPublishStatus';
  let post={id:'post',calendarId:'calendar',platform,isAiDraft:false,internalReviewStatus:'APPROVED',approvalStatus:'PENDING',updatedAt:new Date(),[field]:'NOT_SCHEDULED',assets:[{fileKey:'asset',sizeBytes:1}]};
  const route=load('app/api/social-calendar/[slug]/posts/[postId]/review/route.ts',{
   '@/lib/publishing/applicationBoundary':boundary,
   '@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},
   '@/lib/auth':{verifyViewerToken:()=>({id:'viewer'})},
   '@/lib/resend':{sendCalendarPostReviewedEmail:async()=>{}},'@/lib/r2':{publicUrlFor:()=>'/asset'},
   '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({id:'calendar',autoPublishEnabled:enabled,manager:{email:'owner@example.test'},collaborators:[]})},socialConnection:{findFirst:async()=>({id:'connection'})},calendarPost:{findUnique:async()=>post,updateMany:async({data})=>{post={...post,...data};return {count:1};},findUniqueOrThrow:async()=>post}}},
   '@/lib/publishing/state':{PUBLISHING_PLATFORMS:['INSTAGRAM','TIKTOK'],publishingStatus:p=>p[field],statusWhere:()=>({}),statusUpdate:(_p,s)=>({[field]:s}),buildCaption:()=>'',validatePublishContent:()=>{}},
  });
  const response=await route.POST({cookies:{get:()=>({value:'viewer'})},json:async()=>({action:'approve'})},{params:Promise.resolve({slug:'calendar',postId:'post'})});
  assert.equal(response.status,200);assert.equal(post.approvalStatus,'APPROVED');assert.equal(post[field],expected);
 }
});
