const {test}=require('node:test');const assert=require('node:assert/strict');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {load}=require('./helpers/load-typescript.cjs');
const component=load('app/HomeClient.tsx',{
 'next/font/google':{Plus_Jakarta_Sans:()=>({variable:'font-jakarta'})},
 'next/image':{__esModule:true,default:({src,priority,sizes,fill,...props})=>React.createElement('img',{src:typeof src==='string'?src:src.src,...props})},
 'next/link':{__esModule:true,default:({children,href,...props})=>React.createElement('a',{href,...props},children)},
 '@/components/landing/BookDemoModal':{__esModule:true,default:()=>null},
 '@/components/landing/PricingSection':{__esModule:true,default:()=>React.createElement('section',{id:'pricing'},'Pricing')},
 '@/components/landing/SiteFooter':{__esModule:true,default:()=>null},
}).default;
test('homepage leads new visitors to a workspace trial and keeps secondary tool paths available',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.match(html,/href="\/signup\?next=\/dashboard\/calendars"/);
 assert.match(html,/Start your free trial/);assert.match(html,/href="\/delivery"/);assert.match(html,/href="\/portfolio"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(const id of ['main-content','how-it-works','tools','pricing','questions'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/Illustrative example/);
 assert.ok(!html.includes("/images/landing/product/"));
 assert.ok(!html.includes("/images/deli.png"));
 assert.match(html,/<source media="\(max-width: 760px\)" srcSet="\/images\/landing\/1mobile.webp"/);
 assert.match(html,/fetchpriority="high"/i);
 assert.ok(!html.includes("dashboard.webp"),"do not substitute an illustrated dashboard for real screenshots");
});
test('signed-in visitors receive a direct route to their workspaces',()=>{
 const html=renderToStaticMarkup(React.createElement(component,{isLoggedIn:true}));
 assert.match(html,/href="\/dashboard\/calendars"/);assert.match(html,/Open your workspaces/);assert.ok(!html.includes('href="/signup?next=/dashboard/calendars"'));
});
test('Randy is presented as Growth and above, with explicit confirmation and review boundaries',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.match(html,/Included from Growth/);assert.match(html,/12,900/);assert.match(html,/Research and knowledge updates need your confirmation/);assert.match(html,/Generating content creates drafts for review/);
});
test('workspace evaluation exposes intelligence and conversations before secondary products, with access limits',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.ok(html.indexOf('id="workspace"') < html.indexOf('id="tools"'));
 assert.match(html,/Advanced reporting &amp; AI recommendations from Studio/);
 assert.match(html,/Agency adds opt-in automatic replies/);
 assert.match(html,/metrics depend on the channel, permissions and synced history/);
 assert.match(html,/Explore Business Solutions/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,new Set(ids).size,'section destinations must be unique');
 for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(anchor),`Missing destination: ${anchor}`);
});

test('interactive showcases have labelled tabs and a single keyboard entry per tablist',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.equal((html.match(/role="tablist"/g)||[]).length,1);
 assert.equal((html.match(/role="tabpanel"/g)||[]).length,1);
 assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
 for(const prefix of ['feature']){
  assert.match(html,new RegExp(`id="${prefix}-0"[^>]*aria-selected="true"[^>]*tabindex="0"|id="${prefix}-0"[^>]*aria-selected="true"[^>]*tabIndex="0"`));
  assert.ok(html.includes(`aria-labelledby="${prefix}-0"`));
 }
});
test('supplied photography remains available with the dedicated mobile hero',()=>{
 const fs=require('node:fs');
 for(const name of ['1mobile',...Array.from({length:9},(_,i)=>String(i+1))])assert.ok(fs.existsSync(`public/images/landing/${name}.webp`));
});

test('problem stays text-only and the workflow avoids another repeated image showcase',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 const problem=html.match(/<section[^>]*aria-labelledby="problem-heading"[\s\S]*?<\/section>/)?.[0];
 assert.ok(problem);assert.ok(!/<img|<picture|<figure/.test(problem));
 const workflow=html.match(/<section[^>]*id="how-it-works"[\s\S]*?<\/section>/)?.[0];
 assert.ok(workflow);assert.ok(!/<img|<picture|<figure/.test(workflow));
 assert.ok(!html.includes('foundation-panel'));
});

test('process is a connected five-step accordion and team photography is restored',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 const workflow=html.match(/<section[^>]*id="how-it-works"[\s\S]*?<\/section>/)?.[0];
 assert.match(workflow,/<ol[^>]*aria-label="The five-stage marketing workflow"/);
 assert.equal((workflow.match(/aria-expanded="true"/g)||[]).length,1);
 assert.equal((workflow.match(/role="region"/g)||[]).length,5);
 for(let i=0;i<5;i++){assert.ok(workflow.includes(`aria-controls="stage-panel-${i}"`));assert.ok(workflow.includes(`id="stage-panel-${i}"`));}
 assert.match(html,/\/images\/landing\/4.webp/);
 assert.match(html,/\/images\/landing\/9.webp/);
 assert.ok(!html.includes('/images/landing/product/'));
});

test('after-hours enquiry solution leads to the highest workspace plan without starting payment',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.match(html,/Enquiries go unanswered/);
 const section=html.match(/<section[^>]*id="customer-replies"[\s\S]*?<\/section>/)?.[0];
 assert.ok(section);assert.match(section,/Customer interest doesn’t/);assert.match(section,/Book a demo/);
 assert.match(section,/href="\/dashboard\/billing\?product=content-workspace&amp;tier=UNLIMITED&amp;cycle=MONTHLY#workspace-plan-UNLIMITED"/);
 assert.match(section,/59,900/);assert.match(section,/messaging windows apply/);
 assert.match(section,/Automatic reply · example/);
});
