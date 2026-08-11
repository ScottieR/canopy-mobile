/** Build a device-scoped session id for a brand-new mobile-only conversation
 *  with an agent, fully decoupled from anything happening on the desktop.
 *  The backend creates this conversation lazily on first send_message /
 *  get_chat_history call.
 *
 *  To continue an *existing* desktop thread instead, pass that thread's real
 *  conversation id as session_id (see app/threads/[agentId].tsx, which lists
 *  desktop threads via the `list_threads` dispatch RPC) — on the desktop's
 *  ThreadsRail that conversation is a regular thread the user can rename
 *  either way.
 */
export function mobileSessionId(agentId: string, deviceId?: string): string {
  return deviceId ? `companion_${deviceId}_${agentId}` : `mobile_${agentId}`;
}
