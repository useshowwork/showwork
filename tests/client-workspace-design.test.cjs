const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {load}=require('./helpers/load-typescript.cjs');
const {isClientView}=load('lib/support/visibility.ts');
test('client route detection includes delivery gates, public portfolios, review pages and tenant subdomains',()=>{
 for(const path of ['/social-calendar/brand','/portfolio/brand','/brand-project','/brand-project/files','/testimonial/brand','/portfolio/brand/'])assert.equal(isClientView(path,'useshowwork.com'),true,path);
 for(const host of ['brand.useshowwork.com','brand.localhost','brand.useshowwork.com:443'])assert.equal(isClientView('/',host),true,host);
 for(const path of ['/','/dashboard/portfolio','/dashboard/projects','/dashboard/calendars/id','/help/workspace','/delivery','/portfolio','/blog/story'])assert.equal(isClientView(path,'www.useshowwork.com'),false,path);
});
test('support restores WhatsApp while excluding Randy from client routes and tenant homepages',()=>{
 for(const [path,host,showRandy] of [['/social-calendar/brand','useshowwork.com',false],['/portfolio/brand','useshowwork.com',false],['/client-delivery','useshowwork.com',false],['/','brand.useshowwork.com',false],['/dashboard/projects','useshowwork.com',true]]){
 const Support=load('components/support/ShowworkSupport.tsx',{'react':{...React,useEffect(){},useState:()=>[host,()=>{}]},'next/navigation':{usePathname:()=>path},'./RandyAssistant':{__esModule:true,default:()=>React.createElement('div',null,'Randy widget')},'./WhatsAppSupport':{__esModule:true,default:()=>React.createElement('div',null,'WhatsApp support')}}).default;
 const html=renderToStaticMarkup(React.createElement(Support));assert.ok(html.includes('WhatsApp support'));assert.equal(html.includes('Randy widget'),showRandy,path);
 }
});
const stub={__esModule:true,default:()=>null};
function client(view,posts=[],logoUrl=null){const Client=load('components/calendars/ClientCalendarWorkspace.tsx',{'next/navigation':{useSearchParams:()=>new URLSearchParams({view})},'@/components/navigation/MobileDrawer':{...stub,NavigationToggle:()=>null},'@/components/calendars/CalendarReportingPanel':stub,'@/components/calendars/ClientCalendarView':stub,'@/components/calendars/SocialFeedPreview':stub,'@/components/calendars/InstagramPreview':stub,'@/components/calendars/TikTokPreview':stub}).default;return renderToStaticMarkup(React.createElement(Client,{slug:'brand',clientName:'Brand',logoUrl,planStatus:'PUBLISHED',displayTitle:'Your next chapter',displayDescription:'Your content, together.',desktopBannerUrl:null,mobileBannerUrl:null,posts,stats:{totalPosts:posts.length,approvedPosts:0,pendingPosts:posts.length,revisionPosts:0,totalAssets:0,approvalPercentage:0}}));}
test('client overview renders real empty-state counts, review actions and mobile navigation',()=>{const html=client('overview');for(const label of ['Your private review room','Shared posts','Approval progress','No content has been shared yet.','Client workspace navigation'])assert.ok(html.includes(label),label);assert.ok(!html.includes('Randy'));assert.ok(!html.includes('Your workspace is fully up to date'));});
test('client deep links do not render the overview hero and review cards show actual shared content',()=>{const post={id:'p',postDate:'2026-10-28T12:00:00.000Z',platform:'INSTAGRAM',postType:'PHOTO',category:null,caption:'A real caption',contentIdea:'Approved internally, ready for review',cta:null,hashtags:null,taggedAccounts:null,linkUrl:null,approvalStatus:'PENDING',approvalNote:null,assets:[],videoComments:[],customFields:[]};const html=client('review',[post]);assert.ok(html.includes('A fresh pair of eyes.'));assert.ok(html.includes(post.contentIdea));assert.ok(!html.includes('Your private review room'));assert.ok(!html.includes('No content has been shared yet.'));});
test('client entry has accessible password controls without changing unlock behavior',()=>{const Gate=load('components/calendars/CalendarPasswordGate.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/publishing/clientRequests':{calendarMutationFetch:()=>assert.fail('SSR must not unlock')}}).default;const html=renderToStaticMarkup(React.createElement(Gate,{slug:'brand',clientName:'Brand'}));for(const text of ['Your client workspace','Enter workspace','Show password','id="client-viewer-password"','autoComplete="current-password"'])assert.ok(html.includes(text),text);assert.ok(!html.includes('Randy'));});
test('restored WhatsApp control retains the original edge tab and support destination',()=>{
 let state=0;const WhatsApp=load('components/support/WhatsAppSupport.tsx',{'react':{...React,useEffect(){},useState:initial=>[state++===1?true:initial,()=>{}]},'next/navigation':{usePathname:()=>'/dashboard/calendars/brand'}}).default;
 const html=renderToStaticMarkup(React.createElement(WhatsApp));for(const text of ['data-showwork-whatsapp="true"','rounded-l-[14px]','top-1/2','https://wa.me/2347018819588?text=','Chat with Showwork Support on WhatsApp'])assert.ok(html.includes(text),text);
});

test('client workspace shows the uploaded logo and keeps social previews out of its menu', () => {
 const html = client('calendar', [], '/client-logo.webp');
 assert.ok(html.includes('src="/client-logo.webp"'));
 const menu = html.match(/<nav aria-label="Client workspace sections"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(menu);
 const labels = ['Content calendar', 'Analytics', 'Leads', 'Review centre', 'Overview'];
 let previous = -1;
 for (const name of labels) {
   const position = menu.indexOf(name);
   assert.ok(position > previous, `${name} is missing or out of order`);
   previous = position;
 }
 assert.doesNotMatch(menu, /Instagram|TikTok|LinkedIn|Facebook|Previews/);
});
