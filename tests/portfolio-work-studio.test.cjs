const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');
const sections=[{id:'photos',name:'Photography',mediaType:'PHOTO',coverMediaId:null,media:[{id:'one',url:'/photo.jpg',posterUrl:null,filename:'photo.jpg',type:'PHOTO'}]},{id:'films',name:'Brand films',mediaType:'VIDEO',coverMediaId:null,media:[]}];
function render(items=sections,selected){
 let state=0;const changes=[];const stub={default:()=>null,__esModule:true};
 const Studio=load('components/portfolio/PortfolioWorkStudio.tsx',{
  react:{...React,useState(initial){const index=state++;return[index===0&&selected?selected:initial,value=>changes.push({index,value})];}},
  './PortfolioAddSection':stub,'./PortfolioSectionHeader':stub,'./PortfolioFileGridItem':stub,
 }).default;
 const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(Studio({sections:items}));return{nodes,changes};
}
test('section selection exposes one gallery while keeping all panels mounted',()=>{
 const {nodes,changes}=render();const panels=nodes.filter(node=>node.type==='section');assert.equal(panels.length,2);assert.equal(panels.filter(node=>!node.props.hidden).length,1);assert.equal(panels.find(node=>!node.props.hidden).props.id,'portfolio-section-photos');
 const films=nodes.find(node=>node.type==='button'&&node.props['aria-controls']==='portfolio-section-films');const originalDocument=global.document;let pauses=0;global.document={getElementById:()=>({querySelectorAll:()=>[{pause(){pauses++;}}]})};try{films.props.onClick();assert.equal(pauses,1);}finally{global.document=originalDocument;}assert.deepEqual(changes,[{index:0,value:'films'}]);
 const updated=render(sections,'films').nodes.filter(node=>node.type==='section');assert.equal(updated.find(node=>!node.props.hidden).props.id,'portfolio-section-films');
});
test('deleted selection falls back to an existing section',()=>{
 const {nodes}=render([sections[1]],'photos');assert.equal(nodes.find(node=>node.type==='section'&&!node.props.hidden).props.id,'portfolio-section-films');
});
test('empty portfolio keeps the section creation action available',()=>{
 const {nodes}=render([]);assert.ok(nodes.some(node=>node.props.compact===true&&node.props.hasSections===false));assert.equal(nodes.filter(node=>node.type==='section').length,0);
});
