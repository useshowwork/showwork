const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');

const library = load('lib/workspaceNotifications.ts');
const params = { params: Promise.resolve({ id: 'workspace' }) };
const request = new Request('http://localhost/api/calendars/workspace/notifications');
const createdAt = new Date('2026-11-23T08:03:00Z');

function route(permissions, query) {
  return load('app/api/calendars/[id]/notifications/route.ts', {
    '@/lib/workspaceNotifications': library,
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'member' }) },
    '@/lib/calendarPermissions': { getCalendarAccess: async () => permissions && ({ permissions }) },
    '@/lib/db': { db: { $queryRaw: query } },
  });
}

test('approval batches are stable per actor and reject arbitrary identifiers', () => {
  const batch = '00000000-0000-4000-8000-000000000001';
  const tagged = new Request(request, { headers: { 'x-showwork-approval-batch': batch } });
  assert.equal(library.approvalBatch(request, 'owner'), undefined);
  assert.equal(library.approvalBatch(tagged, 'owner'), library.approvalBatch(tagged, 'owner'));
  assert.notEqual(library.approvalBatch(tagged, 'owner'), library.approvalBatch(tagged, 'manager'));
});

test('workspace alerts group approvals and link directly to the inbox and feedback', async () => {
  const { GET } = route(['calendar.view', 'inbox.view', 'channels.view'], async (strings, ...args) => {
    assert.equal(args[0], 'workspace');
    const sql = strings.join('');
    if (sql.includes('"WorkspaceNotification"')) {
      assert.match(sql, /GROUP BY COALESCE\("batchId", "eventKey"\)/);
      return [
        { id: 'batch', kind: 'team-approved', actor: 'Ada', count: 5, batch: true, createdAt },
        { id: 'reply', kind: 'team-feedback', actor: 'Ada', count: 1, title: 'Team feedback sent', postId: 'post-1', createdAt },
      ];
    }
    return [{ id: 'inbox-event', conversationId: 'chat-1', platform: 'WHATSAPP', actor: 'Chioma', createdAt }];
  });
  const response = await GET(request, params);
  const { items } = await response.json();
  assert.equal(items.find(item => item.kind === 'team-approved').title, '5 posts approved for client review');
  assert.equal(items.find(item => item.kind === 'team-feedback').href, '/dashboard/calendars/workspace?view=content&post=post-1&review=team');
  assert.equal(items.find(item => item.kind === 'handoff').href, '/dashboard/calendars/workspace?view=inbox&conversation=chat-1');
  assert.equal(items.find(item => item.kind === 'message').title, 'New WhatsApp message');
});

test('restricted members do not fetch inbox records and outsiders cannot fetch activity', async () => {
  let queries = 0;
  const query = async (sql, ...args) => {
    queries++;
    assert.match(sql.join(''), /WorkspaceNotification/);
    assert.deepEqual(args, ['workspace', true, false]);
    return [];
  };
  assert.equal((await route(null, query).GET(request, params)).status, 404);
  assert.equal((await route(['channels.view'], query).GET(request, params)).status, 200);
  assert.equal(queries, 1);
});
