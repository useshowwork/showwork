const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {workspaceSetupStep,canGenerateDuringSetup}=load('lib/workspaceSetup.ts');
const fresh={enabled:true,publishingChosen:false,autoPublishEnabled:false,hasKnowledge:false,hasBrandVoice:false,hasChannels:false,hasContent:false,complete:false};
test('setup follows actual prerequisites, including an explicit manual publishing choice',()=>{
 assert.equal(workspaceSetupStep(fresh),0);
 const manual={...fresh,publishingChosen:true};
 assert.equal(workspaceSetupStep(manual),1);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true}),2);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true}),3);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true}),3);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true,hasContent:true}),4);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true,hasContent:true,complete:true}),5);
});
test('generation needs knowledge and brand voice, not channels or publishing preference',()=>{
 const ready={...fresh,hasKnowledge:true,hasBrandVoice:true};
 assert.equal(canGenerateDuringSetup(ready),true);
 for(const missing of ['hasKnowledge','hasBrandVoice']) assert.equal(canGenerateDuringSetup({...ready,[missing]:false}),false);
 assert.equal(workspaceSetupStep({...ready,publishingChosen:true}),3);
 assert.equal(workspaceSetupStep({...ready,publishingChosen:true,hasContent:true}),4);
});
test('existing and completed workspaces retain their normal generation workflow',()=>{
 assert.equal(canGenerateDuringSetup({...fresh,enabled:false}),true);
 assert.equal(canGenerateDuringSetup({...fresh,complete:true}),true);
});
test('out-of-order activity does not skip an earlier unfinished step',()=>{
 assert.equal(workspaceSetupStep({...fresh,hasKnowledge:true,hasChannels:true,hasContent:true}),0);
 assert.equal(workspaceSetupStep({...fresh,publishingChosen:true,hasContent:true,hasChannels:true}),1);
});
test('server setup requires a complete saved brand voice, not merely a profile document',async()=>{
 const {PERSONALITY_QUESTIONS,serializeBrandPersonality}=load('lib/knowledge/brandPersonality.ts');
 const profile={version:1,answers:Object.fromEntries(PERSONALITY_QUESTIONS.map(question=>[question.key,{choice:question.options[0],custom:''}]))};
 let extractedText='incomplete profile';
 const {getWorkspaceSetup}=load('lib/workspaceSetupServer.ts',{'@/lib/db':{db:{socialCalendar:{findUnique:async()=>({setupVersion:1,publishingPreferenceSetAt:new Date(),autoPublishEnabled:false,setupCompletedAt:null,_count:{businessDocuments:1,posts:0},businessDocuments:[{extractedText}],socialConnections:[]})}}}});
 assert.equal((await getWorkspaceSetup('workspace')).hasBrandVoice,false);
 extractedText=serializeBrandPersonality(profile);
 assert.equal((await getWorkspaceSetup('workspace')).hasBrandVoice,true);
});
