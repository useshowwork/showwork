const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {clientReviewLocked,clientRevisionNote}=load('lib/clientPostReview.ts');
function fixture(platform='X',status='SCHEDULED') {
 let current={id:'post',calendarId:'calendar',platform,approvalStatus:'APPROVED',internalReviewStatus:'APPROVED',approvalNote:null,caption:'A ready post',cta:null,hashtags:null,taggedAccounts:null,linkUrl:null,assets:platform==='X'?[]:[{id:'asset',fileKey:'graphic',mediaType:'PHOTO',sizeBytes:20}],updatedAt:new Date('2026-11-13T10:00:00Z'),publishStatus:'NOT_SCHEDULED',instagramPublishStatus:'NOT_SCHEDULED',tikTokPublishStatus:'NOT_SCHEDULED',tikTokConsentAt:new Date(),tikTokConsentBy:'manager',tikTokConsentHash:'hash',tikTokConsentAccountId:'account',tikTokConsentVersion:'1'};
 const key=platform==='INSTAGRAM'?'instagramPublishStatus':platform==='TIKTOK'?'tikTokPublishStatus':'publishStatus';current[key]=status;
 const writes=[];let race=false;
 const api=load('app/api/social-calendar/[slug]/posts/[postId]/review/route.ts',{
 '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
 '@/lib/auth':{verifyViewerToken:()=>({name:'Client'})},
 '@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},
 '@/lib/resend':{sendCalendarPostReviewedEmail:async()=>{}},
 '@/lib/r2':{publicUrlFor:key=>`https://example.com/${key}`},
 '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({id:'calendar',autoPublishEnabled:true,manager:{email:'manager@example.test'},collaborators:[],clientName:'Client'})},socialConnection:{findFirst:async()=>({id:'connection'})},calendarPost:{
 findUnique:async()=>({...current}),findUniqueOrThrow:async()=>({...current,videoComments:[],customFields:[]}),
 updateMany:async({where,data})=>{
  if(race){current[key]='PUBLISHING';return {count:0};}
  assert.equal(where[key],current[key]);assert.equal(where.updatedAt,current.updatedAt);assert.equal(where.internalReviewStatus,'APPROVED');
  writes.push(data);current={...current,...data};return {count:1};
 },
 }}},
 });
 const respond=(action,note)=>api.POST({cookies:{get:()=>({value:'viewer-token'})},json:async()=>({action,note})},{params:Promise.resolve({slug:'calendar',postId:'post'})});
 return {respond,writes,current:()=>current,race:()=>race=true,key};
}
test('client can withdraw approval on every scheduled platform and preserve their feedback',async()=>{
 for(const platform of ['INSTAGRAM','TIKTOK','X']){
  const h=fixture(platform);const response=await h.respond('request_revision',' Please update this graphic ');
  assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.post.approvalStatus,'NEEDS_REVISION');assert.equal(data.post[h.key],'NOT_SCHEDULED');assert.equal(data.post.approvalNote,'Please update this graphic');
  assert.equal(data.post.internalReviewNote,undefined);
  if(platform==='TIKTOK')for(const key of ['tikTokConsentAt','tikTokConsentBy','tikTokConsentHash','tikTokConsentAccountId','tikTokConsentVersion'])assert.equal(h.current()[key],null);
 }
});
test('a later client approval clears feedback and restores scheduling when auto-publishing is enabled',async()=>{
 const h=fixture();await h.respond('request_revision','Change the copy');
 assert.equal(h.current().approvalStatus,'NEEDS_REVISION');assert.equal(h.current().publishStatus,'NOT_SCHEDULED');
 const response=await h.respond('approve');assert.equal(response.status,200);
 assert.equal(h.current().approvalStatus,'APPROVED');assert.equal(h.current().approvalNote,null);assert.equal(h.current().publishStatus,'SCHEDULED');
});
test('withdrawal cannot claim to cancel an in-flight or published post',async()=>{
 for(const status of ['PUBLISHING','PUBLISHED']){
  const h=fixture('X',status);assert.equal((await h.respond('request_revision','Change it')).status,409);assert.equal(h.writes.length,0);
 }
 const raced=fixture();raced.race();assert.equal((await raced.respond('request_revision','Change it')).status,409);assert.equal(raced.writes.length,0);
});
test('blank and excessive feedback cannot silently withdraw approval',async()=>{
 for(const note of [undefined,' ',{},'x'.repeat(4001)]){
  const h=fixture();assert.equal((await h.respond('request_revision',note)).status,400);assert.equal(h.writes.length,0);
 }
 assert.equal(clientRevisionNote(' Please update '),'Please update');
});
test('scheduled posts remain editable while publishing and published posts are locked',()=>{
 assert.equal(clientReviewLocked({publishStatus:'SCHEDULED'}),false);
 for(const key of ['publishStatus','instagramPublishStatus','tikTokPublishStatus'])for(const status of ['PUBLISHING','PUBLISHED'])assert.equal(clientReviewLocked({[key]:status}),true);
});
test('canonical withdrawal clears approval, scheduled statuses and consent without gaining scheduling authority',async()=>{
 const queries=[];const p={id:'post',calendarId:'calendar',approvalStatus:'APPROVED'};
 const tx={query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT * FROM "CalendarPost"'))return {rows:[p]};
  if(sql.startsWith('SELECT to_jsonb'))return {rows:[{present:true}]};
  return {rows:[]};
 }};
 const {createCanonicalApplicationActions}=load('lib/publishing/applicationActions.ts',{'./validationAdapters':{createPublishingValidationAdapters:()=>({lockForPolicyChange:async()=>{},validateViewerApproval:async()=>({principalId:'viewer'})})}});
 const actions=createCanonicalApplicationActions({database:{transaction:fn=>fn(tx)},policy:{}});
 const result=await actions.review({operationId:'withdraw',calendarId:'calendar',postId:'post',credential:'viewer',approved:false,note:'Please revise'});
 assert.equal(result.approvalStatus,'NEEDS_REVISION');assert.equal(result.maySend,false);
 assert.ok(queries.some(q=>q.sql.includes('"approvalStatus"=$2')&&q.args[1]==='NEEDS_REVISION'));
 const reset=queries.find(q=>q.sql.includes('"publishStatus"=CASE'));
 for(const key of ['publishStatus','instagramPublishStatus','tikTokPublishStatus','tikTokConsentBy','tikTokConsentAccountId','tikTokConsentVersion'])assert.ok(reset.sql.includes(`"${key}"`));
 assert.ok(queries.some(q=>q.sql.includes('"approvalNote"=$2')&&q.args[1]==='Please revise'));
 assert.equal(queries.some(q=>q.sql.startsWith('INSERT INTO "PublishingJob"')),false);
});

test('approved client posts expose Request changes and paused posts expose Approve again',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const View=load('components/calendars/ClientCalendarView.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})}}).default;
 const render=extra=>renderToStaticMarkup(React.createElement(View,{slug:'calendar',clientName:'Client',planStatus:'PLAN_APPROVED',initialPostId:'post',posts:[{id:'post',postDate:'2026-11-13T10:00:00Z',platform:'X',postType:'Text',approvalStatus:'APPROVED',approvalNote:null,caption:'A ready post',assets:[],videoComments:[],customFields:[],publishStatus:'SCHEDULED',...extra}]}));
 const approved=render({});assert.match(approved,/Request changes/);assert.match(approved,/Changed your mind/);assert.doesNotMatch(approved,/Approve again/);
 const paused=render({approvalStatus:'NEEDS_REVISION',approvalNote:'Change the copy',publishStatus:'NOT_SCHEDULED'});assert.match(paused,/Approve again/);assert.match(paused,/Publishing is paused/);
 const publishing=render({publishStatus:'PUBLISHING'});assert.match(publishing,/Publishing has started/);assert.doesNotMatch(publishing,/>Request changes</);
});
