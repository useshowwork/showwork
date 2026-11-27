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
 assert.match(html,/href="\/signup\?next=%2Fdashboard%2Fcalendars"/);
 assert.match(html,/Get Started with Showwork/);assert.match(html,/href="\/delivery"/);assert.match(html,/href="\/portfolio"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(const id of ['main-content','how-it-works','tools','pricing','questions'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/Showwork Marketing Workspace · Sample data/);
 assert.match(html,/\/images\/landing\/business\/knowledge.webp/);
 assert.match(html,/<source media="\(max-width: 760px\)" srcSet="\/images\/landing\/1mobile.webp"/);
 assert.match(html,/fetchpriority="high"/i);
 assert.ok(!html.includes("dashboard.webp"),"do not substitute an illustrated dashboard for real screenshots");
});
test('Products menu links to four dedicated landing pages', () => {
 const html = renderToStaticMarkup(React.createElement(component));
 const products = html.match(/<details[^>]*><summary[^>]*>Products[\s\S]*?<\/details>/)?.[0];
 assert.ok(products, 'Products disclosure is present');
 assert.deepEqual(
  [...products.matchAll(/href="([^"]+)"/g)].map(([, href]) => href),
  ['/content-workspace', '/engage', '/delivery', '/portfolio'],
 );
});
test('Solutions menu retains five routes and the homepage has four audience links and one shared image', () => {
 const html = renderToStaticMarkup(React.createElement(component));
 const menu = html.match(/<details[^>]*><summary[^>]*>Solutions[\s\S]*?<\/details>/)?.[0];
 assert.ok(menu, 'Solutions disclosure is present');
 const routes = ['/solutions/marketing-agencies', '/solutions/businesses', '/solutions/social-media-managers', '/solutions/small-businesses-retailers', '/solutions/creatives'];
 assert.deepEqual([...menu.matchAll(/href="([^"]+)"/g)].map(([, href]) => href), routes);
 assert.match(menu, /href="\/solutions\/creatives">Creatives</);
 assert.doesNotMatch(menu, /Videographers|Photographers/);
 const solutions = html.match(/<section id="solutions"[\s\S]*?<\/section>/)?.[0];
 assert.ok(solutions);
 for (const route of routes.slice(0, 4)) assert.ok(solutions.includes(`href="${route}"`), route);
 assert.ok(!solutions.includes('href="/solutions/creatives"'));
 assert.equal((solutions.match(/<li\b/g)||[]).length,4);
 assert.equal((solutions.match(/<img\b/g)||[]).length,1);
});
test('signed-in visitors receive a direct route to their workspaces',()=>{
 const html=renderToStaticMarkup(React.createElement(component,{isLoggedIn:true}));
 assert.match(html,/href="\/dashboard\/calendars"/);assert.match(html,/Open your workspaces/);assert.ok(!html.includes('href="/signup?next='));
});
test('pricing and reply eligibility remain accessible and page anchors resolve',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.ok(html.indexOf('id="workspace"') < html.indexOf('id="tools"'));
 assert.match(html,/Randy starts at Growth/);
 assert.match(html,/12,900/);
 assert.match(html,/inbox drafts start at Studio/);
 assert.match(html,/Agency adds opt-in automatic replies/);
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

test('the problem highlights three issues and the flagship demo shows the five-step workflow once',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 const problem=html.match(/<section[^>]*aria-labelledby="problem-heading"[\s\S]*?<\/section>/)?.[0];
 assert.ok(problem);
 for (const title of ['Knowledge gets lost.','Work gets delayed.','Customers get missed.']) assert.ok(problem.includes(title),title);
 const workflow=html.match(/<section[^>]*id="workspace"[\s\S]*?<\/section>/)?.[0];
 assert.ok(workflow);
 for (const title of ['Business Knowledge','Content Planning','Approvals','Publishing','Reporting']) assert.ok(workflow.includes(title),title);
 assert.equal((workflow.match(/role="tab"/g)||[]).length,5);
 assert.ok(html.includes('/images/landing/9.webp'));
});

test('customer messaging and creative products use Showwork captures and link to their product pages',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 const inbox=html.match(/<section[^>]*id="customer-replies"[\s\S]*?<\/section>/)?.[0];
 assert.ok(inbox);
 assert.match(inbox,/href="\/engage"[^>]*>Explore AI Inbox/);
 assert.match(inbox,/inbox.webp/);
 assert.match(inbox,/WhatsApp, Instagram and Facebook/);
 assert.match(inbox,/Automatic replies are opt-in/);
 assert.match(html,/data-scroll-panel="replies"/);
 for (const asset of ['delivery','portfolio']) assert.ok(html.includes(`/images/landing/product/${asset}.webp`));
});
