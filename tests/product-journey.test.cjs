const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const journey=load('lib/productJourney.ts');
for(const [product,home] of Object.entries({workspace:'/dashboard/calendars',delivery:'/dashboard/projects',portfolio:'/dashboard/portfolio'})) {
 test(`${product} retains its destination through signup and login`,()=>{
  const href=journey.productEntryHref(product);
  const query=new URL(href,'https://example.com').searchParams;
  assert.deepEqual(journey.readProductJourney(query),{product,destination:home});
  assert.equal(journey.productEntryHref(product,{signedIn:true}),home);
  assert.equal(journey.readProductJourney(new URLSearchParams({next:query.get('next')})).destination,home);
 });
}
for(const [product,plans] of Object.entries({workspace:['CREATOR','GROWTH','STUDIO','UNLIMITED'],delivery:['STARTER','GROWTH','UNLIMITED']}))for(const plan of plans)for(const cycle of ['MONTHLY','ANNUAL']) {
 test(`${product} ${plan} ${cycle} survives authentication intact`,()=>{
  const href=journey.productEntryHref(product,{plan,cycle});
  const result=journey.readProductJourney(new URL(href,'https://example.com').searchParams);
  const url=new URL(result.destination,'https://example.com');
  assert.equal(result.product,product);assert.equal(url.pathname,'/dashboard/billing');
  assert.equal(url.searchParams.get('product'),product==='workspace'?'content-workspace':'delivery');
  assert.equal(url.searchParams.get('tier'),plan);assert.equal(url.searchParams.get('cycle'),cycle);
  assert.equal(url.hash,`#${product==='workspace'?'workspace':'delivery'}-plan-${plan}`);
 });
}
test('legacy pricing links are upgraded without losing the plan',()=>{
 const result=journey.readProductJourney(new URLSearchParams({next:'/dashboard/calendars',plan:'GROWTH',cycle:'annual'}));
 assert.equal(result.destination,journey.productDestination('workspace','GROWTH','ANNUAL'));
});
test('free product links and unrelated internal invitations keep their destinations',()=>{
 assert.equal(journey.productDestination('delivery','FREE'),'/dashboard/projects');
 assert.equal(journey.productDestination('portfolio','UNLIMITED'),'/dashboard/portfolio');
 assert.equal(journey.readProductJourney(new URLSearchParams({next:'/invite/abc?token=xyz'})).destination,'/invite/abc?token=xyz');
});
test('external return URLs are rejected',()=>{
 for(const next of ['https://evil.test','//evil.test','/\\evil.test','/\nevil.test'])assert.equal(journey.safeAuthReturn(next),null);
});
for(const screen of ['signup','login'])test(`authenticated visitors bypass ${screen} and retain their selected tier`,async()=>{
 const destination=journey.productDestination('workspace','UNLIMITED','ANNUAL');
 const Page=load(`app/${screen}/page.tsx`,{
  'next/navigation':{redirect:location=>{throw new Error('redirect:'+location)}},
  '@/lib/auth':{getCurrentCreator:async()=>({id:'existing'})},
  [`./${screen==='signup'?'Signup':'Login'}Client`]:{__esModule:true,default:()=>null},
 }).default;
 await assert.rejects(Page({searchParams:Promise.resolve({next:destination})}),{message:'redirect:'+destination});
});
const React=require('react');
function nodes(tree,predicate,result=[]) {
 if(!tree||typeof tree!=='object')return result;
 if(Array.isArray(tree)){for(const item of tree)nodes(item,predicate,result);return result;}
 if(predicate(tree))result.push(tree);
 nodes(tree.props?.children,predicate,result);return result;
}
for(const product of ['workspace','delivery','portfolio'])test(`${product} verification and login navigate directly to the requested app or plan`,async()=>{
 const destination=journey.productDestination(product,product==='portfolio'?null:'GROWTH','ANNUAL');
 for(const screen of ['signup','login']) {
  const states=[];let index=0;const pushes=[];
  const Component=load(`app/${screen}/${screen==='signup'?'Signup':'Login'}Client.tsx`,{
   react:{...React,useState:initial=>{const slot=index++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return [states[slot],value=>states[slot]=typeof value==='function'?value(states[slot]):value];}},
   'next/navigation':{useSearchParams:()=>new URLSearchParams({next:destination}),useRouter:()=>({push:value=>pushes.push(value)})},
  }).default;
  const Form=Component().props.children.type;
  const render=()=>{index=0;return Form();};
  const previousFetch=global.fetch;const requests=[];
  global.fetch=async(url)=>{requests.push(url);return {ok:true};};
  try {
   let tree=render();
   const crosslink=nodes(tree,n=>typeof n.props?.href==='string'&&n.props.href.startsWith(screen==='signup'?'/login?':'/signup?'))[0];
   assert.equal(new URL(crosslink.props.href,'https://example.com').searchParams.get('next'),destination);
   await nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
   if(screen==='signup'){
    assert.equal(pushes.length,0,'verification must happen before navigation');
    tree=render();
    await nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
    assert.deepEqual(requests,['/api/auth/signup','/api/auth/verify-otp']);
   }
   assert.deepEqual(pushes,[destination]);
  } finally {global.fetch=previousFetch;}
 }
});
for(const product of ['workspace','delivery'])for(const cycle of ['monthly','annual'])test(`rendered ${product} ${cycle} pricing buttons carry their own plan`,()=>{
 let hook=0;
 const Pricing=load('components/landing/PricingSection.tsx',{react:{...React,useState:()=>[hook++===0?product:cycle,()=>{}]}}).default;
 const tree=Pricing({compact:true});
 const links=nodes(tree,n=>typeof n.props?.href==='string'&&n.props.href.startsWith('/signup?next='));
 const destinations=links.map(n=>journey.readProductJourney(new URL(n.props.href,'https://example.com').searchParams).destination);
 const expected=product==='workspace'?['CREATOR','GROWTH','STUDIO','UNLIMITED']:['STARTER','GROWTH','UNLIMITED'];
 for(const plan of expected)assert.ok(destinations.includes(journey.productDestination(product,plan,cycle)),`Missing ${plan}`);
 if(product==='delivery')assert.ok(destinations.includes('/dashboard/projects'));
 assert.ok(destinations.includes('/dashboard/portfolio'));
});
