// LiveVoiceProtocol — protocol contract between desktop and mobile for live
// voice sessions. This file defines the message shape and provides a thin
// client wrapper; full mobile audio capture/playback is a focused follow-up
// (needs expo-audio + native mic permission handling).
//
// Lifecycle (always desktop-initiated for now):
//   desktop → mobile: { type: "live_voice/invite",   payload: { sessionId, agentId, agentName, agentImage?, forumId? } }
//   mobile  → desktop: { command: "live_voice/join",   payload: { sessionId } }      // accept invite
//   mobile  → desktop: { command: "live_voice/decline",payload: { sessionId } }      // reject
//   desktop → mobile: { type: "live_voice/audio",    payload: { sessionId, pcm: base64, sampleRate: 24000 } }
//   mobile  → desktop: { command: "live_voice/audio", payload: { sessionId, pcm: base64, sampleRate: 16000 } }
//   desktop → mobile: { type: "live_voice/turn",     payload: { sessionId, event: "start"|"complete" } }
//   desktop → mobile: { type: "live_voice/transcript", payload: { sessionId, role, text, isFinal } }
//   either  → other:  { type|command: "live_voice/end", payload: { sessionId, reason } }
//
// All audio is LINEAR16 PCM mono, base64-encoded. 16kHz client→server and
// 24kHz server→client (matches the desktop's Rust live_voice bridge to keep
// re-encoding work on mobile to a minimum).

import { useEffect } from 'react';
import { useDispatch } from './DispatchContext';

// ─── Message type constants ─────────────────────────────────────────────

export const LIVE_VOICE = {
  Invite: 'live_voice/invite',
  Audio: 'live_voice/audio',
  Turn: 'live_voice/turn',
  Transcript: 'live_voice/transcript',
  End: 'live_voice/end',
  // Commands mobile sends back to desktop:
  Join: 'live_voice/join',
  Decline: 'live_voice/decline',
} as const;

// ─── Payload types ───────────────────────────────────────────────────────

export interface LiveVoiceInvitePayload {
  sessionId: string;
  agentId: string;
  agentName: string;
  agentImage?: string;
  /** Present if the desktop opened the call from inside a forum. */
  forumId?: string;
}

export interface LiveVoiceAudioPayload {
  sessionId: string;
  pcm: string;          // base64 LINEAR16 PCM mono
  sampleRate: number;   // 16000 (mobile→desktop) or 24000 (desktop→mobile)
}

export interface LiveVoiceTurnPayload {
  sessionId: string;
  event: 'start' | 'complete';
}

export interface LiveVoiceTranscriptPayload {
  sessionId: string;
  role: 'user' | 'agent';
  text: string;
  isFinal: boolean;
}

export interface LiveVoiceEndPayload {
  sessionId: string;
  reason: string;       // human-readable
}

// ─── Convenience subscription hook ───────────────────────────────────────

/**
 * Subscribes to all incoming live voice events for the current session and
 * returns helpers for the outbound commands. Mobile screens can call this
 * and supply handlers — the actual audio plumbing (mic capture, playback)
 * still has to be implemented separately.
 *
 * Example usage:
 *   const { sendAudio, decline, end } = useLiveVoiceProtocol({
 *     sessionId: invite.sessionId,
 *     onAudio: (pcm) => playbackQueue.push(pcm),
 *     onTurn: (e) => setAgentSpeaking(e === 'start'),
 *     onTranscript: (line) => appendLine(line),
 *     onEnd: (reason) => { close(); },
 *   });
 */
export interface UseLiveVoiceProtocolArgs {
  sessionId: string | null;
  onAudio?: (payload: LiveVoiceAudioPayload) => void;
  onTurn?: (event: 'start' | 'complete') => void;
  onTranscript?: (payload: LiveVoiceTranscriptPayload) => void;
  onEnd?: (reason: string) => void;
}

export interface LiveVoiceProtocolHandle {
  /** Send a PCM frame from the device mic up to the desktop. */
  sendAudio: (pcmBase64: string, sampleRate?: number) => void;
  /** Accept an incoming invite. Call once, before sending audio. */
  acceptInvite: (sessionId: string) => void;
  /** Reject an incoming invite without joining. */
  decline: (sessionId: string) => void;
  /** End the session cleanly from the mobile side. */
  end: (reason?: string) => void;
}

export function useLiveVoiceProtocol(args: UseLiveVoiceProtocolArgs): LiveVoiceProtocolHandle {
  const dispatch = useDispatch();
  const { sessionId, onAudio, onTurn, onTranscript, onEnd } = args;

  useEffect(() => {
    if (!sessionId) return;
    // Filter helper — drop messages for other sessions.
    const forThisSession = (p: any) => p && p.sessionId === sessionId;
    const unsubs: Array<() => void> = [];
    if (onAudio) {
      unsubs.push(dispatch.subscribe(LIVE_VOICE.Audio, (p) => {
        if (forThisSession(p)) onAudio(p as LiveVoiceAudioPayload);
      }));
    }
    if (onTurn) {
      unsubs.push(dispatch.subscribe(LIVE_VOICE.Turn, (p) => {
        if (forThisSession(p)) onTurn((p as LiveVoiceTurnPayload).event);
      }));
    }
    if (onTranscript) {
      unsubs.push(dispatch.subscribe(LIVE_VOICE.Transcript, (p) => {
        if (forThisSession(p)) onTranscript(p as LiveVoiceTranscriptPayload);
      }));
    }
    if (onEnd) {
      unsubs.push(dispatch.subscribe(LIVE_VOICE.End, (p) => {
        if (forThisSession(p)) onEnd((p as LiveVoiceEndPayload).reason || 'remote ended');
      }));
    }
    return () => unsubs.forEach(u => u());
  }, [sessionId, dispatch, onAudio, onTurn, onTranscript, onEnd]);

  return {
    sendAudio: (pcmBase64, sampleRate = 16000) => {
      if (!sessionId) return;
      dispatch.sendMessage(LIVE_VOICE.Audio, {
        sessionId, pcm: pcmBase64, sampleRate,
      });
    },
    acceptInvite: (sid) => dispatch.sendMessage(LIVE_VOICE.Join, { sessionId: sid }),
    decline: (sid) => dispatch.sendMessage(LIVE_VOICE.Decline, { sessionId: sid }),
    end: (reason = 'user') => {
      if (!sessionId) return;
      dispatch.sendMessage(LIVE_VOICE.End, { sessionId, reason });
    },
  };
}
