const {test}=require('node:test');const assert=require('node:assert/strict');const {NextRequest}=require('next/server');const {load}=require('./helpers/load-typescript.cjs');
const brief={version:1,format:'Reel',title:'An original idea',objective:'Educate',targetAudience:'Studio owners',coreIdea:'A specific handover situation',keyMessage:'Make responsibilities clear',creativeDirection:'Interpret the situation through a story or demonstration.',desiredResponse:'Recognise the issue',brandConnection:'Supported offering',suggestedCta:'Discuss your process',pillar:'Education'};
function fixture({permission=true,ai=true,generated='Spoken lines for the current idea',approved=false,initialBrief=brief,existingHook="Existing hook"}={}){
 let current={id:'post',calendarId:'workspace',updatedAt:new Date('2026-10-26T09:00:00Z'),postDate:new Date('2026-11-02T09:00:00Z'),platform:'INSTAGRAM',postType:'Reel',category:'Education',creativeBrief:{...initialBrief},creativeDevelopment:{},caption:'Manually edited caption',script:'Existing script',hook:existingHook,contentIdea:'Original idea',cta:null,hashtags:null,approvalStatus:approved?'APPROVED':'PENDING',isAiDraft:true};
 let modelCalls=0,reads=0,writes=0,snapshot,modelInput,charged=0;
 const tx={$queryRaw:async()=>[],calendarPost:{findFirst:async()=>current,update:async({data})=>{writes++;current={...current,...data,updatedAt:new Date('2026-10-26T09:01:00Z')};return current;}},calendarPostAiGeneration:{findFirst:async()=>({generationNumber:1}),create:async({data})=>{snapshot=data;}}};
 const db={calendarPost:{findFirst:async({where})=>{reads++;assert.equal(where.calendarId,'workspace');return current;}},socialCalendar:{findUnique:async()=>({managerId:'owner'})},$transaction:async fn=>fn(tx),contentWorkspaceUsage:{updateMany:async()=>{charged--;}}};
 const api=load('app/api/calendars/[id]/posts/[postId]/creative/route.ts',{
  '@/lib/auth':{getCurrentCreator:async()=>({id:'member'})},'@/lib/db':{db},'@/lib/calendarPermissions':{hasCalendarPermission:async(_actor,_workspace,name)=>name==='ai.generate'?ai:permission},
  '@/lib/knowledge/context':{getBusinessKnowledgeContext:async()=>'Verified facts'},'@/lib/contentWorkspaceUsage':{consumeAiRegeneration:async()=>{charged++;return {allowed:true,cycleStart:new Date('2026-10-01')};}},
  '@/lib/openai':{developCreativeBrief:async input=>{modelCalls++;modelInput=input;return generated;}},'@/lib/publishing/editGuard':{postContentEditError:async()=>null},'@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
 });
 const run=body=>api.POST(new NextRequest('https://example.test/api/calendars/workspace/posts/post/creative',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:current.updatedAt.toISOString(),...body})}),{params:Promise.resolve({id:'workspace',postId:'post'})});
 return {run,get post(){return current},get modelCalls(){return modelCalls},get modelInput(){return modelInput},get reads(){return reads},get writes(){return writes},get snapshot(){return snapshot},get charged(){return charged}};
}
test('optional script generation leaves the original brief and manual caption untouched',async()=>{const f=fixture();const response=await f.run({kind:'script',generate:true});assert.equal(response.status,200);assert.equal(f.post.script,'Spoken lines for the current idea');assert.equal(f.post.caption,'Manually edited caption');assert.deepEqual(f.post.creativeBrief,brief);assert.equal(f.modelCalls,1);assert.deepEqual(f.modelInput.brief,brief);assert.equal(f.snapshot.generationNumber,2);assert.equal(f.post.creativeDevelopment.script.manuallyEdited,false);});
test('manual execution material saves independently without charging AI',async()=>{const f=fixture({ai:false});assert.equal((await f.run({kind:'caption',text:'My own copy'})).status,200);assert.equal(f.post.caption,'My own copy');assert.equal(f.post.script,'Existing script');assert.equal(f.charged,0);assert.equal(f.post.creativeDevelopment.caption.manuallyEdited,true);});
test('brief edits preserve execution text and mark its previous source snapshot stale',async()=>{const f=fixture();await f.run({kind:'caption',text:'My caption'});const snapshot=f.post.creativeDevelopment.caption.briefSnapshot;await f.run({kind:'brief',brief:{...brief,coreIdea:'A new creative opportunity'}});assert.equal(f.post.caption,'My caption');assert.equal(f.post.creativeDevelopment.caption.briefSnapshot,snapshot);assert.notEqual(snapshot,JSON.stringify(f.post.creativeBrief));});
test('field-only regeneration applies only the requested field even if model changes everything',async()=>{const f=fixture({generated:{...brief,title:'Unrequested title',creativeDirection:'A different storytelling opportunity'}});assert.equal((await f.run({kind:'brief',field:'creativeDirection',generate:true})).status,200);assert.equal(f.post.creativeBrief.title,brief.title);assert.equal(f.post.creativeBrief.creativeDirection,'A different storytelling opportunity');assert.equal(f.post.caption,'Manually edited caption');});
test('stale requests, unauthorised users and approved content do not reach the model',async()=>{const stale=fixture();assert.equal((await stale.run({kind:'script',generate:true,expectedUpdatedAt:'2026-01-01'})).status,409);assert.equal(stale.modelCalls,0);const outsider=fixture({permission:false});assert.equal((await outsider.run({kind:'caption',text:'x'})).status,403);assert.equal(outsider.reads,0);const approved=fixture({approved:true});assert.equal((await approved.run({kind:'script',generate:true})).status,409);assert.equal(approved.modelCalls,0);});
test('AI permission is checked independently from editing permission',async()=>{const f=fixture({ai:false});assert.equal((await f.run({kind:'script',generate:true})).status,403);assert.equal(f.modelCalls,0);assert.equal(f.writes,0);});

