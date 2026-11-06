const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
function setup({signedIn=true,total=1}={}){
 const queries=[];const stub={__esModule:true,default:()=>null};
 const page=load('app/dashboard/projects/page.tsx',{
  '@/components/help/DeliveryHelpLink':stub,
  'next/headers':{cookies:async()=>({get:()=>({value:'dark'})})},
  '@/components/projects/ProjectDashboardTheme':{...stub,default:({children,initialTheme})=>React.createElement('main',{'data-project-theme':initialTheme},children),ProjectThemeToggle:()=>null},
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  'next/navigation':{redirect:href=>{throw Error('redirect:'+href)}},
  '@/lib/auth':{getCurrentCreator:async()=>signedIn?{id:'owner',email:'owner@example.test',name:'Owner'}:null},
  '@/lib/db':{db:{project:{count:async args=>{queries.push(args);return total;},findMany:async args=>{queries.push(args);return total?[{id:'project',clientName:'Client',slug:'client',createdAt:new Date(0),viewCount:3,_count:{media:2,viewerEmails:1}}]:[];}},projectCollaborator:{findMany:async args=>{queries.push(args);return[];}},managedProject:{findMany:async args=>{queries.push(args);return args.where.creatorId?[{id:'managed',name:'Film production',createdAt:new Date(0),publishedAt:null,deliveryProject:{id:'delivery'},tasks:[{status:'DONE'},{status:'TODO'}]}]:[];}}}},
  '@/components/LogoutButton':stub,
  '@/components/DashboardProjectList':{...stub,default:({initialData})=>React.createElement('div',{'data-project-list':true,'data-total':initialData.totalCount})},
  '@/lib/subscriptionUsage':{getCreatorUsage:async()=>({tier:'FREE',limit:5,used:1,remaining:4})},
  '@/lib/subscriptionTiers':{TIERS:{},PLAN_DISPLAY_NAME:{FREE:'Free'},NEXT_TIER:{FREE:null}},
  '@/lib/admin':{isAdminEmail:()=>false},
 }).default;
 return{page,queries};
}
test('delivery dashboard prioritizes projects and preserves theme and owned-data scope',async()=>{
 const f=setup();const html=renderToStaticMarkup(await f.page());assert.match(html,/data-project-theme="dark"/);assert.match(html,/New project/);assert.match(html,/data-project-list="true"/);assert.match(html,/href="\/dashboard\/start"/);assert.match(html,/href="\/dashboard\/managed\/managed"/);assert.match(html,/1 of 2 tasks complete/);assert.doesNotMatch(html,/hero1.png|A better way to deliver creative work/);
 assert.ok(f.queries.some(query=>query.where.creatorId==='owner'&&query.where.deletedAt===null));
});
test('signed-out visitors cannot query projects',async()=>{
 const f=setup({signedIn:false});await assert.rejects(f.page(),/redirect:\/login/);assert.equal(f.queries.length,0);
});
test('new accounts keep a clear creation action without empty aggregate metrics',async()=>{
 const f=setup({total:0});const html=renderToStaticMarkup(await f.page());assert.match(html,/Create a project to share your work/);assert.match(html,/New project/);assert.doesNotMatch(html,/Project views/);
});
