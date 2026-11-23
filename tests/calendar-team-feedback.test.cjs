const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');

const params = { params: Promise.resolve({ id: 'workspace', postId: 'post' }) };
const endpoint = 'http://localhost/team-feedback';

function setup({ canView = true, canSend = true } = {}) {
  const messages = new Map();
  const notices = [];
  const route = load('app/api/calendars/[id]/posts/[postId]/team-feedback/route.ts', {
    '@/lib/auth': { getCurrentCreator: async () => ({ id: 'creator', name: 'Ada', email: 'ada@example.test' }) },
    '@/lib/calendarPermissions': {
      hasCalendarPermission: async (_creator, _calendar, permission) => permission === 'calendar.view' ? canView : canSend,
    },
    '@/lib/db': {
      db: {
        calendarPost: {
          findFirst: async ({ where }) => {
            assert.deepEqual(where, { calendarId: 'workspace', id: 'post' });
            return { id: 'post', internalReviewVersion: 3 };
          },
          update: () => assert.fail('Sending feedback must preserve the approval state'),
        },
        calendarPostTeamFeedback: {
          createMany: async ({ data }) => {
            if (!messages.has(data.id)) messages.set(data.id, { ...data, createdAt: new Date() });
          },
          findUniqueOrThrow: async ({ where }) => messages.get(where.id),
          findMany: async ({ where }) => {
            assert.equal(where.postId, 'post');
            return [...messages.values()].reverse();
          },
        },
      },
    },
    '@/lib/calendarReviewNotifications': {
      notifyInternalReview: async event => {
        notices.push(event);
        return { sent: 0, failed: 1 };
      },
    },
  });
  return { ...route, notices, messages };
}

function send(route, message, suffix) {
  return route.POST(new Request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ message, requestId: `00000000-0000-4000-8000-00000000000${suffix}` }),
  }), params);
}

test('feedback appends messages and retains them after notification failure or a send retry', async () => {
  const route = setup();
  assert.equal((await send(route, 'Use the wider shot.', 1)).status, 201);
  assert.equal((await send(route, 'Updated the opening frame.', 2)).status, 201);
  assert.equal((await send(route, 'Use the wider shot.', 1)).status, 201);
  const response = await route.GET({ nextUrl: new URL(endpoint) }, params);
  const page = await response.json();
  assert.deepEqual(page.messages.map(message => message.message), ['Use the wider shot.', 'Updated the opening frame.']);
  assert.equal(page.messages[0].authorName, 'Ada');
  assert.equal(route.notices[0].feedbackId, route.notices[2].feedbackId);
  assert.equal(route.notices[0].note, null);
});

test('only workspace members with calendar access can read and collaborators need write permission to send', async () => {
  const outsider = setup({ canView: false });
  assert.equal((await outsider.GET({ nextUrl: new URL(endpoint) }, params)).status, 403);
  assert.equal((await send(outsider, 'Private note', 1)).status, 403);
  const viewer = setup({ canSend: false });
  assert.equal((await viewer.GET({ nextUrl: new URL(endpoint) }, params)).status, 200);
  assert.equal((await send(viewer, 'Private note', 1)).status, 403);
  assert.equal(viewer.messages.size, 0);
});
