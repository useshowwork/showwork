const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');

// Exercise the media application policy without a live database or provider IO.
function fixture(postOverrides = {}) {
  const queries = [], permissions = [];
  const post = { id: 'post', calendarId: 'calendar', approvalStatus: 'PENDING', creativeBrief: { title: 'Campaign graphic' }, ...postOverrides };
  const tx = { async query(sql, params) {
    queries.push({sql,params});
    if (sql.startsWith('SELECT * FROM "CalendarPost"')) return {rows:[post]};
    if (sql.startsWith('INSERT INTO "CalendarPostAsset"')) return {rows:[{id:'asset'}]};
    if (sql.startsWith('DELETE FROM "CalendarPostAsset"')) return {rows:[{id:'asset'}]};
    return {rows:[]};
  }};
  const { createCanonicalApplicationActions } = load('lib/publishing/applicationActions.ts', {
    './validationAdapters': { createPublishingValidationAdapters: () => ({
      async validateWorkspacePermission(_tx, input) {permissions.push(input.permission);},
      async lockForPolicyChange() {},
    }) },
  });
  const actions = createCanonicalApplicationActions({ database: { transaction: fn => fn(tx) }, policy: {}, async validateUsage() {} });
  const input = { operationId:'reuse',actor:'designer',calendarId:'calendar',postId:'post',assetId:'asset',upload:'verified' };
  const verify = async () => ({ fileKey:'graphic',objectVersion:'v1',contentSha256:'a'.repeat(64),mediaType:'PHOTO',sizeBytes:'42',verifiedFor:{calendarId:'calendar',postId:'post'} });
  return {actions,input,verify,queries,permissions};
}
test('generated creative briefs allow media additions and invalidate the prior team review', async () => {
  const h=fixture();
  await h.actions.media(h.input,h.verify);
  assert.deepEqual(h.permissions,['creatives.upload','creatives.upload']);
  assert.ok(h.queries.some(q=>q.sql.startsWith('INSERT INTO "CalendarPostAsset"')));
  const reset=h.queries.find(q=>q.sql.startsWith('UPDATE "CalendarPost"'));
  assert.match(reset.sql,/"internalReviewStatus"='PENDING'/);
  assert.match(reset.sql,/"internalReviewVersion"="internalReviewVersion"\+1/);
  assert.match(reset.sql,/"approvalStatus"='PENDING'/);
});
test('approved posts and in-progress platform operations reject media changes before asset writes', async () => {
  for (const state of [{approvalStatus:'APPROVED'},{publishWorkerStartedAt:new Date()},{tikTokPublishId:'operation'},{platformPostId:'operation'}]) {
    const h=fixture(state);
    await assert.rejects(h.actions.media(h.input,h.verify),/MEDIA_LOCKED/);
    assert.equal(h.queries.some(q=>q.sql.startsWith('INSERT INTO "CalendarPostAsset"')),false);
  }
});
test('media removal requires calendar edit permission and also invalidates team review', async () => {
  const h=fixture();
  await h.actions.media({...h.input,remove:true},h.verify);
  assert.deepEqual(h.permissions,['calendar.edit','calendar.edit']);
  assert.ok(h.queries.some(q=>q.sql.startsWith('DELETE FROM "CalendarPostAsset"')));
  assert.ok(h.queries.some(q=>q.sql.includes('"internalReviewStatus"=\'PENDING\'')));
});
