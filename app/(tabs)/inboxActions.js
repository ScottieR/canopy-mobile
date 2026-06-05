export function getPrimaryInboxAction(item) {
  const label = item.type === 'forum_deliverable'
    ? 'View'
    : item.type === 'forum_blocked'
      ? 'Answer'
      : item.type === 'forum_milestone'
        ? 'Open Forum'
        : item.type === 'forum_paused'
          ? 'Resume'
          : item.type === 'agent_request'
            ? 'Approve'
            : 'Open';

  if (item.type === 'agent_request') {
    return { label, kind: 'approve' };
  }

  if (item.forum_id) {
    return {
      label,
      kind: 'open_forum',
      href: `/chat/${item.forum_id}?name=${encodeURIComponent(item.forum_title ?? 'Forum')}&mode=forum`,
    };
  }

  return { label, kind: 'dismiss' };
}
