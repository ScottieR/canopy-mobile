import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrimaryInboxAction } from './inboxActions.js';

test('agent requests resolve as approvals, not dismissals', () => {
  const action = getPrimaryInboxAction({
    id: 'inbox_1',
    type: 'agent_request',
    content: 'Approve this access request',
  });

  assert.deepEqual(action, {
    label: 'Approve',
    kind: 'approve',
  });
});

test('forum updates open the related forum thread', () => {
  const action = getPrimaryInboxAction({
    id: 'inbox_2',
    type: 'forum_deliverable',
    content: 'Ready for review',
    forum_id: 'forum_42',
    forum_title: 'Launch plan',
  });

  assert.equal(action.label, 'View');
  assert.equal(action.kind, 'open_forum');
  assert.equal(action.href, '/chat/forum_42?name=Launch%20plan&mode=forum');
});
