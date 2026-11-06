const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {workspaceRemovalBlock}=load('lib/publishing/removalGuard.ts');
test('confirmed reset allows unstarted schedules; other deletion paths still require cancellation',()=>{
 for(const field of ['publishStatus','instagramPublishStatus','tikTokPublishStatus']){
  const post={[field]:'SCHEDULED'};
  assert.equal(workspaceRemovalBlock(post,true),null);
  assert.match(workspaceRemovalBlock(post),/Cancel its schedule/);
 }
});
test('reset never permits publishing in progress, even with another published status',()=>{
 for(const field of ['publishStatus','instagramPublishStatus','tikTokPublishStatus']) assert.match(workspaceRemovalBlock({publishStatus:'PUBLISHED',[field]:'PUBLISHING'},true),/publishing right now/);
});
test('worker starts and provider operation receipts keep unknown outcomes protected',()=>{
 for(const field of ['publishWorkerStartedAt','tikTokInitStartedAt','tikTokPublishId','platformPostId','instagramMediaId']){
  const value=field.endsWith('At')?new Date():'operation';
  assert.match(workspaceRemovalBlock({[field]:value,publishStatus:'SCHEDULED'},true),/unfinished publishing attempt/);
  assert.match(workspaceRemovalBlock({[field]:value,publishStatus:'FAILED'},true),/unfinished publishing attempt/);
 }
});
test('drafts and settled publications may be removed without touching the live social post',()=>{
 assert.equal(workspaceRemovalBlock({publishStatus:'NOT_SCHEDULED'},true),null);
 assert.equal(workspaceRemovalBlock({publishStatus:'PUBLISHED',platformPostId:'published'}),null);
 assert.match(workspaceRemovalBlock({publishStatus:'PUBLISHED',instagramPublishStatus:'SCHEDULED',platformPostId:'published'},true),/unfinished/);
});
