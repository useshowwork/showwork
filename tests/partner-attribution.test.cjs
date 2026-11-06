const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');const {NextRequest}=require('next/server');
const {middleware}=load('middleware.ts');
test('referral persists as a 30-day HttpOnly cookie during product browsing',()=>{
 const result=middleware(new NextRequest('https://useshowwork.com/?ref=abcdef1234'));
 const cookie=result.cookies.get('showwork_referral');assert.equal(cookie.value,'ABCDEF1234');
 const header=result.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Max-Age=2592000/);assert.match(header,/SameSite=lax/i);
});
test('ordinary browsing does not clear attribution or create a false code',()=>{
 assert.equal(middleware(new NextRequest('https://useshowwork.com/delivery')).cookies.get('showwork_referral'),undefined);
 assert.equal(middleware(new NextRequest('https://useshowwork.com/?ref=%3Cscript%3E')).cookies.get('showwork_referral'),undefined);
});
for(const active of [true,false])test(`signup validates persisted partner eligibility (${active}) before attribution`,async()=>{
 let saved;const route=load('app/api/auth/signup/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},
  'next/headers':{cookies:async()=>({get:()=>({value:'ABCDEF1234'})})},
  '@/lib/auth':{hashPassword:async()=> 'hash'},'@/lib/resend':{generateOtpCode:()=> '123456',sendOtpEmail:async()=>{}},
  '@/lib/db':{db:{creator:{findUnique:async()=>null},partnerProfile:{findUnique:async({where})=>{assert.equal(where.referralCode,'ABCDEF1234');return {referralCode:'ABCDEF1234',status:'ACTIVE',isActive:active};}},pendingSignup:{upsert:async a=>saved=a.create}}},
 });
 const result=await route.POST({json:async()=>({email:'test@example.test',password:'longpassword',phone:'+2348012345678'})});assert.equal(result.status,200);assert.equal(saved.referralCode,active?'ABCDEF1234':null);
});
