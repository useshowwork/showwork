const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const fs=require('node:fs');
const {load}=require('./helpers/load-typescript.cjs');
const stub={default:()=>null,__esModule:true};
const {PostTile}=load('components/calendars/ClientCalendarView.tsx',{
 '@/lib/publishing/clientRequests':{},'next/navigation':{useRouter:()=>({})},
 '@/components/calendars/CalendarVideoComments':stub,'@/components/calendars/SocialFeedPreview':stub,'@/components/calendars/InstagramPreview':stub,'@/components/calendars/TikTokPreview':stub,'@/components/calendars/SocialLeadInbox':stub,
});
const base={id:'post',postDate:'2026-11-05T12:00:00Z',platform:'INSTAGRAM',approvalStatus:'PENDING',contentIdea:'Campaign portrait',caption:'The story behind the campaign.',assets:[{id:'image',mediaType:'PHOTO',contentUrl:'/portrait.jpg'}]};
function nodes(tree){const list=[];function visit(node){if(!node||typeof node!=='object')return;list.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);return list;}
test('the whole post is an accessible button opening its review dialog',()=>{let opened=0;const tree=PostTile({post:base,onClick:()=>opened++});assert.equal(tree.type,'button');assert.equal(tree.props['aria-haspopup'],'dialog');assert.match(tree.props['aria-label'],/Campaign portrait/);tree.props.onClick();assert.equal(opened,1);assert.ok(nodes(tree).some(node=>node.props.className==='openPost'));});
test('photo cards use natural dimensions without a landscape crop',()=>{const photo=nodes(PostTile({post:base,onClick(){}})).find(node=>node.type==='img');assert.equal(photo.props.className,'fullMedia');const css=fs.readFileSync('components/calendars/ClientContentCalendar.module.css','utf8');assert.match(css,/\.fullMedia\{[^}]*width:100%;height:auto;[^}]*object-fit:contain/);assert.doesNotMatch(photo.props.className,/object-cover|aspect-video/);});
test('documents display a useful placeholder rather than a broken image',()=>{const tree=PostTile({post:{...base,assets:[{id:'doc',mediaType:'PDF',contentUrl:'/deck.pdf'}]},onClick(){}});assert.ok(!nodes(tree).some(node=>node.type==='img'));assert.ok(nodes(tree).some(node=>node.props.children==='Document attached'));});
