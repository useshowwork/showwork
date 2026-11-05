const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');
function render(enableRandy,path='/dashboard/calendars'){
 const updates=[];let state=0;
 const hooks={...React,useEffect(){},useRef(){return {current:null}},useState(initial){const index=state++;return [index<2?true:initial,value=>updates.push({index,value})];}};
 const Support=load('components/support/WhatsAppSupport.tsx',{'react':hooks,'next/navigation':{usePathname:()=>path}}).default;
 const elements=[];
 function visit(node){if(!node||typeof node!=='object')return;elements.push(node);React.Children.forEach(node.props?.children,visit);}
 visit(Support({enableRandy}));return {elements,updates};
}
test('one chat launcher exposes Randy and an external WhatsApp team conversation',()=>{
 const {elements,updates}=render(true);
 assert.equal(elements.filter(node=>node.props['data-showwork-chat-launcher']!==undefined).length,1);
 const whatsapp=elements.find(node=>node.type==='a');assert.equal(new URL(whatsapp.props.href).hostname,'wa.me');assert.equal(whatsapp.props.target,'_blank');assert.equal(whatsapp.props.rel,'noopener noreferrer');
 const randy=elements.find(node=>node.type==='button'&&node.props.className==='choice');assert.ok(randy);
 const original=global.window;const events=[];global.window={dispatchEvent:event=>events.push(event.type)};
 try{randy.props.onClick();assert.deepEqual(events,['showwork-randy-open']);assert.deepEqual(updates,[{index:0,value:false}]);}finally{global.window=original;}
});
test('client views offer team support without a Randy choice; authentication pages hide support',()=>{
 const client=render(false);assert.equal(client.elements.filter(node=>node.type==='a').length,1);assert.equal(client.elements.filter(node=>node.type==='button'&&node.props.className==='choice').length,0);
 assert.equal(render(true,'/login').elements.length,0);
});
test('shared launcher hides the separate Randy bubble while keeping the assistant mounted',()=>{
 let state=0;
 const hooks={...React,useEffect(){},useRef(){return {current:null}},useState(initial){const index=state++;return [index===1?true:typeof initial==='function'?initial():initial,()=>{}];}};
 const Assistant=load('components/support/RandyAssistant.tsx',{'react':hooks,'next/navigation':{usePathname:()=>'/dashboard'}}).default;
 const tree=Assistant({hideLauncher:true});const elements=[];
 function visit(node){if(!node||typeof node!=='object')return;elements.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);
 assert.ok(elements.some(node=>node.type==='dialog'));assert.equal(elements.filter(node=>node.props['data-randy-launcher']!==undefined).length,0);
});
