const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {canBulkApproveInternal,canBulkApproveClient,approveCalendarPosts}=load('lib/calendarBulkApproval.ts');
const post=(id,extra={})=>({id,approvalStatus:'PENDING',internalReviewStatus:'PENDING',internalReviewVersion:2,platform:'INSTAGRAM',assets:[{id:'graphic'}],...extra});
test('internal eligibility follows existing review locks and includes requested changes',()=>{
 assert.equal(canBulkApproveInternal(post('ready')),true);
 assert.equal(canBulkApproveInternal(post('changes',{internalReviewStatus:'NEEDS_CHANGES'})),true);
 assert.equal(canBulkApproveInternal(post('draft',{isAiDraft:true})),true);
 for(const extra of [{approvalStatus:'APPROVED'},{internalReviewStatus:'APPROVED'},{publishStatus:'SCHEDULED'},{instagramPublishStatus:'PUBLISHING'},{tikTokPublishStatus:'PUBLISHED'}])assert.equal(canBulkApproveInternal(post('skip',extra)),false);
});
test('client approval includes ready media and supported text posts without exposing unreviewed content',()=>{
 const ready=post('ready',{internalReviewStatus:'APPROVED'});
 assert.equal(canBulkApproveClient(ready),true);
 assert.equal(canBulkApproveClient({...ready,approvalStatus:'NEEDS_REVISION'}),true);
 for(const extra of [{internalReviewStatus:'PENDING'},{approvalStatus:'APPROVED'},{isAiDraft:true},{assets:[]},{publishStatus:'PUBLISHING'},{instagramPublishStatus:'PUBLISHED'}])assert.equal(canBulkApproveClient({...ready,...extra}),false);
 for(const platform of ['FACEBOOK','LINKEDIN','X'])assert.equal(canBulkApproveClient({...ready,platform,assets:[],caption:'A text post'}),true);
 assert.equal(canBulkApproveClient({...ready,platform:'X',assets:[],caption:' '}),false);
});
test('internal approval preserves notes, submits current versions, and reports partial failures',async()=>{
 const posts=[post('one',{internalReviewNote:'Original feedback'}),post('changed'),post('three'),post('approved',{internalReviewStatus:'APPROVED'})];
 const calls=[],updated=[],progress=[];
 const result=await approveCalendarPosts({posts,mode:'internal',calendarKey:'workspace',onUpdated:p=>updated.push(p),onProgress:(done,total)=>progress.push([done,total]),request:async(url,init)=>{
  calls.push({url,body:JSON.parse(init.body)});
  if(url.includes('/changed/'))return Response.json({error:'This post changed. Refresh and review the latest version.'},{status:409});
  const id=url.split('/').at(-2);return Response.json({post:{...posts.find(p=>p.id===id),internalReviewStatus:'APPROVED'}});
 }});
 assert.equal(result.approved,2);assert.equal(result.total,3);assert.equal(result.failures[0].id,'changed');
 assert.deepEqual(calls.find(c=>c.url.includes('/one/')).body,{action:'approve',version:2,note:'Original feedback'});
 assert.equal(updated.length,2);assert.deepEqual(progress.at(-1),[3,3]);
 assert.ok(calls.every(c=>c.url.startsWith('/api/calendars/workspace/posts/')&&c.url.endsWith('/internal-review')));
});
test('client uses authenticated post reviews, skips completed approvals, and retries only remaining posts',async()=>{
 const posts=[post('one',{internalReviewStatus:'APPROVED'}),post('done',{internalReviewStatus:'APPROVED',approvalStatus:'APPROVED'})];
 const calls=[];
 const result=await approveCalendarPosts({posts,mode:'client',calendarKey:'client-calendar',onUpdated:updated=>Object.assign(posts.find(p=>p.id===updated.id),updated),request:async(url,init)=>{calls.push(url);assert.deepEqual(JSON.parse(init.body),{action:'approve'});return Response.json({post:{...posts[0],approvalStatus:'APPROVED'}});}});
 assert.equal(result.approved,1);assert.deepEqual(calls,['/api/social-calendar/client-calendar/posts/one/review']);
 const retry=await approveCalendarPosts({posts,mode:'client',calendarKey:'client-calendar',onUpdated:()=>{},request:()=>assert.fail('already approved')});
 assert.equal(retry.total,0);
});
test('network and authorization failures do not stop other posts, and concurrency is bounded',async()=>{
 let active=0,max=0;const updated=[];
 const result=await approveCalendarPosts({posts:Array.from({length:8},(_,i)=>post(String(i))),mode:'internal',calendarKey:'workspace',onUpdated:p=>updated.push(p),request:async url=>{
  active++;max=Math.max(max,active);await new Promise(resolve=>setImmediate(resolve));active--;
  const id=url.split('/').at(-2);
  if(id==='0')throw Error('Network unavailable');
  if(id==='1')return Response.json({error:'Permission denied'},{status:403});
  return Response.json({post:post(id,{internalReviewStatus:'APPROVED'})});
 }});
 assert.equal(max,3);assert.equal(result.approved,6);assert.equal(result.failures.length,2);assert.equal(updated.length,6);
});
test('posts added after a bulk approval starts are not silently included',async()=>{
 const posts=[post('first')];const ids=[];
 await approveCalendarPosts({posts,mode:'internal',calendarKey:'workspace',onUpdated:p=>ids.push(p.id),request:async()=>{posts.push(post('added-later'));return Response.json({post:post('first',{internalReviewStatus:'APPROVED'})});}});
 assert.deepEqual(ids,['first']);
});
