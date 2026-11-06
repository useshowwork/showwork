const {test}=require('node:test');const assert=require('node:assert/strict');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {load}=require('./helpers/load-typescript.cjs');
const component=load('app/HomeClient.tsx',{
 'next/font/google':{Plus_Jakarta_Sans:()=>({variable:'font-jakarta'})},
 'next/image':{__esModule:true,default:({src,priority,sizes,...props})=>React.createElement('img',{src:typeof src==='string'?src:src.src,...props})},
 'next/link':{__esModule:true,default:({children,href,...props})=>React.createElement('a',{href,...props},children)},
 '@/public/images/dashboard.webp':{__esModule:true,default:{src:'/images/dashboard.webp'}},
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
 assert.match(html,/Product illustration/);assert.match(html,/Example workflow/);assert.match(html,/Example chat/);
});
test('signed-in visitors receive a direct route to their workspaces',()=>{
 const html=renderToStaticMarkup(React.createElement(component,{isLoggedIn:true}));
 assert.match(html,/href="\/dashboard\/calendars"/);assert.match(html,/Open your workspaces/);assert.ok(!html.includes('href="/signup?next=/dashboard/calendars"'));
});
test('Randy is presented as Growth and above, with explicit confirmation and review boundaries',()=>{
 const html=renderToStaticMarkup(React.createElement(component));
 assert.match(html,/Included from Growth/);assert.match(html,/12,900/);assert.match(html,/Research and knowledge updates need your confirmation/);assert.match(html,/Generating content creates drafts for review/);
});
