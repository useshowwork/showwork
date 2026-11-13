const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const lead={id:'lead',name:'Instagram contact',username:null,email:'contact@example.test',phone:'+2348000000000',company:'Studio',temperature:'HOT',status:'QUALIFIED',source:'SOCIAL',notes:'Private manager note',createdAt:new Date('2026-11-01'),updatedAt:new Date('2026-11-13'),socialConversation:{platform:'INSTAGRAM',participantName:'Ada Client',participantUsername:'ada',participantPlatformId:'private-provider-id'},milestones:[{kind:'HOT'}]};
function fixture({exists=true,token='valid',active=true}={}){
 const queries=[],verified=[];
 const api=load('app/api/social-calendar/[slug]/leads/route.ts',{
 '@/lib/db':{db:{socialCalendar:{findUnique:async()=>exists?{id:'workspace'}:null},calendarLead:{findMany:async query=>{queries.push(query);return [lead];}}}},
 '@/lib/auth':{verifyViewerToken:(value,id)=>{verified.push([value,id]);return value==='valid'&&id==='workspace';}},
 '@/lib/calendarPermissions':{canAccessCalendarById:async()=>active},
 });
 const get=()=>api.GET({cookies:{get:name=>name==='calendar_viewer_workspace'&&token?{value:token}:undefined}},{params:Promise.resolve({slug:'client'})});
 return {api,queries,verified,get};
}
test('clients receive their lead contact details without manager notes, provider IDs or history',async()=>{
 const h=fixture(),response=await h.get();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 const data=await response.json();assert.equal(data.leads[0].name,'Ada Client');assert.equal(data.leads[0].email,lead.email);assert.equal(data.leads[0].socialPlatform,'INSTAGRAM');
 assert.doesNotMatch(JSON.stringify(data),/Private manager note|private-provider-id|milestones|socialConversation/);
 assert.deepEqual(h.verified,[['valid','workspace']]);
 const query=h.queries[0];assert.equal(query.where.calendarId,'workspace');assert.deepEqual(query.where.AND[0].OR[1].socialConversation.connection.status.in,['CONNECTED','NEEDS_REAUTH']);
 assert.equal(query.select.notes,undefined);assert.equal(query.select.socialConversation.select.participantPlatformId,undefined);
});
test('client lead access is bound to the correct workspace and blocks unauthenticated or inactive access',async()=>{
 for(const [options,status] of [[{exists:false},404],[{token:null},401],[{token:'another-workspace-token'},401],[{active:false},403]]){
  const h=fixture(options);assert.equal((await h.get()).status,status);assert.equal(h.queries.length,0);
 }
});
test('the client leads endpoint exposes no write handlers',()=>{
 const h=fixture();assert.equal(typeof h.api.GET,'function');for(const method of ['POST','PATCH','DELETE','PUT'])assert.equal(h.api[method],undefined);
});
function renderDirectory(viewing=false){
 let nullState=0;
 const row={...lead,name:'Ada Client',username:'ada',socialPlatform:'INSTAGRAM',createdAt:lead.createdAt.toISOString(),updatedAt:lead.updatedAt.toISOString()};
 const Panel=load('components/calendars/CalendarLeadsPanel.tsx',{
 react:{...React,useState:initial=>React.useState(Array.isArray(initial)?[row]:initial===null&&nullState++===0&&viewing?row:initial)},
 }).default;
 return renderToStaticMarkup(React.createElement(Panel,{calendarId:'client',clientSlug:'client',canEdit:true}));
}
test('client directory offers filters, contact details and viewing actions, but cannot edit or import',()=>{
 const html=renderDirectory();for(const text of ['Search leads','Filter leads by status','Filter leads by temperature','Ada Client','contact@example.test','View details','read-only'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/Import CSV|Add lead|>Edit<|Private manager note/);
 // Existing rows remain visible while a refresh is in progress.
 assert.doesNotMatch(html,/Loading leads…/);
});
test('client lead details show contact and pipeline fields without notes or edit controls',()=>{
 const html=renderDirectory(true);assert.match(html,/id="shared-lead-title"/);assert.match(html,/Lead details · read-only/);assert.match(html,/contact@example.test/);assert.match(html,/>Stage</);assert.doesNotMatch(html,/Private manager note|Save changes|Notes<\/dt>/);
});

test('client workspace links Leads on desktop and mobile and opens the read-only client directory',()=>{
 const stub={__esModule:true,default:()=>null};
 const Workspace=load('components/calendars/ClientCalendarWorkspace.tsx',{
 'next/navigation':{useSearchParams:()=>new URLSearchParams({view:'leads'})},
 '@/components/navigation/MobileDrawer':{...stub,NavigationToggle:()=>null},
 '@/components/calendars/CalendarReportingPanel':stub,'@/components/calendars/ClientCalendarView':stub,
 '@/components/calendars/SocialFeedPreview':stub,'@/components/calendars/InstagramPreview':stub,'@/components/calendars/TikTokPreview':stub,
 './CalendarLeadsPanel':{__esModule:true,default:props=>React.createElement('div',{'data-client-leads':props.clientSlug,'data-editable':String(props.canEdit)},'Shared lead directory')},
 }).default;
 const html=renderToStaticMarkup(React.createElement(Workspace,{slug:'brand',clientName:'Brand',planStatus:'PLAN_APPROVED',displayTitle:'Brand',displayDescription:'Workspace',posts:[],stats:{totalPosts:0,approvedPosts:0,pendingPosts:0,revisionPosts:0,totalAssets:0,approvalPercentage:0}}));
 assert.match(html,/data-client-leads="brand" data-editable="false"/);assert.match(html,/data-client-panel="leads"/);assert.ok((html.match(/>Leads</g)||[]).length>=2);
});
