const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {parsePartnerTerms,recordPartnerReferral}=load('lib/partnerTerms.ts');
const base={commissionPercent:18,commissionMonths:6,discountPercent:20,discountMonths:3};
test('approvals require explicit independently configured terms',()=>{
 assert.deepEqual(parsePartnerTerms(base),base);
 for(const bad of [null,{}, {...base,commissionPercent:101},{...base,commissionMonths:0},{...base,commissionMonths:121},{...base,discountPercent:100},{...base,discountMonths:37},{...base,discountMonths:0},{...base,commissionPercent:2.5},{...base,commissionPercent:'18'},{...base,discountPercent:0}])assert.throws(()=>parsePartnerTerms(bad));
 assert.deepEqual(parsePartnerTerms({...base,discountPercent:0,discountMonths:0}),{...base,discountPercent:0,discountMonths:0});
});
test('verified referral snapshots the agreement and creates a private customer offer',async()=>{
 const writes=[];const tx={referral:{create:async args=>writes.push(['referral',args.data])},billingOffer:{create:async args=>writes.push(['offer',args.data])}};
 const partner={id:'partner',creatorId:'owner',...base};await recordPartnerReferral(tx,partner,'customer');
 assert.deepEqual(writes[0][1],{partnerId:'partner',referredCreatorId:'customer',status:'PENDING',...base});
 assert.equal(writes[1][1].audience,'SELECTED');assert.equal(writes[1][1].product,'BOTH');assert.equal(writes[1][1].percent,20);assert.equal(writes[1][1].durationMonths,3);assert.deepEqual(writes[1][1].recipients,{create:{creatorId:'customer'}});
 partner.commissionPercent=40;assert.equal(writes[0][1].commissionPercent,18);
});
test('no discount creates no billing offer and permits zero commission',async()=>{
 let offer=false;let referral;
 await recordPartnerReferral({referral:{create:async a=>referral=a.data},billingOffer:{create:async()=>offer=true}},{id:'p',creatorId:'owner',...base,commissionPercent:0,discountPercent:0,discountMonths:0},'customer');
 assert.equal(offer,false);assert.equal(referral.commissionPercent,0);
});
function approvalHarness() {
 const updates=[],emails=[];
 const tx={partnerAuditEvent:{create:async()=>{}},partnerProfile:{findUnique:async({where})=>where.id?{id:'p',status:'PENDING',creator:{id:'owner',email:'owner@example.test',name:'Owner',isDeactivated:false,compedUntil:null}}:null,update:async args=>{updates.push(args.data);return{id:'p',...args.data}}},creator:{update:async()=>{}}};
 const route=load('app/api/admin/partners/[id]/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},
  '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
  '@/lib/billingBenefitNotifications':{queuePartnerWelcomeBenefit:async()=>{},scheduleBenefitEmailDelivery:()=>{}},
  '@/lib/auth':{getCurrentCreator:async()=>({id:'admin',email:'admin@example.test'})},
  '@/lib/admin':{isAdminEmail:()=>true}, '@/lib/db':{db:{$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}}},
  '@/lib/resend':{sendPartnerWelcomeEmail:async payload=>emails.push(payload),sendPartnerApplicationDeclinedEmail:async()=>{}},
 });
 return {updates,emails,run:body=>route.PATCH({json:async()=>body},{params:Promise.resolve({id:'p'})})};
}
test('approval cannot silently use a fixed default agreement',async()=>{
 const h=approvalHarness();assert.equal((await h.run({action:'approve'})).status,400);assert.equal(h.updates.length,0);
});
test('approval saves supplied agreement and sends the same terms in onboarding',async()=>{
 const h=approvalHarness();assert.equal((await h.run({action:'approve',terms:base})).status,200);
 for(const [key,value] of Object.entries(base))assert.equal(h.updates[0][key],value);
 assert.deepEqual(h.emails[0].terms,base);
});
