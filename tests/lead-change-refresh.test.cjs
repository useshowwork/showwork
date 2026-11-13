const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {announceLeadChange,subscribeLeadChanges}=load('lib/leadChanges.ts');
const previousWindow=global.window;
afterEach(()=>{if(previousWindow===undefined)delete global.window;else global.window=previousWindow;});
function setup(){const writes=[];global.window=new EventTarget();window.localStorage={setItem:(key,value)=>writes.push({key,value})};return writes;}
test('lead changes refresh matching manager panels and the client view without sharing lead data',()=>{
 const writes=setup();let same=0,other=0,client=0;
 const stops=[subscribeLeadChanges('workspace',()=>same++),subscribeLeadChanges('other',()=>other++),subscribeLeadChanges(undefined,()=>client++)];
 announceLeadChange('workspace');assert.equal(same,1);assert.equal(other,0);assert.equal(client,1);
 const payload=JSON.parse(writes[0].value);assert.equal(payload.calendarId,'workspace');assert.deepEqual(Object.keys(payload).sort(),['at','calendarId','nonce']);
 stops.forEach(stop=>stop());announceLeadChange('workspace');assert.equal(same,1);assert.equal(client,1);
});
test('another browser tab receives a safe refresh signal and malformed events are ignored',()=>{
 setup();let updates=0;const stop=subscribeLeadChanges('workspace',()=>updates++);
 const signal=value=>{const event=new Event('storage');event.key='showwork-leads-changed';event.newValue=value;window.dispatchEvent(event);};
 signal('not-json');signal(JSON.stringify({calendarId:'other'}));assert.equal(updates,0);
 signal(JSON.stringify({calendarId:'workspace'}));assert.equal(updates,1);stop();
});
test('same-tab refresh still works when local storage is unavailable',()=>{
 setup();window.localStorage.setItem=()=>{throw Error('Disabled storage');};let updates=0;subscribeLeadChanges('workspace',()=>updates++);
 assert.doesNotThrow(()=>announceLeadChange('workspace'));assert.equal(updates,1);
});
