const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {load}=require('./helpers/load-typescript.cjs');
test('canonical callback uses real shared discovery, keeps Page tokens and reconnects without Insights',async()=>{
 const old={INSTAGRAM_APP_ID:process.env.INSTAGRAM_APP_ID,INSTAGRAM_APP_SECRET:process.env.INSTAGRAM_APP_SECRET};
 process.env.INSTAGRAM_APP_ID='app';process.env.INSTAGRAM_APP_SECRET='secret';
 try {
  for(const existing of [undefined,{providerAccountId:'ig'},{providerAccountId:'ig',savedPage:true}]) {
   const binds=[],http=[],queries=[];
   const fetch=async(url,init)=>{
    const u=new URL(url);http.push(u.pathname);
    if(u.pathname.endsWith('/debug_token'))return Response.json({data:{is_valid:true,type:'USER',app_id:'app',user_id:'user',scopes:['pages_show_list','pages_read_engagement','instagram_basic','instagram_content_publish'],granular_scopes:existing?.savedPage?[]:[{scope:'pages_show_list',target_ids:['123']}]}});
    if(u.pathname.endsWith('/me/accounts'))return Response.json({data:[]});
    if((u.pathname.endsWith('/123')||u.pathname.endsWith('/381092961751993'))&&u.searchParams.get('fields').includes('access_token'))return Response.json({id:existing?.savedPage?'381092961751993':'123',name:'Business',access_token:'verified-page-token'});
    if(u.pathname.endsWith('/123')||u.pathname.endsWith('/381092961751993')){assert.equal(init.headers.Authorization,'Bearer user-token');return Response.json({instagram_business_account:{id:'ig',username:'creator'}});}
    throw Error('Unexpected request');
   };
   const mocks={
    '@/lib/publishing/executionContext':{publishingFetch:fetch},
    '../channelOAuthState':{verifyChannelOAuthState:()=> 'workspace',channelOAuthCookieOptions:()=>({path:'/'})},
    '../url':{appUrl:()=> 'https://showwork.test'},
    './validationAdapters':{createPublishingValidationAdapters:()=>({lockForPolicyChange:async()=>{},validateWorkspacePermission:async()=>{}})},
   };
   const {createCanonicalShowworkOAuth}=load('lib/publishing/showworkOAuth.ts',mocks);
   const invoke=createCanonicalShowworkOAuth({
    database:{transaction:async fn=>fn({query:async(sql,args)=>{queries.push(sql);return {rows:sql.includes('FROM "SocialCalendar"')&&existing?.savedPage?[{instagramPageId:'381092961751993'}]:sql.startsWith('SELECT v.')&&existing?[existing]:[]};}})},
    policy:{},authenticate:async()=>({id:'owner'}),fetch,
    actions:{bindVerifiedAccount:async value=>binds.push(value)},
    services:{instagramExchange:async()=>({access_token:'short'}),instagramLong:async()=>({access_token:'user-token',expires_in:3600}),instagramPermissions:async()=>['instagram_basic','instagram_content_publish'],instagramUsername:async(id,token)=>{assert.equal(id,'ig');assert.equal(token,'verified-page-token');return 'creator';}},
   });
   const request=new NextRequest('https://showwork.test/api/calendars/instagram/callback?code=new-code&state=signed');
   const response=await invoke('app/api/calendars/instagram/callback/route.ts#GET@27',[request]);
   assert.equal(response.status,307);assert.equal(binds.length,1);assert.equal(binds[0].evidence.instagramPageId,existing?.savedPage?'381092961751993':'123');assert.equal(binds[0].evidence.accessToken,'verified-page-token');assert.ok(!binds[0].evidence.tokenScopes.includes('insights'));assert.ok(http.some(path=>path.endsWith('/debug_token')));
  }
 } finally {for(const [key,value] of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

test('canonical picker retains safe discovery diagnostics and never returns selection credentials',async()=>{
 const old=process.env.JWT_SECRET;process.env.JWT_SECRET='meta-test-selection-secret';
 try {
  const {createFacebookPageSelection}=load('lib/facebookPageSelection.ts');
  const diagnostics={discoveryStatus:'DISCOVERY_INCOMPLETE',facebookPagesFound:2,instagramAccountsFound:1,businessDiscovery:'NOT_GRANTED',sources:{accounts:1,granular:1,business:0},issues:[{stage:'instagram_link',code:'META_PAGE_ACCESS_FAILED',providerCode:100}]};
  const selection=createFacebookPageSelection({calendarId:'workspace-a',pages:[{id:JSON.stringify({pageId:'101',accountId:'ig-101'}),name:'Client A',accessToken:'secret-page-token'}],grantedPermissions:['instagram_basic'],userTokenExpiresAt:Date.now()+60000,diagnostics});
  const {createCanonicalShowworkOAuth}=load('lib/publishing/showworkOAuth.ts',{
   './validationAdapters':{createPublishingValidationAdapters:()=>({validateWorkspacePermission:async()=>{}})},
  });
  const invoke=createCanonicalShowworkOAuth({database:{transaction:async fn=>fn({query:async sql=>({rows:sql.includes('PublishingApplicationOperation')?[{result:{encryptedSelection:selection.value}}]:[]})})},actions:{},policy:{},authenticate:async()=>({id:'manager'})});
  for(const id of ['workspace-a','workspace-b']) {
   const response=await invoke('app/api/calendars/[id]/instagram/select-account/route.ts#GET',[new NextRequest(`https://showwork.test/api/calendars/${id}/instagram/select-account`,{headers:{cookie:'showwork_instagram_account_selection=ticket'}}),{params:Promise.resolve({id})}]);
   assert.equal(response.status,id==='workspace-a'?200:409);
   const text=await response.text();assert.ok(!text.includes('secret-page-token'));assert.ok(!text.includes(selection.value));
   if(id==='workspace-a')assert.deepEqual(JSON.parse(text).diagnostics,diagnostics);
  }
 } finally {if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old;}
});

test('canonical Facebook callback uses current workspace Instagram Page as a verified discovery hint',async()=>{
 const saved=process.env.JWT_SECRET;process.env.JWT_SECRET='test-facebook-selection-secret';
 try {
 const calls=[],permissions=[];
 const {createCanonicalShowworkOAuth}=load('lib/publishing/showworkOAuth.ts',{
  '../channelOAuthState':{verifyChannelOAuthState:()=> 'workspace',channelOAuthCookieOptions:()=>({path:'/'})},
  '../url':{appUrl:()=> 'https://showwork.test'},
  './validationAdapters':{createPublishingValidationAdapters:()=>({lockForPolicyChange:async()=>{},validateWorkspacePermission:async(tx,value)=>permissions.push(value)})},
 });
 const invoke=createCanonicalShowworkOAuth({database:{transaction:async fn=>fn({query:async(sql,args)=>{
  if(sql.includes('FROM "SocialCalendar"')){assert.deepEqual(args,['workspace']);return {rows:[{instagramPageId:'381092961751993',facebookPageId:null}]};}
  return {rows:[]};
 }})},policy:{},authenticate:async()=>({id:'invited-manager'}),actions:{},services:{
  exchange:async()=>({access_token:'short'}),facebookLong:async()=>({access_token:'fresh-facebook-user'}),
  facebookPages:async(...args)=>{calls.push(args);return [{id:'381092961751993',name:'Useshowwork',access_token:'fresh-facebook-page'}];},
  facebookPermissions:async()=>['pages_show_list'],
 }});
 const response=await invoke('app/api/calendars/channels/[channel]/callback/route.ts',[new NextRequest('https://showwork.test/api/calendars/channels/facebook/callback?code=code&state=state'),{params:Promise.resolve({channel:'facebook'})}]);
 assert.equal(response.status,307);assert.match(response.headers.get('location'),/workspace\/facebook\/select-page/);
 assert.deepEqual(calls,[['fresh-facebook-user',['381092961751993']]]);
 assert.ok(permissions.some(p=>p.actor==='invited-manager'&&p.calendarId==='workspace'&&p.permission==='channels.manage'));
 }finally{if(saved===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=saved;}
});
