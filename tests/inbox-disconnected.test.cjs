const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');
const visibility = load('lib/socialMessaging/visibility.ts');
const active = where => assert.deepEqual(where.connection.status.in, ['CONNECTED', 'NEEDS_REAUTH']);

test('inbox threads, direct links, counts and messages are scoped to current accounts', async () => {
  const queries = [];
  const db = {
    socialConnection: { findMany: async () => [] },
    socialLeadConversation: {
      findMany: async ({where}) => { active(where); queries.push('threads'); return []; },
      findFirst: async ({where}) => { active(where); assert.equal(where.id, 'old-thread'); queries.push('link'); return null; },
      count: async ({where}) => { active(where); queries.push('count'); return 0; },
      aggregate: async ({where}) => { active(where); return {_sum:{unreadCount:0}}; },
    },
    socialLeadMessage: { count: async ({where}) => { active(where.conversation); queries.push('messages'); return 0; } },
    socialInboxSettings: {findUnique: async () => ({clientAccessEnabled:false, aiAutoReplyEnabled:false, aiReplyProfile:{}})},
  };
  const api = load('lib/socialInbox.ts', {
    '@/lib/db': {db},
    '@/lib/socialMessaging/visibility': visibility,
    '@/lib/socialMessaging/outbound': {reconcileStaleInboxSends:async()=>{}},
    '@/lib/socialMessaging/replyProfile': {normalizeReplyProfile:()=>({})},
    '@/lib/socialMessaging/tiktok': {}, '@/lib/socialMessaging/whatsapp': {}, '@/lib/linkedin/messagingAccess': {}, '@/lib/socialMessaging/meta': {},
  });
  const result = await api.getSocialInbox('workspace', new URLSearchParams({conversation:'old-thread'}));
  assert.deepEqual(result.conversations, []);
  assert.equal(result.summary.allMessages, 0);
  assert.equal(result.summary.leads, 0);
  assert.ok(queries.includes('link'));
});

test('lead listing scopes linked leads without removing independent manual/imported leads', async () => {
  const api = load('app/api/calendars/[id]/leads/route.ts', {
    '@/lib/socialMessaging/visibility': visibility,
    '@/lib/auth': { getCurrentCreator: async()=>({id:'user'}) },
    '@/lib/calendarPermissions': {hasCalendarPermission:async()=>true},
    '@/lib/db': {db:{calendarLead:{findMany:async ({where})=>{
      assert.equal(where.calendarId,'workspace');
      const rule=where.AND[0];
      assert.deepEqual(rule.OR[0],{socialConversation:null});
      active(rule.OR[1].socialConversation);
      assert.equal(where.OR[0].name.contains, 'Jane');
      return [];
    }}}},
    '@/lib/calendarLeads': { LEAD_PIPELINE_STATUSES:[], LEAD_TEMPERATURES:[] },
    'next/server': {NextResponse:{json:(body, options)=>({body,options})}},
  });
  const result=await api.GET({nextUrl:new URL('https://test/api?q=Jane')},{params:Promise.resolve({id:'workspace'})});
  assert.deepEqual(result.body,{leads:[]});
  assert.equal(result.options.headers['Cache-Control'],'no-store, private');
});
