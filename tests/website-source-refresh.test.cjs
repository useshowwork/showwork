const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');

function fixture({websiteText='Fresh website text',fail=false,exists=true,conflict=false}={}){
 const saved={id:'source',calendarId:'workspace',originalName:'Website — Studio',websiteUrl:'https://studio.example',createdAt:new Date('2026-10-01'),websiteRefreshedAt:null,extractedText:'Saved text'};
 let crawls=0, writes=0, rebuilds=0;
 const {POST}=load('app/api/calendars/[id]/business-documents/website/route.ts',{
  '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
  '@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},
  '@/lib/contentWorkspaceUsage':{canAccessContentWorkspace:()=>true},
  '@/lib/knowledge/context':{rebuildBusinessKnowledge:async()=>{rebuilds++;return {summary:'Updated business overview',updatedAt:new Date()};}},
  '@/lib/websiteKnowledge':{extractWebsiteKnowledge:async url=>{
   crawls++;assert.equal(url,saved.websiteUrl);
   if(fail)throw Error('Website temporarily unavailable');
   return {url:saved.websiteUrl+'/redirect',name:'Studio',text:websiteText,pageCount:2};
  }},
  '@/lib/db':{db:{
   socialCalendar:{findUnique:async()=>({managerId:'owner',businessDocuments:[]})},
   creator:{findUnique:async()=>({})},
   calendarBusinessDocument:{
    findFirst:async({where})=>{assert.deepEqual(where,{id:'source',calendarId:'workspace',websiteUrl:{not:null}});return exists?saved:null;},
    updateMany:async({where,data})=>{
     assert.deepEqual(where,{id:'source',calendarId:'workspace',websiteRefreshedAt:null});
     writes++;assert.equal(data.extractedText,websiteText);
     assert.ok(data.websiteRefreshedAt instanceof Date);
     return {count:conflict?0:1};
    },
    create:async()=>assert.fail('Refresh must retain the saved source'),
   },
  }},
 });
 return {
  run:()=>POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({documentId:'source'})}),{params:Promise.resolve({id:'workspace'})}),
  stats:()=>({crawls,writes,rebuilds}),
 };
}

test('refresh updates the existing website source and overview when the extracted text changes',async()=>{
 const f=fixture();
 const res=await f.run();
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.document.id,'source');
 assert.equal(data.document.websiteUrl,'https://studio.example');
 assert.ok(data.document.websiteRefreshedAt);
 assert.equal(data.changed,true);
 assert.equal(data.summaryUpdated,true);
 assert.deepEqual(f.stats(),{crawls:1,writes:1,rebuilds:1});
});

test('unchanged website text only records the successful refresh',async()=>{
 const f=fixture({websiteText:'Saved text'});
 assert.equal((await (await f.run()).json()).changed,false);
 assert.deepEqual(f.stats(),{crawls:1,writes:1,rebuilds:0});
});

test('a failed crawl or missing source keeps existing knowledge untouched',async()=>{
 const unavailable=fixture({fail:true});
 assert.equal((await unavailable.run()).status,422);
 assert.deepEqual(unavailable.stats(),{crawls:1,writes:0,rebuilds:0});
 const unknown=fixture({exists:false});
 assert.equal((await unknown.run()).status,404);
 assert.deepEqual(unknown.stats(),{crawls:0,writes:0,rebuilds:0});
});
