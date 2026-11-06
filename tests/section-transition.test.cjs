const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');

test('whole content panel opens with scroll, reverses, respects motion preference and cleans up',()=>{
 const originalWindow=global.window, originalObserver=global.IntersectionObserver, originalDocument=global.document;
 let top=900, effect, observer, motionChange;
 const values=new Map(), listeners=new Map(), frames=new Map();let nextFrame=0;
 const element={style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)},getBoundingClientRect:()=>({top})};
 const media={matches:false,addEventListener:(_,fn)=>{motionChange=fn;},removeEventListener:()=>{motionChange=null;}};
 global.document={querySelector:()=>({getBoundingClientRect:()=>({bottom:86})})};
 global.window={innerWidth:1440,innerHeight:900,matchMedia:()=>media,
  addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
  requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)};
 global.IntersectionObserver=class{constructor(fn){this.callback=fn;observer=this;}observe(){}unobserve(){}disconnect(){this.disconnected=true;}};
 try{
  const View=load('components/landing/SectionTransition.tsx',{'react':{...React,useRef:()=>({current:element}),useEffect:fn=>{effect=fn;}}}).default;
  View({variant:'opening',children:'Real section content'});const cleanup=effect();
  const inset=()=>Number.parseFloat(values.get('--panel-inset'));
  const initial=inset();assert.ok(initial>0);
  observer.callback([{isIntersecting:true}]);
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  top=450;listeners.get('scroll')();flush();assert.equal(inset(),initial,"hold the inset silhouette until the panel is well inside the viewport");
  top=230;listeners.get('scroll')();flush();const middle=inset();assert.ok(middle>0&&middle<initial);
  top=86;listeners.get('scroll')();flush();assert.equal(inset(),0);
  top=230;listeners.get('scroll')();flush();assert.equal(inset(),middle);
  media.matches=true;motionChange();assert.equal(values.size,0);assert.equal(listeners.size,0);
  media.matches=false;motionChange();observer.callback([{isIntersecting:true}]);assert.ok(listeners.has('scroll'));
  cleanup();assert.equal(listeners.size,0);assert.equal(frames.size,0);assert.ok(observer.disconnected);assert.equal(values.size,0);
 }finally{global.window=originalWindow;global.IntersectionObserver=originalObserver;global.document=originalDocument;}
});

test('a short footer reaches full width at the bottom of the document',()=>{
 const saved={window:global.window,document:global.document,observer:global.IntersectionObserver};
 const values=new Map();let effect;
 const element={offsetHeight:600,style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)},getBoundingClientRect:()=>({top:300})};
 global.document={querySelector:()=>({getBoundingClientRect:()=>({bottom:86})})};
 global.window={innerWidth:1440,innerHeight:900,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),removeEventListener(){},cancelAnimationFrame(){}};
 global.IntersectionObserver=class{observe(){}disconnect(){}};
 try{
  const View=load('components/landing/SectionTransition.tsx',{'react':{...React,useRef:()=>({current:element}),useEffect:fn=>{effect=fn;}}}).default;
  View({variant:'footer',children:'Footer navigation'});const cleanup=effect();
  assert.equal(values.get('--panel-inset'),'0.00px');assert.equal(values.get('--panel-left'),'0.00px');cleanup();
 }finally{global.window=saved.window;global.document=saved.document;global.IntersectionObserver=saved.observer;}
});

test('a tall phone section pins only after its lower content can be read',()=>{
 const saved={window:global.window,document:global.document,observer:global.IntersectionObserver};
 const values=new Map(),backdropValues=new Map();let effect;
 const backdrop={offsetHeight:1200,style:{setProperty:(key,value)=>backdropValues.set(key,value),removeProperty:key=>backdropValues.delete(key)}};
 const element={previousElementSibling:backdrop,style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)},getBoundingClientRect:()=>({top:500})};
 global.document={querySelector:()=>({getBoundingClientRect:()=>({bottom:76})})};
 global.window={innerWidth:390,innerHeight:844,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),removeEventListener(){},cancelAnimationFrame(){}};
 global.IntersectionObserver=class{observe(){}disconnect(){}};
 try{
  const View=load('components/landing/SectionTransition.tsx',{'react':{...React,useRef:()=>({current:element}),useEffect:fn=>{effect=fn;}}}).default;
  View({variant:'process',children:'Workflow'});const cleanup=effect();
  assert.equal(backdropValues.get('--scene-sticky-top'),'-356px');
  assert.equal(values.get('--panel-min-height'),'1200px');
  assert.ok(Number.parseFloat(values.get('--panel-inset'))>0);
  cleanup();assert.equal(backdropValues.size,0);
 }finally{global.window=saved.window;global.document=saved.document;global.IntersectionObserver=saved.observer;}
});
