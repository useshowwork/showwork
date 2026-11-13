const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {createReportingRequestGate}=load('lib/reporting/requestGate.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('polling and tab-focus refreshes share a slow report request instead of starving its result',async()=>{
 const gate=createReportingRequestGate(),pending=deferred();let calls=0;
 const read=()=>{calls++;return pending.promise;};
 const first=gate.run('workspace:period:channels',read);
 for(let i=0;i<8;i++)assert.equal(gate.run('workspace:period:channels',read),first);
 assert.equal(calls,1);pending.resolve({reach:120});assert.deepEqual(await first,{reach:120});
 assert.deepEqual(await gate.run('workspace:period:channels',async()=>({reach:135})),{reach:135});
});
test('manual sync waits for an existing read then fetches fresh data immediately',async()=>{
 const gate=createReportingRequestGate(),pending=deferred();const first=gate.run('report',()=>pending.promise);let freshReads=0;
 const updated=gate.run('report',async()=>{freshReads++;return 'new results';},true);
 assert.equal(freshReads,0);pending.resolve('saved results');assert.equal(await first,'saved results');assert.equal(await updated,'new results');assert.equal(freshReads,1);
});
test('workspace and filter queries never share data',async()=>{
 const gate=createReportingRequestGate(),pending=deferred();const first=gate.run('workspace-a:30days',()=>pending.promise);
 assert.equal(await gate.run('workspace-b:30days',async()=>42),42);
 assert.equal(await gate.run('workspace-a:7days',async()=>7),7);
 pending.resolve(30);assert.equal(await first,30);
});
test('invalidating a channel request allows a new read and old completion cannot clear it',async()=>{
 const gate=createReportingRequestGate(),old=deferred(),fresh=deferred();const first=gate.run('report',()=>old.promise);gate.clear();
 const next=gate.run('report',()=>fresh.promise);old.resolve('old account');await first;
 assert.equal(gate.run('report',()=>assert.fail('must retain fresh in-flight request')),next);
 fresh.resolve('current account');assert.equal(await next,'current account');
});
test('failed refreshes release the gate and can be retried',async()=>{
 const gate=createReportingRequestGate();await assert.rejects(gate.run('report',async()=>{throw Error('Temporary failure');}),/Temporary failure/);
 assert.equal(await gate.run('report',async()=>99),99);
});
