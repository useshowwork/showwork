const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
function harness(extra={}) {
 let current={id:'post',calendarId:'calendar',isAiDraft:true,approvalStatus:'PENDING',internalReviewStatus:'PENDING',internalReviewVersion:2,caption:'Generated copy',...extra};
 let saved;
 const api=load('app/api/calendars/[id]/posts/[postId]/internal-review/route.ts',{
 '@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},
 '@/lib/calendarPermissions':{hasCalendarPermission:async(_actor,_calendar,permission)=>permission==='internal_review.manage'},
 '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
 '@/lib/calendarReviewNotifications':{notifyInternalReview:async()=>({sent:0,failed:0})},
 '@/lib/r2':{publicUrlFor:()=>''},
 '@/lib/db':{db:{$transaction:async fn=>fn({$queryRaw:async()=>[],calendarPost:{findFirst:async()=>current,update:async({data})=>{
   saved=data;
   // Model the real content-change trigger on draft confirmation.
   if(data.isAiDraft===false && current.isAiDraft)current={...current,isAiDraft:false,internalReviewStatus:'PENDING',internalReviewVersion:current.internalReviewVersion+1};
   current={...current,...data,internalReviewVersion:data.internalReviewVersion ? current.internalReviewVersion+1 : current.internalReviewVersion,assets:[]};return current;
 }}})}},
 });
 const request=(action='approve',version=2)=>api.POST(new Request('http://localhost/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version,note:'Reviewed together'})}),{params:Promise.resolve({id:'calendar',postId:'post'})});
 return {request,saved:()=>saved};
}
test('manager approval atomically confirms an AI draft and approves its internal review',async()=>{
 const h=harness();const response=await h.request();assert.equal(response.status,200);
 const {post}=await response.json();assert.equal(post.isAiDraft,false);assert.equal(post.internalReviewStatus,'APPROVED');
 assert.equal(post.caption,'Generated copy');assert.equal(post.approvalStatus,'PENDING');assert.equal(post.internalReviewVersion,4);
 assert.equal(h.saved().internalReviewedBy,'manager');assert.deepEqual(h.saved().internalReviewVersion,{increment:1});
});
test('stale draft approval and publishing locks cannot confirm or approve a draft',async()=>{
 for(const [extra,version] of [[{},1],[{publishStatus:'SCHEDULED'},2],[{approvalStatus:'APPROVED'},2]]){
  const h=harness(extra);const response=await h.request('approve',version);
  assert.equal(response.status,409);assert.equal(h.saved(),undefined);
 }
});
test('feedback alone does not silently confirm an unaccepted AI draft',async()=>{
 const h=harness();const response=await h.request('feedback');assert.equal(response.status,409);assert.equal(h.saved(),undefined);
});

test('canonical review confirms before approving and returns the persisted review version',async()=>{
 let current={id:'post',calendarId:'calendar',isAiDraft:true,approvalStatus:'PENDING',internalReviewStatus:'PENDING',internalReviewVersion:2};
 const writes=[],permissions=[];
 const tx={query:async(sql,args)=>{
  if(sql.startsWith('SELECT * FROM "CalendarPost"'))return {rows:[{...current}]};
  if(sql.startsWith('UPDATE "CalendarPost" SET "isAiDraft"=false')){writes.push('confirm');current={...current,isAiDraft:false,internalReviewStatus:'PENDING',internalReviewVersion:3};}
  if(sql.startsWith('UPDATE "CalendarPost" SET "internalReviewStatus"=')){writes.push('approve');current={...current,internalReviewStatus:args[1],internalReviewVersion:current.internalReviewVersion+1};return {rows:[{internalReviewVersion:current.internalReviewVersion}]};}
  return {rows:[]};
 }};
 const {createCanonicalApplicationActions}=load('lib/publishing/applicationActions.ts',{'./validationAdapters':{createPublishingValidationAdapters:()=>({validateWorkspacePermission:async(_tx,input)=>permissions.push(input.permission),lockForPolicyChange:async()=>{}})}});
 const actions=createCanonicalApplicationActions({database:{transaction:fn=>fn(tx)},policy:{}});
 const result=await actions.internalReview({operationId:'approve-draft',actor:'manager',calendarId:'calendar',postId:'post',body:{action:'approve',version:2}});
 assert.deepEqual(writes,['confirm','approve']);assert.deepEqual(permissions,['internal_review.manage','internal_review.manage']);
 assert.equal(current.isAiDraft,false);assert.equal(current.internalReviewStatus,'APPROVED');assert.equal(current.approvalStatus,'PENDING');assert.equal(result.notification.version,4);
});
