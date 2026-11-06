const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {reviewPartnerPayout,netCommission,outstandingRecovery}=load('lib/partnerFinance.ts');
function setup(status='PENDING',options={}){
 const commission={id:'c',status:status==='PAID'?'PAID':'APPROVED',commissionAmountNgn:6000,reversedAmountNgn:0,onHold:false,recoverySettledNgn:0,...options.commission};
 const row={id:'payout',partnerId:'partner',status,amountNgn:netCommission(commission),bankName:'Bank',bankCode:'001',accountName:'Verified Name',accountNumber:'0123456789',accountVerifiedAt:new Date(),payoutCommissions:[{commissionId:'c',amountNgn:netCommission(commission),commission}],...options.payout};
 const writes=[];
 const tx={partnerProfile:{findUnique:async()=>({status:options.partnerStatus||'ACTIVE'})},partnerPayout:{findUnique:async()=>row,findUniqueOrThrow:async()=>row,updateMany:async({where,data})=>{if(options.stale||where.status!==row.status)return{count:0};writes.push(['payout',data]);Object.assign(row,data);return{count:1};}},referralCommission:{findMany:async()=>[commission],updateMany:async()=>{writes.push(['commissions']);return{count:1};}},partnerPayoutCommission:{deleteMany:async()=>writes.push(['deleteAllocations'])},partnerAuditEvent:{create:async()=>writes.push(['audit'])}};
 return{row,writes,tx,run:(action)=>reviewPartnerPayout(tx,'payout',action,'admin','note','bank-reference')};
}
for(const status of ['PAID','REJECTED'])test(`reject cannot change ${status} payout or remove allocations`,async()=>{const h=setup(status);await assert.rejects(h.run('REJECT'));assert.deepEqual(h.writes,[]);});
test('pending rejection releases allocations and records the actor',async()=>{const h=setup();await h.run('REJECT');assert.equal(h.row.status,'REJECTED');assert.ok(h.writes.some(w=>w[0]==='deleteAllocations'));assert.ok(h.writes.some(w=>w[0]==='audit'));});
test('stale admin transition is rejected before allocation deletion',async()=>{const h=setup('PENDING',{stale:true});await assert.rejects(h.run('REJECT'),/changed/);assert.deepEqual(h.writes,[]);});
test('paid settlement uses immutable snapshot and exact net allocations',async()=>{const h=setup('APPROVED',{commission:{reversedAmountNgn:1000}});await h.run('MARK_PAID');assert.equal(h.row.status,'PAID');assert.ok(!h.writes.some(w=>w[0]==='deleteAllocations'));});
for(const options of [{payout:{accountVerifiedAt:null}},{partnerStatus:'SUSPENDED'},{commission:{onHold:true}},{payout:{amountNgn:9000}},{commission:{reversedAmountNgn:1000},payout:{amountNgn:6000}},{commission:{status:'PAID',reversedAmountNgn:1000}}])test(`settlement blocks invalid snapshot, partner, hold, allocations or debt: ${JSON.stringify(options)}`,async()=>{const h=setup('APPROVED',options);await assert.rejects(h.run('MARK_PAID'));assert.deepEqual(h.writes,[]);});
test('outstanding recovery is only the unreconciled part of paid reversals',()=>{assert.equal(outstandingRecovery({status:'PAID',reversedAmountNgn:1000,recoverySettledNgn:400}),600);assert.equal(outstandingRecovery({status:'APPROVED',reversedAmountNgn:1000}),0);});
const issues=load('lib/partnerPaymentIssues.ts',{'@/lib/db':{db:{}},'@/lib/paystack':{}});
test('partial refunds reduce commission proportionally; linked disputes are not double deducted',()=>{
 const rows=[{id:'refund:1',kind:'refund',state:'LOSS',amountKobo:200000,relatedIssueId:'dispute:1'},{id:'dispute:1',kind:'dispute',state:'LOSS',amountKobo:200000}];
 assert.deepEqual(issues.issueImpact(rows,10000,1000),{onHold:false,reversedAmountNgn:200});
 rows.push({id:'refund:2',kind:'refund',state:'LOSS',amountKobo:100000});assert.equal(issues.issueImpact(rows,10000,1000).reversedAmountNgn,300);
 assert.equal(issues.issueImpact([{kind:'refund',state:'LOSS',amountKobo:99999999}],10000,1000).reversedAmountNgn,1000);
});
test('open dispute holds payouts, failed refunds do not reverse earnings',()=>{
 assert.deepEqual(issues.issueImpact([{kind:'dispute',state:'HOLD',amountKobo:0},{kind:'refund',state:'CLEAR',amountKobo:0}],10000,1000),{onHold:true,reversedAmountNgn:0});
});
const lifecycle=load('lib/partnerLifecycle.ts');
test('expired dates override stored ACTIVE status, without changing disqualification',()=>{assert.equal(lifecycle.effectiveReferralStatus({status:'ACTIVE',commissionEndsAt:'2025-01-01'}),'EXPIRED');assert.equal(lifecycle.effectiveReferralStatus({status:'DISQUALIFIED',commissionEndsAt:'2025-01-01'}),'DISQUALIFIED');});

