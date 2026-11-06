const {test}=require('node:test');const assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');const {load}=require('./helpers/load-typescript.cjs');
const config=load('lib/contentWorkspaceEntitlements.ts');
const policy=load('lib/contentWorkspacePolicy.ts');
const account=plan=>({contentWorkspacePlan:plan,contentWorkspaceBillingStatus:'ACTIVE',contentWorkspaceTrialEndsAt:null,isComped:false,compedUntil:null});
test('Growth fits between Creator and Studio and includes 10 clients at 12900 monthly',()=>{
 assert.deepEqual(config.CONTENT_WORKSPACE_PLAN_ORDER,['CREATOR','GROWTH','STUDIO','UNLIMITED']);
 const plan=config.CONTENT_WORKSPACE_PLANS.GROWTH;
 assert.equal(plan.priceNgnMonthly,12900);assert.equal(plan.priceNgnAnnual,12900*12*.95);assert.equal(plan.activeWorkspaces,10);
 assert.equal(plan.collaborators,5);assert.equal(plan.storageBytes,20_000_000_000);assert.equal(plan.aiGenerations,250);assert.equal(plan.aiRegenerations,250);
 assert.equal(config.CONTENT_WORKSPACE_PLANS.CREATOR.priceNgnMonthly,4900);
 assert.equal(config.CONTENT_WORKSPACE_PLANS.STUDIO.priceNgnMonthly,29900);
});
test('Randy in AI Studio starts at Growth; ordinary AI generation remains in Creator',()=>{
 assert.equal(policy.canUseContentWorkspaceFeature(account('CREATOR'),'randyStudio'),false);
 for(const plan of ['GROWTH','STUDIO','UNLIMITED'])assert.equal(policy.canUseContentWorkspaceFeature(account(plan),'randyStudio'),true);
 assert.ok(config.getContentWorkspaceFeatureList('CREATOR').includes('AI content generation'));
 assert.ok(!config.getContentWorkspaceFeatureList('CREATOR').includes('Randy in AI Studio'));
 assert.ok(config.getContentWorkspaceFeatureList('GROWTH').includes('Randy in AI Studio'));
 assert.equal(config.planIncludesWorkspaceFeature('GROWTH','advancedAnalytics'),false);
});
test('Growth access expires with billing, while existing Agency trial behavior is preserved',()=>{
 assert.equal(policy.canUseContentWorkspaceFeature({...account('GROWTH'),contentWorkspaceBillingStatus:'CANCELLED'},'randyStudio'),false);
 assert.equal(policy.canUseContentWorkspaceFeature({...account('CREATOR'),contentWorkspaceBillingStatus:'TRIAL',contentWorkspaceTrialEndsAt:new Date(Date.now()+86400000)},'randyStudio'),true);
});
test('Growth Paystack plan codes resolve for both billing cycles',()=>{
 for(const cycle of ['MONTHLY','ANNUAL']){
  const key=config.getContentWorkspacePlanCodeEnv('GROWTH',cycle);const original=process.env[key];process.env[key]='synthetic_growth_'+cycle;
  try{assert.deepEqual(config.contentWorkspacePlanFromPaystackPlanCode(process.env[key]),{plan:'GROWTH',cycle});assert.equal(config.getContentWorkspacePlanCode('GROWTH',cycle),process.env[key]);}
  finally{if(original===undefined)delete process.env[key];else process.env[key]=original;}
 }
});
test('direct Randy and research endpoints reject a locked plan before reading or creating content',async()=>{
 const mocks={'@/lib/auth':{getCurrentCreator:async()=>({id:'member'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true,canAccessCalendarById:async()=>true,calendarFeatureGate:async(id,feature)=>{assert.equal(id,'workspace');assert.equal(feature,'randyStudio');return NextResponse.json({code:'WORKSPACE_FEATURE_LOCKED',requiredPlan:'GROWTH'},{status:403});}},'@/lib/db':{db:new Proxy({},{get(){assert.fail('must gate database work');}})},'@/lib/knowledge/randy/service':{},'@/lib/knowledge/research':{}};
 const context={params:Promise.resolve({id:'workspace'})};
 for(const file of ['app/api/calendars/[id]/randy/route.ts','app/api/calendars/[id]/research/route.ts']){
  const route=load(file,mocks);
  for(const method of Object.keys(route).filter(method=>['GET','POST','PATCH'].includes(method))){const request=new NextRequest('http://localhost:3000/api',{method});const response=await route[method](request,context);assert.equal(response.status,403);assert.equal((await response.json()).requiredPlan,'GROWTH');}
 }
});
test('publishing eligibility covers exactly ten Growth clients and retains the Creator cap',()=>{
 const {workspaceEligibility}=load('lib/publishing/eligibilityPolicy.ts');
 const owner=plan=>({...account(plan),id:'owner',isDeactivated:false});
 assert.equal(workspaceEligibility(owner('GROWTH'),10,new Date()).allowed,true);
 assert.equal(workspaceEligibility(owner('GROWTH'),11,new Date()).allowed,false);
 assert.equal(workspaceEligibility(owner('CREATOR'),6,new Date()).allowed,false);
});
