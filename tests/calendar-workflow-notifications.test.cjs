const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {calendarWorkflow}=load('lib/calendarWorkflow.ts');
test('workflow labels follow internal review before client review and distinguish scheduled from approval',()=>{
 const post={approvalStatus:'PENDING',internalReviewStatus:'PENDING'};
 assert.equal(calendarWorkflow(post).label,'Pending internal review');
 assert.equal(calendarWorkflow({...post,internalReviewStatus:'NEEDS_CHANGES'}).stage,1);
 assert.equal(calendarWorkflow({...post,internalReviewStatus:'APPROVED'}).label,'Awaiting client review');
 const approved={...post,internalReviewStatus:'APPROVED',approvalStatus:'APPROVED'};
 assert.equal(calendarWorkflow(approved).label,'Ready to publish');
 assert.equal(calendarWorkflow({...approved,publishStatus:'SCHEDULED'}).label,'Scheduled');
 assert.equal(calendarWorkflow({...approved,tikTokPublishStatus:'PUBLISHED'}).stage,4);
 assert.equal(calendarWorkflow({...approved,publishStatus:'FAILED'}).label,'Publishing needs attention');
 assert.equal(calendarWorkflow({...post,isAiDraft:true}).label,'Draft');
});
test('recipients include owner, managers and creative roles, deduplicate and respect restricted access',()=>{
 const {workflowRecipients}=load('lib/calendarReviewNotifications.ts');
 const row=(role,email,extra={})=>({role,email,owner:false,permissions:[],customPermissions:false,...extra});
 assert.deepEqual(workflowRecipients([
  row('INBOX_AGENT','reviewer@example.test',{customPermissions:true,permissions:['calendar.view','internal_review.manage']}),row('OWNER','Owner@example.test',{owner:true}),row('MANAGER','manager@example.test'),row('SOCIAL_MEDIA_MANAGER','social@example.test'),row('CREATIVE_CONTRIBUTOR','designer@example.test'),row('ADD_CONTENT','designer@example.test'),row('EDIT_CALENDAR','legacy@example.test'),row('VIEWER','viewer@example.test'),row('INBOX_AGENT','inbox@example.test'),row('MANAGER','restricted@example.test',{customPermissions:true,permissions:['calendar.view']}),
 ]),['reviewer@example.test','owner@example.test','manager@example.test','social@example.test','designer@example.test','legacy@example.test']);
});
test('notifications retry per recipient after commit and report failures without undoing the review',async()=>{
 const calls=[];let retry=0;
 const {notifyInternalReview}=load('lib/calendarReviewNotifications.ts',{'@/lib/resend':{sendInternalReviewEmail:async input=>{calls.push(input);if(input.to==='retry@example.test'&&retry++===0)throw Error('temporary');}}});
 const event={calendarId:'workspace',postId:'post',version:7,action:'feedback',note:'Private feedback'};
 const query=async(sql,args)=>{assert.deepEqual(args,['workspace']);assert.match(sql,/isDeactivated/);return {rows:['owner','retry'].map(name=>({owner:true,email:name+'@example.test'}))};};
 assert.deepEqual(await notifyInternalReview(event,query),{sent:2,failed:0});assert.equal(calls.length,3);assert(calls.every(call=>call.version===7&&call.note==='Private feedback'));
 assert.deepEqual(await notifyInternalReview(event,async()=>{throw Error('offline')}),{sent:0,failed:1});
});
test('email escapes private feedback, links to exact post and uses stable recipient-specific idempotency',async()=>{
 const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='test-only';const calls=[];
 try {
  const {sendInternalReviewEmail}=load('lib/resend.ts',{'@/lib/publishing/nativeApplicationContext':{nativeApplicationContext:()=>undefined}});
  const transport=async(payload,key)=>{calls.push({payload,key});return {data:{id:'test'},error:null};};
  const input={to:'designer@example.test',calendarId:'workspace',postId:'post',version:2,action:'request_changes',note:'<script>private</script>'};
  await sendInternalReviewEmail(input,transport);await sendInternalReviewEmail(input,transport);await sendInternalReviewEmail({...input,to:'owner@example.test'},transport);
  assert.equal(calls[0].key,calls[1].key);assert.notEqual(calls[0].key,calls[2].key);assert(calls[0].key.length<256);assert.match(calls[0].payload.html,/&lt;script&gt;/);assert.match(calls[0].payload.html,/post=post/);assert.equal(calls[0].payload.to,'designer@example.test');
 } finally {if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
});
test('feedback requires a note and preserves approval state rather than granting approval',()=>{
 const {internalReviewInput}=load('lib/calendarInternalReview.ts');assert.throws(()=>internalReviewInput({action:'feedback',version:0,note:''}));assert.equal(internalReviewInput({action:'feedback',version:0,note:'Please check the typography'}).status,undefined);
});
test('legacy API requires explicit internal review access for feedback and approval and sends only after commit',async()=>{
 for(const [role,action,expected] of [['designer','feedback',403],['designer','approve',403],['manager','approve',200],['manager','feedback',200],['reviewer','feedback',200],['reviewer','approve',200]]) {
  let committed=false,notifications=0;const current={id:'post',calendarId:'workspace',approvalStatus:'PENDING',internalReviewStatus:'PENDING',internalReviewVersion:0,internalReviewedBy:'original-reviewer',internalReviewedAt:'2026-10-24T00:00:00Z',assets:[],videoComments:[],customFields:[]};
  const {POST}=load('app/api/calendars/[id]/posts/[postId]/internal-review/route.ts',{
   '@/lib/auth':{getCurrentCreator:async()=>({id:role})},'@/lib/calendarPermissions':{hasCalendarPermission:async(_actor,_calendar,permission)=>permission==='internal_review.manage' && (role==='manager'||role==='reviewer')},
   '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},'@/lib/r2':{publicUrlFor:()=>''},
   '@/lib/calendarReviewNotifications':{notifyInternalReview:async event=>{assert(committed);notifications++;assert.equal(event.version,1);return {sent:3,failed:0};}},
   '@/lib/db':{db:{$transaction:async fn=>{const result=await fn({$queryRaw:async()=>[],calendarPost:{findFirst:async()=>current,update:async({data})=>({...current,...data,internalReviewVersion:1})}});committed=true;return result;}}},
  });
  const result=await POST(new Request('https://example.test/review',{method:'POST',body:JSON.stringify({action,version:0,note:'Feedback'})}),{params:Promise.resolve({id:'workspace',postId:'post'})});
  assert.equal(result.status,expected);assert.equal(notifications,expected===200?1:0);
  if(expected===200){const body=await result.json();assert.equal(body.post.internalReviewStatus,action==='approve'?'APPROVED':'PENDING');assert.equal(body.notifications.sent,3);if(action==='feedback'){assert.equal(body.post.internalReviewedBy,'original-reviewer');assert.equal(body.post.internalReviewedAt,'2026-10-24T00:00:00Z');}}
 }
});

test('calendar and upload notices reach the whole team with timeline, count, creative readiness and uploader', async () => {
 const sent=[];
 const {notifyCalendarWorkflow}=load('lib/calendarWorkflowEmails.ts', {
  '@/lib/resend':{sendWorkspaceWorkflowEmail:async message=>{sent.push(message);}},
 });
 const query=async(sql,args)=>{
  if(sql.includes('CalendarCollaborator')){
   assert.deepEqual(args,['workspace']);
   assert.match(sql,/NOT c\."isDeactivated"/);
   return {rows:['Owner@example.test','creative@example.test','owner@example.test'].map(email=>({email,clientName:'Test brand'}))};
  }
  if(sql.includes('SELECT id, platform')){
   assert.deepEqual(args,['workspace',['post']]);
   return {rows:[{id:'post',platform:'FACEBOOK',postDate:'2025-11-03T12:00:00Z'}]};
  }
  if(sql.includes('CalendarPost')){
   assert.deepEqual(args,['workspace',['a','b'],'Africa/Lagos']);
   return {rows:[{start:'2026-11-01',end:'2026-11-30',briefed:2}]};
  }
  assert.deepEqual(args,['creator']);
  return {rows:[{name:'Tomi',email:'creative@example.test'}]};
 };
 const event={kind:'imported',calendarId:'workspace',key:'import-1',postIds:['a','b'],timeZone:'Africa/Lagos'};
 await notifyCalendarWorkflow(event,query);
 assert.deepEqual(sent.map(email=>email.to),['owner@example.test','creative@example.test']);
 assert.deepEqual(sent[0].details.map(([label,value])=>[label,value.replace(/\s*–\s*/g,'–')]),[['Workspace','Test brand'],['Calendar timeline','1–30 November 2026'],['Content planned','2 posts']]);
 assert.match(sent[0].message,/begin work/);
 sent.length=0;
 await notifyCalendarWorkflow({...event,postIds:[]},()=>assert.fail('Empty imports should not send email'));
 assert.equal(sent.length,0);
 await notifyCalendarWorkflow({kind:'uploaded',calendarId:'workspace',key:'batch-1',postId:'post',actorId:'creator'},query);
 assert.equal(sent.length,2);
 assert.deepEqual(sent[0].details.at(-1),['Uploaded by','Tomi (creative@example.test)']);
 assert.deepEqual(sent[0].details[1],['Facebook','Monday, November 3, 2025']);
 assert.equal(sent[0].postId,'post');
 assert.match(sent[0].title,/ready for internal review/);
});

test('one upload batch email lists each successful post with its platform and scheduled local date', async () => {
 const sent=[];
 const {notifyCalendarWorkflow}=load('lib/calendarWorkflowEmails.ts', {
  '@/lib/resend':{sendWorkspaceWorkflowEmail:async message=>{sent.push(message);}},
 });
 const read=async(sql,args)=>{
  if(sql.includes('CalendarCollaborator'))return {rows:[{email:'owner@example.test',clientName:'Brand'}]};
  if(sql.includes('SELECT id, platform')) {
   assert.deepEqual(args,['workspace',['facebook','instagram','tiktok']]);
   return {rows:[
    {id:'facebook',platform:'FACEBOOK',postDate:'2025-11-02T23:30:00Z'},
    {id:'instagram',platform:'INSTAGRAM',postDate:'2025-11-03T09:00:00Z'},
    {id:'tiktok',platform:'TIKTOK',postDate:'2025-11-05T09:00:00Z'},
   ]};
  }
  return {rows:[{name:'Tomi',email:'tomi@example.test'}]};
 };
 await notifyCalendarWorkflow({
  kind:'uploaded',calendarId:'workspace',key:'batch',actorId:'creator',
  uploadPostIds:['facebook','instagram','tiktok'],timeZone:'Africa/Lagos',
 },read);
 assert.equal(sent.length,1);
 assert.equal(sent[0].postId,undefined);
 assert.deepEqual(sent[0].details.slice(1),[
  ['Facebook','Monday, November 3, 2025'],
  ['Instagram','Monday, November 3, 2025'],
  ['TikTok','Wednesday, November 5, 2025'],
  ['Uploaded by','Tomi (tomi@example.test)'],
 ]);
});

test('upload receipts scope the completed posts to the uploader, workspace and batch', () => {
 const {uploadNoticeReceipt,verifiedUploadNoticePosts}=load('lib/calendarUploadNotice.ts');
 const previous=process.env.JWT_SECRET;
 process.env.JWT_SECRET='upload-notice-test';
 try {
  const receipt=uploadNoticeReceipt('workspace','uploader','batch','post');
  assert.deepEqual(verifiedUploadNoticePosts('workspace','uploader','batch',[receipt,receipt]),['post']);
  assert.equal(verifiedUploadNoticePosts('workspace','other','batch',[receipt]),null);
  assert.equal(verifiedUploadNoticePosts('other','uploader','batch',[receipt]),null);
  assert.equal(verifiedUploadNoticePosts('workspace','uploader','another-batch',[receipt]),null);
  assert.equal(verifiedUploadNoticePosts('workspace','uploader','batch',[{...receipt,postId:'other-post'}]),null);
 } finally {
  if(previous===undefined)delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET=previous;
 }
});

test('batch submission waits for recorded posts and makes a single notification request', async () => {
 const calls=[];
 const {calendarUploadBatch}=load('lib/calendarUploadNoticeClient.ts', {
  '@/lib/publishing/clientRequests':{calendarMutationFetch:async (url,init)=>{
   calls.push({url,body:JSON.parse(init.body)});
   return {ok:true};
  }},
 });
 const batch=calendarUploadBatch('workspace');
 await batch.notify();
 assert.equal(calls.length,0);
 batch.record({postId:'facebook',proof:'first file'});
 batch.record({postId:'facebook',proof:'second file'});
 batch.record({postId:'instagram',proof:'attached'});
 batch.record(undefined);
 await batch.notify();
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/calendars/workspace/uploads/notify');
 assert.equal(calls[0].body.batchId,batch.id);
 assert.deepEqual(calls[0].body.receipts,[
  {postId:'facebook',proof:'second file'},
  {postId:'instagram',proof:'attached'},
 ]);
});