test('approved but unpaid requests can be cancelled without changing paid history',async()=>{const h=setup('APPROVED');await h.run('REJECT');assert.equal(h.row.status,'REJECTED');});
const server={'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},'@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})}};
test('bank save persists only provider-resolved identity and verification metadata',async()=>{
 let saved;
 const trusted={bankName:'Verified Bank',bankCode:'001',accountNumber:'0123456789',accountName:'Actual Holder',verifiedAt:new Date()};
 const db={partnerProfile:{findUnique:async()=>({id:'partner',status:'ACTIVE'})},$transaction:async fn=>fn({partnerPayoutAccount:{upsert:async args=>{saved=args;return trusted;}},partnerAuditEvent:{create:async()=>{}}})};
 const route=load('app/api/partners/payout-account/route.ts',{...server,'@/lib/db':{db},'@/lib/paystack':{resolveNigerianAccount:async(code,account)=>{assert.equal(code,'001');assert.equal(account,'0123456789');return trusted;}}});
 const result=await route.PUT({json:async()=>({bankCode:'001',accountNumber:'0123456789',bankName:'Forged Bank',accountName:'Forged Holder'})});
 assert.equal(result.status,200);assert.equal(saved.create.accountName,'Actual Holder');assert.equal(saved.update.accountName,'Actual Holder');assert.equal(saved.create.bankName,'Verified Bank');assert.equal(saved.create.verifiedAt,trusted.verifiedAt);
});
test('bank verification failure never saves unverified details',async()=>{
 let saved=false;const route=load('app/api/partners/payout-account/route.ts',{...server,'@/lib/db':{db:{partnerProfile:{findUnique:async()=>({id:'partner',status:'ACTIVE'})},$transaction:async()=>saved=true}},'@/lib/paystack':{resolveNigerianAccount:async()=>{throw Error('Could not verify');}}});
 assert.equal((await route.PUT({json:async()=>({bankCode:'001',accountNumber:'0123456789'})})).status,422);assert.equal(saved,false);
});
test('payout snapshots verified bank details and allocates net rather than reversed earnings',async()=>{
 let created;const account={id:'bank',bankCode:'001',bankName:'Bank',accountName:'Holder',accountNumber:'0123456789',verifiedAt:new Date()};
 const tx={partnerProfile:{findUnique:async()=>({status:'ACTIVE'})},partnerPayoutAccount:{findUnique:async()=>account},partnerPayout:{findFirst:async()=>null,create:async({data})=>{created=data;return{id:'payout',...data,payoutCommissions:[]}}},referralCommission:{findMany:async args=>args.where.status?[{id:'c',commissionAmountNgn:8000,reversedAmountNgn:1000}]:[]}};
 const route=load('app/api/partners/payouts/route.ts',{...server,'@/lib/db':{db:{partnerProfile:{findUnique:async()=>({id:'partner',status:'ACTIVE'})},$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}}}});
 assert.equal((await route.POST()).status,200);assert.equal(created.amountNgn,7000);assert.equal(created.payoutCommissions.create[0].amountNgn,7000);assert.equal(created.accountName,'Holder');account.accountName='Changed Later';assert.equal(created.accountName,'Holder');
});
test('provider issue recheck is idempotent and preserves confirmed loss on stale provider statuses',async()=>{
 const records=new Map();let provider={id:1,domain:'live',currency:'NGN',transaction:{reference:'pay'},status:'processed',amount:100000};
 const tx={partnerPaymentIssue:{findUnique:async({where})=>records.get(where.id),upsert:async({where,create,update})=>records.set(where.id,records.has(where.id)?{...records.get(where.id),...update}:create)},paymentRecord:{findUnique:async()=>null}};
 const service=load('lib/partnerPaymentIssues.ts',{'@/lib/db':{db:{$transaction:async fn=>fn(tx)}},'@/lib/paystack':{fetchPartnerPaymentIssue:async()=>provider}});
 await service.syncPartnerPaymentIssue('refund','1');await service.syncPartnerPaymentIssue('refund','1');assert.equal(records.size,1);assert.equal(records.get('refund:1').amountKobo,100000);
 provider={...provider,status:'pending'};await service.syncPartnerPaymentIssue('refund','1');assert.equal(records.get('refund:1').state,'LOSS');
});
for(const paid of [false,true])test(`payment issue reconciles ${paid?'paid history as recovery':'unpaid allocations safely'}`,async()=>{
 const writes=[];
 const commission={id:'c',paymentAmountNgn:10000,commissionAmountNgn:1000,reversedAmountNgn:0,onHold:false,recoverySettledNgn:0,status:paid?'PAID':'APPROVED',payoutAllocation:{payoutId:'payout',payout:{status:paid?'PAID':'APPROVED'}}};
 const tx={paymentRecord:{findUnique:async()=>({id:'pay',revenueStatus:'LIVE'})},referralCommission:{findUnique:async()=>commission,update:async({data})=>{writes.push(['commission',data]);Object.assign(commission,data);}},partnerPaymentIssue:{findMany:async()=>[{kind:'refund',state:'LOSS',amountKobo:500000}]},partnerPayout:{update:async()=>writes.push(['cancel'])},partnerPayoutCommission:{deleteMany:async()=>writes.push(['release'])},partnerAuditEvent:{create:async()=>{}}};
 await issues.reconcilePartnerIssues(tx,'reference');assert.equal(commission.reversedAmountNgn,500);assert.equal(commission.status,paid?'PAID':'APPROVED');
 assert.equal(writes.some(w=>w[0]==='release'),!paid);assert.equal(writes.some(w=>w[0]==='cancel'),!paid);
 const count=writes.length;await issues.reconcilePartnerIssues(tx,'reference');assert.equal(writes.length,count,'duplicate processing must not alter records again');
});
test('refund cannot reverse a non-live payment',async()=>{await issues.reconcilePartnerIssues({paymentRecord:{findUnique:async()=>({id:'pay',revenueStatus:'EXCLUDED'})}},'ref');});
test('admin totals exclude voided earnings and count only settled payouts',async()=>{
 const db={partnerProfile:{count:async()=>1,findMany:async()=>[]},referral:{findMany:async()=>[{status:'ACTIVE',commissionEndsAt:new Date('2020-01-01')}]},referralCommission:{groupBy:async()=>[],aggregate:async args=>{assert.deepEqual(args.where,{status:{not:'VOIDED'}});return{_sum:{commissionAmountNgn:8000,reversedAmountNgn:1000}};}},partnerPayout:{groupBy:async()=>[],aggregate:async args=>{assert.deepEqual(args.where,{status:'PAID'});return{_sum:{amountNgn:6000}};}}};
 const route=load('app/api/admin/partners/route.ts',{...server,'@/lib/admin':{isAdminEmail:()=>true},'@/lib/db':{db}});const result=await route.GET();assert.equal(result.body.overview.totalCommissions,7000);assert.equal(result.body.overview.totalPayouts,6000);assert.equal(result.body.referrals.expired,1);assert.equal(result.body.referrals.active,0);
});
