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
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true}),2);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true}),2);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true,hasContent:true}),3);
 assert.equal(workspaceSetupStep({...manual,hasKnowledge:true,hasBrandVoice:true,hasChannels:true,hasContent:true,complete:true}),4);
});
test('generation needs knowledge; brand voice, channels and publishing preference are optional',()=>{
 const ready={...fresh,hasKnowledge:true,hasBrandVoice:true};
 assert.equal(canGenerateDuringSetup(ready),true);
 assert.equal(canGenerateDuringSetup({...ready,hasKnowledge:false}),false);
 assert.equal(canGenerateDuringSetup({...ready,hasBrandVoice:false}),true);
 assert.equal(workspaceSetupStep({...ready,publishingChosen:true}),2);
 assert.equal(workspaceSetupStep({...ready,publishingChosen:true,hasContent:true}),3);
});
test('existing and completed workspaces retain their normal generation workflow',()=>{
 assert.equal(canGenerateDuringSetup({...fresh,enabled:false}),true);
 assert.equal(canGenerateDuringSetup({...fresh,complete:true}),true);
});
test('out-of-order activity does not skip an earlier unfinished step',()=>{
 assert.equal(workspaceSetupStep({...fresh,hasKnowledge:true,hasChannels:true,hasContent:true}),0);
 assert.equal(workspaceSetupStep({...fresh,publishingChosen:true,hasContent:true,hasChannels:true}),1);
});
test('server setup distinguishes saved personality selections from unrelated or empty profile text',async()=>{
 const {PERSONALITY_QUESTIONS,serializeBrandPersonality}=load('lib/knowledge/brandPersonality.ts');
 const profile={version:1,answers:Object.fromEntries(PERSONALITY_QUESTIONS.map(question=>[question.key,{choice:question.options[0],custom:''}]))};
 let extractedText='incomplete profile';
 const {getWorkspaceSetup}=load('lib/workspaceSetupServer.ts',{'@/lib/db':{db:{socialCalendar:{findUnique:async()=>({setupVersion:1,publishingPreferenceSetAt:new Date(),autoPublishEnabled:false,setupCompletedAt:null,_count:{businessDocuments:1,posts:0},businessDocuments:[{extractedText}],socialConnections:[]})}}}});
 assert.equal((await getWorkspaceSetup('workspace')).hasBrandVoice,false);
 extractedText=serializeBrandPersonality(profile);
 assert.equal((await getWorkspaceSetup('workspace')).hasBrandVoice,true);
});

test('knowledge setup offers the next step when business sources exist without brand voice',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Panel=load('components/calendars/KnowledgeSetupPanel.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Panel,{calendarId:'workspace',hasKnowledge:true,hasBrandVoice:false,sourceCount:2,nextSection:'generate',knowledge:null,voice:null}));
 assert.match(html,/Brand voice · optional/);assert.match(html,/Generate calendar/);
 assert.doesNotMatch(html,/disabled=""|Save your brand voice to continue/);
});
