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
