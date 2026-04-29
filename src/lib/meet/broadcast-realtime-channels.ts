export function buildBroadcastRealtimeChannelForSession(broadcastSessionId: number): string {
  return `meet_br_rt_s_${broadcastSessionId}`;
}

/** Template SSE uses the same stream as the parent broadcast session once `broadcastSessionId` is resolved. */
export function buildBroadcastRealtimeChannelForRenderSession(
  _renderSessionId: number,
  broadcastSessionId: number
): string {
  void _renderSessionId;
  return buildBroadcastRealtimeChannelForSession(broadcastSessionId);
}