test('v2 content saves all public copy fields without changing historical scripts',async()=>{
 const v2={...brief,version:2,hook:'Specific opening',caption:'Complete caption for review',hashtags:'#Workflow'};
 const f=fixture({initialBrief:v2});
 assert.equal((await f.run({kind:'brief',brief:{...v2,caption:'Edited complete caption',suggestedCta:'Share your experience'}})).status,200);
 assert.equal(f.post.caption,'Edited complete caption');
 assert.equal(f.post.hook,v2.hook);assert.equal(f.post.cta,'Share your experience');assert.equal(f.post.hashtags,v2.hashtags);
 assert.equal(f.post.script,'Existing script');assert.equal(f.snapshot.caption,f.post.caption);
});
test('v2 optional script uses the current complete brief without overwriting copy',async()=>{
 const v2={...brief,version:2,hook:'Specific opening',caption:'Complete caption for review',hashtags:'#Workflow'};
 const f=fixture({initialBrief:v2});
 assert.equal((await f.run({kind:'script',generate:true})).status,200);
 assert.deepEqual(f.modelInput.brief,v2);
 assert.equal(f.post.creativeBrief.caption,v2.caption);
 assert.equal(f.post.caption,'Manually edited caption');
});
test('missing hook objective and audience are derived from saved content without replacing existing copy',async()=>{
 const initial={...brief,version:2,hook:'',objective:'',targetAudience:'',caption:'Saved specific customer-facing caption',hashtags:'#Original'};
 const generated={...initial,hook:'A relevant hook',objective:'Help studio leads compare handoff responsibilities',targetAudience:'Studio leads handing work to multiple client teams',caption:'Unrequested replacement',creativeDirection:'Unrequested direction'};
 const f=fixture({initialBrief:initial,generated,existingHook:""});
 const response=await f.run({kind:'brief',generate:true,fillMissing:true});
 assert.equal(response.status,200);
 assert.equal(f.post.creativeBrief.hook,generated.hook);
 assert.equal(f.post.creativeBrief.objective,generated.objective);
 assert.equal(f.post.creativeBrief.targetAudience,generated.targetAudience);
 assert.equal(f.post.caption,'Manually edited caption');
 assert.equal(f.post.creativeBrief.creativeDirection,initial.creativeDirection);
 assert.equal(f.post.script,'Existing script');
 assert.match(f.modelInput.instruction,/THIS EXISTING CONTENT/);
 assert.equal(f.snapshot.creativeBrief.objective,generated.objective);
});
test('missing-field completion is a no-op when persisted context is already complete',async()=>{
 const complete={...brief,version:2,hook:'Existing hook',caption:'Current caption',hashtags:'#Original'};
 const f=fixture({initialBrief:complete});
 assert.equal((await f.run({kind:'brief',generate:true,fillMissing:true})).status,200);
 assert.equal(f.modelCalls,0);assert.equal(f.charged,0);assert.equal(f.writes,0);
});

