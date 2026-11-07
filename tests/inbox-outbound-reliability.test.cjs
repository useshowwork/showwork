const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers/load-typescript.cjs');
function fixture() {
 const ops = new Map(), messages = new Map(); const conversationWrites=[]; let sends=0, failProvider=false, failCommit=false;
 const ledger = {
  findUnique:async({where})=>ops.get(where.id)||null,
  findUniqueOrThrow:async({where})=>{const item=ops.get(where.id);assert.ok(item);return item;},
  findFirst:async({where})=>[...ops.values()].find(o=>o.conversationId===where.conversationId && (['PENDING','SENDING'].includes(o.state)||o.state==='UNCONFIRMED'&&!o.reviewedAt))||null,
  findMany:async()=>[...ops.values()].filter(o=>o.state==='SENDING'&&o.startedAt < new Date(Date.now()-120000)),
  create:async({data})=>{const item={...data,state:'PENDING',createdAt:new Date()};ops.set(item.id,item);return {...item};},
  updateMany:async({where,data})=>{const item=ops.get(where.id);if(!item||item.state!==where.state)return {count:0};Object.assign(item,data);return {count:1};},
  update:async({where,data})=>{if(failCommit&&data.state==='SENT')throw Error('database write failed');Object.assign(ops.get(where.id),data);return ops.get(where.id);},
 };
 const messageModel={create:async({data})=>{messages.set(data.id,data);return data;},findFirst:async({where})=>[...messages.values()].find(message=>message.providerMessageId===where.providerMessageId)||null,update:async({where,data})=>{Object.assign(messages.get(where.id),data);return messages.get(where.id);},updateMany:async({where,data})=>{const item=messages.get(where.id);if(item)Object.assign(item,data);return {count:item?1:0};},deleteMany:async({where})=>({count:messages.delete(where.id)?1:0})};
 const db={socialInboxOutbound:ledger,socialLeadMessage:messageModel,socialLeadConversation:{update:async()=>({}),updateMany:async args=>{conversationWrites.push(args);return {count:1};}}};
 db.$transaction=async callback=>{const opSnapshot=structuredClone([...ops]),msgSnapshot=structuredClone([...messages]);try{return await callback(db);}catch(e){ops.clear();messages.clear();for(const [k,v]of opSnapshot)ops.set(k,v);for(const[k,v]of msgSnapshot)messages.set(k,v);throw e;}};
 const api=load('lib/socialMessaging/outbound.ts',{'@/lib/db':{db}});
 const input={conversationId:'thread',operationKey:'same-operation',text:'A helpful reply',actorId:'staff',send:async()=>{sends++;assert.ok([...messages.values()].some(message=>message.status==='PENDING'),'durable pending message exists before IO');if(failProvider)throw Error('timeout after acceptance');return 'provider-id';}};
 return {api,input,ops,messages,conversationWrites,sends:()=>sends,providerFails:()=>failProvider=true,commitFails:()=>failCommit=true};
}
test('successful replay sends exactly once and rejects changed content on the same operation',async()=>{
 const f=fixture();assert.equal((await f.api.sendDurableInboxReply(f.input)).state,'SENT');assert.equal((await f.api.sendDurableInboxReply(f.input)).state,'SENT');assert.equal(f.sends(),1);
 await assert.rejects(f.api.sendDurableInboxReply({...f.input,text:'Different'}),/different reply/);
});
test('provider timeout remains unconfirmed on replay and blocks another operation',async()=>{
 const f=fixture();f.providerFails();const result=await f.api.sendDurableInboxReply(f.input);assert.equal(result.state,'UNCONFIRMED');assert.equal([...f.messages.values()][0].status,'FAILED');
 await f.api.sendDurableInboxReply(f.input);assert.equal(f.sends(),1);
 await assert.rejects(f.api.sendDurableInboxReply({...f.input,operationKey:'new'}),/Unconfirmed/);
});
test('provider acceptance followed by DB failure is not retried',async()=>{
 const f=fixture();f.commitFails();assert.equal((await f.api.sendDurableInboxReply(f.input)).state,'UNCONFIRMED');await f.api.sendDurableInboxReply(f.input);assert.equal(f.sends(),1);
});
test('an interrupted claimed operation is never re-sent and becomes unconfirmed when stale',async()=>{
 const f=fixture();await f.api.sendDurableInboxReply(f.input);const op=[...f.ops.values()][0];op.state='SENDING';op.startedAt=new Date(Date.now()-180000);[...f.messages.values()][0].status='PENDING';
 await f.api.sendDurableInboxReply(f.input);assert.equal(f.sends(),1);await f.api.reconcileStaleInboxSends('workspace');assert.equal(op.state,'UNCONFIRMED');assert.equal([...f.messages.values()][0].status,'FAILED');
});
test('a conversation change cancels before external IO',async()=>{
 const f=fixture();assert.equal((await f.api.sendDurableInboxReply({...f.input,beforeSend:async()=>false})).state,'CANCELLED');assert.equal(f.sends(),0);
});
test('manual platform check allows a future operation without replaying or claiming delivery',async()=>{
 const f=fixture();f.providerFails();await f.api.sendDurableInboxReply(f.input);const op=[...f.ops.values()][0];op.reviewedAt=new Date();await f.api.sendDurableInboxReply(f.input);assert.equal(f.sends(),1);assert.equal(op.state,'UNCONFIRMED');
 await f.api.sendDurableInboxReply({...f.input,operationKey:'new-after-check'});assert.equal(f.sends(),2);
});
test('cron accepts its configured secret and rejects missing or placeholder credentials',async()=>{
 const original=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only-secret';let calls=0;
 try {const route=load('app/api/cron/social-inbox-sync/route.ts',{'@/lib/socialMessaging/x':{syncSocialInboxes:async()=>{calls++;return {};}}});
 for(const [header,status] of [['Bearer undefined',401],['',401],['Bearer test-only-secret',200]])assert.equal((await route.POST(new Request('http://localhost/test',{method:'POST',headers:{authorization:header}}))).status,status);
 assert.equal(calls,1);} finally {if(original===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=original;}
});
test('delivery check requires reply permission, explicit confirmation and workspace-scoped ownership',async()=>{
 let permission=false,writes=[];
 const route=load('app/api/calendars/[id]/inbox/[conversationId]/delivery-check/route.ts',{'@/lib/auth':{getCurrentCreator:async()=>({id:'staff'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>permission,canAccessCalendarById:async()=>true,calendarFeatureGate:async()=>null},'@/lib/db':{db:{socialInboxOutbound:{updateMany:async args=>{writes.push(args);return {count:1};}}}}});
 const context={params:Promise.resolve({id:'workspace',conversationId:'thread'})};
 const request=confirmation=>new Request('http://localhost/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operationId:'operation',confirmation})});
 assert.equal((await route.POST(request('CHECKED_PLATFORM_INBOX'),context)).status,404);assert.equal(writes.length,0);
 permission=true;assert.equal((await route.POST(request('yes'),context)).status,400);assert.equal(writes.length,0);
 assert.equal((await route.POST(request('CHECKED_PLATFORM_INBOX'),context)).status,200);
 assert.deepEqual(writes[0].where,{id:'operation',conversationId:'thread',conversation:{calendarId:'workspace'},state:'UNCONFIRMED',reviewedAt:null});
 assert.equal(writes[0].data.reviewedByCreatorId,'staff');assert.equal(writes[0].data.state,undefined);
});

test('a duplicate arriving while provider IO is in flight cannot claim another send',async()=>{
 const f=fixture();let release, started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let sends=0;
 const input={...f.input,send:async()=>{sends++;started();await gate;return 'provider-id';}};
 const first=f.api.sendDurableInboxReply(input);await ready;
 assert.equal((await f.api.sendDurableInboxReply(input)).state,'SENDING');assert.equal(sends,1);
 release();assert.equal((await first).state,'SENT');assert.equal(sends,1);
});

test('a sent team offer stores consent context atomically with its durable message',async()=>{
 const f=fixture();const result=await f.api.sendDurableInboxReply({...f.input,handoffOffer:true,expectedControlVersion:7});
 assert.equal(result.state,'SENT');assert.equal(result.handoffOffer,true);const change=f.conversationWrites.find(item=>item.data.aiHandoffOfferMessageId);
 assert.equal(change.where.aiControlVersion,7);assert.equal(change.where.aiPausedAt,null);assert.equal(change.data.aiHandoffOfferMessageId,result.messageId);assert.ok(change.data.aiHandoffOfferedAt);
});
test('provider echoes arriving first are merged without duplicating the displayed message or losing read receipts',async()=>{
 const f=fixture();const result=await f.api.sendDurableInboxReply({...f.input,send:async()=>{f.messages.set('echo',{id:'echo',conversationId:'thread',providerMessageId:'echo-id',status:'READ',direction:'OUTBOUND',text:f.input.text});return 'echo-id';}});
 assert.equal(result.messageId,'echo');assert.equal(f.messages.size,1);assert.equal(f.messages.get('echo').status,'READ');assert.equal(f.messages.get('echo').sentByCreatorId,'staff');
});
