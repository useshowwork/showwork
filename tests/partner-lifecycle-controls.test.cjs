const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
for(const action of ['pause','suspend','resume'])test(`${action} is guarded, audited and preserves referral/commission history`,async()=>{
 const record={status:action==='resume'?'SUSPENDED':'ACTIVE',isActive:action!=='resume'};const writes=[];
 const route=load('app/api/admin/partners/[id]/route.ts',{
 'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},'@/lib/auth':{getCurrentCreator:async()=>({id:'admin',email:'admin@example.test'})},'@/lib/admin':{isAdminEmail:()=>true},'@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},'@/lib/billingBenefitNotifications':{},'@/lib/resend':{},
 '@/lib/db':{db:{$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'Serializable');return fn({partnerProfile:{findUnique:async()=>({...record}),updateMany:async({where,data})=>{assert.equal(where.status,record.status);assert.equal(where.isActive,record.isActive);Object.assign(record,data);writes.push(data);return{count:1};}},partnerAuditEvent:{create:async a=>writes.push(a.data)}});}}},
 });
 const response=await route.PATCH({json:async()=>({action})},{params:Promise.resolve({id:'p'})});assert.equal(response.status,200);assert.equal(record.status,action==='suspend'?'SUSPENDED':'ACTIVE');assert.equal(record.isActive,action==='resume');assert.equal(writes[1].actorId,'admin');
});