test('Improve Strategy only writes strategy fields and preserves the saved creative and public copy', async()=>{
 const generated={objective:'Help studio leads identify handover gaps',targetAudience:'Studio leads training a new team member',keyMessage:'A clear handover gives every file an owner',desiredResponse:'Name a handover owner',brandConnection:'The workspace documents its client handover process',pillar:'Client handover',caption:'Unrequested caption',coreIdea:'Unrequested idea',creativeDirection:'Unrequested direction'};
 const f=fixture({generated});
 assert.equal((await f.run({kind:'brief',generate:true,section:'strategy'})).status,200);
 assert.equal(f.modelInput.section,'strategy');
 assert.equal(f.post.creativeBrief.objective,generated.objective);
 assert.equal(f.post.creativeBrief.coreIdea,brief.coreIdea);
 assert.equal(f.post.creativeBrief.creativeDirection,brief.creativeDirection);
 assert.equal(f.post.caption,'Manually edited caption');
 assert.equal(f.post.hook,'Existing hook');
});

test('Improve Creative Direction only writes the direction and leaves strategy and public copy intact', async()=>{
 const f=fixture({generated:{creativeDirection:'Show two versions of the same handover, with responsibility visible in the second.',objective:'Unrequested objective',caption:'Unrequested caption'}});
 assert.equal((await f.run({kind:'brief',generate:true,section:'creativeDirection'})).status,200);
 assert.equal(f.modelInput.section,'creativeDirection');
 assert.equal(f.post.creativeBrief.objective,brief.objective);
 assert.match(f.post.creativeBrief.creativeDirection,/two versions/);
 assert.equal(f.post.caption,'Manually edited caption');
});

test('incomplete scoped AI responses leave the saved post untouched and restore allowance', async()=>{
 const f=fixture({generated:{objective:'Only one field'}});
 assert.equal((await f.run({kind:'brief',generate:true,section:'strategy'})).status,502);
 assert.equal(f.writes,0);
 assert.equal(f.charged,0);
});

test('saving a single text container only writes that field and keeps other copy and strategy',async()=>{
 const {editablePostBrief}=load('lib/content/brief.ts');
 const f=fixture();
 const draft=editablePostBrief(f.post);
 const updated=await f.run({kind:'brief',field:'creativeDirection',brief:{
  ...draft,creativeDirection:'A new creative direction',caption:'Unrelated caption',objective:'Unrelated objective',
 }});
 assert.equal(updated.status,200);
 assert.equal(f.post.creativeBrief.creativeDirection,'A new creative direction');
 assert.equal(f.post.creativeBrief.objective,draft.objective);
 assert.equal(f.post.caption,'Manually edited caption');
 assert.equal(f.post.script,'Existing script');
 assert.equal(f.modelCalls,0);
});

test('single field editing can save the first piece of a partial brief',async()=>{
 const {editablePostBrief}=load('lib/content/brief.ts');
 const f=fixture({initialBrief:{...brief,version:2,objective:'',targetAudience:''}});
 const draft=editablePostBrief(f.post);
 assert.equal((await f.run({kind:'brief',field:'objective',brief:{...draft,objective:'A specific reason for the post'}})).status,200);
 assert.equal(f.post.creativeBrief.objective,'A specific reason for the post');
 assert.equal(f.post.creativeBrief.targetAudience,'');
});
