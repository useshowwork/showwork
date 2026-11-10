const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {NextRequest}=require('next/server');

test('Facebook picker admits an authorized workspace manager without requiring ownership',async()=>{
 for(const allowed of [true,false]) {
  const checks=[];
  const {default:Page}=load('app/dashboard/calendars/[id]/facebook/select-page/page.tsx',{
   '@/lib/auth':{getCurrentCreator:async()=>({id:'team-member'})},
   '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({id:'client-a',managerId:'owner',clientName:'Client A'})}}},
   '@/lib/calendarPermissions':{hasCalendarPermission:async(...args)=>{checks.push(args);return allowed;}},
   'next/headers':{cookies:async()=>({get:()=>({value:'ticket'})})},
   'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},
   '@/lib/facebookPageSelection':{facebookPageSelectionCookieName:()=> 'selection',verifyFacebookPageSelection:()=>({calendarId:'client-a',pages:[{id:'page',name:'Page',accessToken:'secret'}]})},
  });
  if(allowed)assert.ok(await Page({params:Promise.resolve({id:'client-a'})}));
  else await assert.rejects(Page({params:Promise.resolve({id:'client-a'})}),/redirect/);
  assert.deepEqual(checks,[['team-member','client-a','channels.manage']]);
 }
});

test('Instagram selection ticket cannot be used in another workspace or after membership removal',async()=>{
 for(const allowed of [true,false]) for(const method of ['GET','POST']) {
  let discoveries=0,binds=0;
  const route=load('app/api/calendars/[id]/instagram/select-account/route.ts',{
   '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
   '@/lib/db':{db:{socialCalendar:{findUnique:async()=>null}}},
   '@/lib/auth':{getCurrentCreator:async()=>({id:'member'})},
   '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},
   '@/lib/facebookPageSelection':{verifyFacebookPageSelection:()=>({calendarId:'client-a',pages:[{id:'member',accessToken:'secret'}]}),facebookPageSelectionCookieOptions:()=>({})},
   '@/lib/instagram':{listManagedPages:async()=>{discoveries++;return [];}},
   '@/lib/instagramConnection':{completeInstagramConnection:async()=>binds++},
  });
  const request=new NextRequest('https://test/api/calendars/client-b/instagram/select-account',{method,headers:{origin:'https://test'}});
  const response=await route[method](request,{params:Promise.resolve({id:allowed?'client-b':'client-a'})});
  assert.equal(response.status,allowed?409:403);assert.equal(discoveries,0);assert.equal(binds,0);
 }
});

test('workspace connection authorization is re-read, so removal blocks reuse immediately',async()=>{
 let member={id:'member-row',role:'MANAGER',permissions:[],customPermissions:false};
 const {hasCalendarPermission}=load('lib/calendarPermissions.ts',{
  '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({managerId:'owner'})},calendarCollaborator:{findUnique:async()=>member}}},
  '@/lib/contentWorkspaceUsage':{canAccessContentWorkspace:()=>true,getContentWorkspacePlan:()=> 'UNLIMITED'},
 });
 assert.equal(await hasCalendarPermission('member','client-a','channels.view'),true);
 member=null;
 assert.equal(await hasCalendarPermission('member','client-a','channels.view'),false);
 assert.equal(await hasCalendarPermission('member','client-a','channels.manage'),false);
});

test('direct Page diagnostic requires workspace permission and the matching authorizing creator',async()=>{
 for(const [allowed,actor,pageId,status]of [[false,'member','381092961751993',403],[true,'other','381092961751993',409],[true,'member','../me',400],[true,'member','381092961751993',200]]) {
  let checks=0,binds=0;
  const route=load('app/api/calendars/[id]/instagram/select-account/route.ts',{
   '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
   '@/lib/db':{db:{socialCalendar:{findUnique:async()=>null}}},
   '@/lib/auth':{getCurrentCreator:async()=>({id:actor})},
   '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},
   '@/lib/facebookPageSelection':{verifyFacebookPageSelection:()=>({calendarId:'client-a',pages:[{id:'member',accessToken:'secret-user-token'}]}),facebookPageSelectionCookieOptions:()=>({})},
   '@/lib/instagram':{inspectInstagramPageAccess:async(token,id)=>{assert.equal(token,'secret-user-token');assert.equal(id,'381092961751993');checks++;return {readOnly:true,pageTokenIssued:false};}},
   '@/lib/instagramConnection':{completeInstagramConnection:async()=>binds++},
  });
  const response=await route.GET(new NextRequest('https://test/api/calendars/client-a/instagram/select-account?'+new URLSearchParams({checkPageId:pageId})),{params:Promise.resolve({id:'client-a'})});
  assert.equal(response.status,status);assert.equal(checks,status===200?1:0);assert.equal(binds,0);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('secret-user-token'));
 }
});

test('Instagram discovery automatically uses only the authorized workspace saved Page IDs',async()=>{
 const checks=[],discoveries=[];
 const route=load('app/api/calendars/[id]/instagram/select-account/route.ts',{
  '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
  '@/lib/auth':{getCurrentCreator:async()=>({id:'member'})},
  '@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},
  '@/lib/db':{db:{socialCalendar:{findUnique:async query=>{checks.push(query);return {instagramPageId:'381092961751993',facebookPageId:null};}}}},
  '@/lib/facebookPageSelection':{verifyFacebookPageSelection:()=>({calendarId:'client-a',pages:[{id:'member',accessToken:'current-user-token'}]}),facebookPageSelectionCookieOptions:()=>({})},
  '@/lib/instagram':{listInstagramGrantedPermissions:async()=>[],listManagedPages:async(...args)=>{discoveries.push(args);return []; }},
  '@/lib/instagramConnection':{completeInstagramConnection:async()=>{throw Error('GET must not bind');}},
 });
 const response=await route.GET(new NextRequest('https://test/api/calendars/client-a/instagram/select-account'),{params:Promise.resolve({id:'client-a'})});
 assert.equal(response.status,200);
 assert.deepEqual(checks,[{where:{id:'client-a'},select:{instagramPageId:true,facebookPageId:true}}]);
 assert.deepEqual(discoveries,[['current-user-token',undefined,['381092961751993']]]);
 assert.ok(!JSON.stringify(await response.json()).includes('current-user-token'));
});
