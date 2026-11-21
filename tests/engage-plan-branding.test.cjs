const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const policy=load('lib/contentWorkspacePolicy.ts');

async function render(state){
 const creator={id:'owner',name:'Example Owner',email:'owner@example.test',contentWorkspacePlan:'ENGAGE',contentWorkspaceBillingStatus:state,contentWorkspaceTrialUsedAt:state==='PENDING_SETUP'?null:new Date(),contentWorkspaceTrialEndsAt:new Date(Date.now()+86400000),contentWorkspaceBillingCycle:'ANNUAL',isComped:false,compedUntil:null};
 const Page=load('app/dashboard/engage/page.tsx',{
  '@/lib/auth':{getCurrentCreator:async()=>creator},
  '@/lib/db':{db:{socialCalendar:{findFirst:async()=>state==='PENDING_SETUP'?null:{id:'business',clientName:'Example business'}}}},
  '@/lib/contentWorkspaceUsage':{...policy,getContentWorkspaceUsage:async()=>state==='TRIAL' ? {aiGenerationLimit:50,aiGenerationsRemaining:0} : {aiGenerationLimit:1000,aiGenerationsRemaining:863}},
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  'next/navigation':{useRouter:()=>({}),redirect:()=>assert.fail('Billing view must remain on the plan page')},
  '@/components/calendars/CalendarPaymentCallbackHandler':{__esModule:true,default:()=>null},
 }).default;
 return renderToStaticMarkup(await Page({searchParams:Promise.resolve({billing:'1'})}));
}
test('branded trial plan shows the official logo, real quota and one clear checkout',async()=>{
 const html=await render('TRIAL');
 assert.match(html,/\/images\/logo\/sw.svg/);
 assert.match(html,/Go back to all tools/);
 assert.match(html,/Go to conversations/);
 assert.match(html,/What’s included in Engage/);assert.match(html,/Showwork Engage/);
 assert.match(html,/<meter[^>]*max="50"[^>]*value="0"/);
 assert.match(html,/Subscribe to continue using AI replies/);
 assert.match(html,/Your free trial ends/);
 assert.match(html,/Subscribe to Engage/);
 assert.match(html,/href="\/dashboard\/calendars\/business\?view=inbox"/);
 assert.doesNotMatch(html,/emerald|Paid top-ups|Comment responses are planned/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
});
test('paid plan shows the actual annual price and does not sell another subscription',async()=>{
 const html=await render('ACTIVE');
 assert.match(html,/149,000/);assert.match(html,/Cancel subscription/);
 assert.doesNotMatch(html,/Subscribe to Engage|Keep the conversations going/);
});
test('new customers keep the no-card three-day trial setup in the branded layout',async()=>{
 const html=await render('PENDING_SETUP');
 assert.match(html,/Business name/);assert.match(html,/Start my 3-day free trial/);
 assert.doesNotMatch(html,/Subscribe to Engage/);
 assert.match(html,/No card required/);
 assert.match(html,/50 AI replies total/);
});

test('expired access makes subscription the primary action and hides the inbox link',async()=>{
 const html=await render('OFFLINE');
 assert.match(html,/Subscription required/);
 assert.match(html,/Subscribe to Engage/);
 assert.doesNotMatch(html,/Go to conversations/);
});
