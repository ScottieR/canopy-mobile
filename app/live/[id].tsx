// Live voice screen — push-to-talk V1 for mobile.
//
// Why PTT (vs the desktop's true bidirectional duplex):
//   expo-av's Audio.Recording writes to a file (m4a). There's no PCM
//   streaming API in Expo without a native module. PTT keeps the UX honest:
//   user holds → record chunk → release → upload → play reply. Latency is
//   ~1-2s but the experience is reliable and doesn't lie about being "live".
//
// All audio plumbing flows through the existing dispatch WebSocket using the
// LIVE_VOICE.Audio message type defined in LiveVoiceProtocol.ts. The desktop
// side relays into the existing live_voice Rust bridge → OpenClaw realtime
// brain → Gemini Live. So the desktop's duplex pipeline and mobile's PTT
// share one model session — the user can have the desktop AND phone in the
// same conversation (with very different cadences).

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Platform, Animated, Easing,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic, PhoneOff, X, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from '../../context/DispatchContext';
import {
  LIVE_VOICE,
  LiveVoiceInvitePayload,
  LiveVoiceAudioPayload,
  LiveVoiceTranscriptPayload,
  useLiveVoiceProtocol,
} from '../../context/LiveVoiceProtocol';

// ─── Types ────────────────────────────────────────────────────────────────

type Status = 'idle' | 'requesting' | 'live' | 'recording' | 'closing' | 'error';

interface TranscriptLine {
  id: string;
  role: 'user' | 'agent';
  text: string;
  isFinal: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Recording preset that produces a small, broadly compatible file. We use AAC
 * at 16kHz mono so the Rust live_voice bridge can transcode in one pass on
 * the desktop side. (PCM16 would be ideal but expo-av writes M4A/AAC; the
 * server-side transcode is cheap.)
 */
const RECORDING_PRESET: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

/** Promise wrapper that reads a recording's bytes as base64. We import the
 *  legacy file-system surface explicitly — the new (Paths/File class) API
 *  in Expo SDK 54 is more verbose for one-shot reads and the legacy methods
 *  are still exported for compatibility. */
async function recordingToBase64(uri: string): Promise<string> {
  const FS = await import('expo-file-system/legacy');
  return FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function LiveVoiceScreen() {
  const { id: agentId, name, color, forumId } = useLocalSearchParams<{
    id: string; name?: string; color?: string; forumId?: string;
  }>();
  const dispatch = useDispatch();

  const agentColor = color || '#3c6663';
  const agentName = name || 'Agent';

  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // Recording state lives in refs so the press-handler callbacks don't have
  // to re-bind every render.
  const recordingRef = useRef<Audio.Recording | null>(null);
  const playbackQueueRef = useRef<Audio.Sound[]>([]);
  // Pulse ring animation while the agent is speaking.
  const pulse = useRef(new Animated.Value(0)).current;

  // ── Start the session on mount ───────────────────────────────────────
  // The desktop opens a `live_voice` WS session and broadcasts an invite
  // (LIVE_VOICE.Invite) when the user starts live mode. Two launch paths:
  //   (a) User taps the in-app mic → dispatch is already connected.
  //   (b) iOS Shortcut launched the app cold → dispatch is still connecting.
  // Path (b) is why we don't fire the start command immediately on mount —
  // we wait for dispatch.status === 'connected' before sending, otherwise
  // the message goes into the void.
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [startSent, setStartSent] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('requesting');
      setError(null);

      // 1. Mic permission — request as soon as the screen mounts. The
      //    permission dialog is the slowest async step; getting it out of
      //    the way in parallel with the WebSocket connect minimizes wait.
      const perm = await Audio.requestPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) {
        setError('Microphone permission denied. Enable it in Settings → Canopy.');
        setStatus('error');
        setPermGranted(false);
        return;
      }
      setPermGranted(true);

      // 2. Audio session config so playback works alongside recording
      //    (and so iOS uses the speaker, not the earpiece).
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // ── Send start_live_voice_session once permissions AND dispatch are ready ──
  // This is split out specifically so the iOS Shortcut cold-launch path works:
  // when the app boots from a Shortcut, dispatch.status starts as
  // 'disconnected', flips to 'connecting', then 'connected' once the WS
  // reconnects. We hold off the start command until then.
  useEffect(() => {
    if (startSent) return;
    if (!permGranted) return;
    if (dispatch.status !== 'connected') return;
    setStartSent(true);
    dispatch.sendMessage('start_live_voice_session', {
      agent_id: agentId,
      forum_id: forumId ?? null,
      from: 'mobile',
    });
  }, [permGranted, dispatch.status, dispatch, agentId, forumId, startSent]);

  // ── Subscribe to the invite that confirms our session id ─────────────
  useEffect(() => {
    const unsub = dispatch.subscribe(LIVE_VOICE.Invite, (payload: LiveVoiceInvitePayload) => {
      if (!payload?.sessionId || payload.agentId !== agentId) return;
      setSessionId(payload.sessionId);
      setStatus('live');
    });
    return unsub;
  }, [dispatch, agentId]);

  // ── Wire the protocol hook for ongoing frames ────────────────────────
  const proto = useLiveVoiceProtocol({
    sessionId,
    onAudio: (p: LiveVoiceAudioPayload) => playInbound(p.pcm),
    onTurn: (event) => setAgentSpeaking(event === 'start'),
    onTranscript: (p: LiveVoiceTranscriptPayload) => {
      setTranscript(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === p.role && !last.isFinal) {
          next[next.length - 1] = { ...last, text: p.text, isFinal: p.isFinal };
        } else {
          next.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: p.role, text: p.text, isFinal: p.isFinal,
          });
        }
        return next;
      });
    },
    onEnd: (reason) => {
      setStatus('closing');
      router.back();
    },
  });

  // ── Agent-speaking pulse animation ───────────────────────────────────
  useEffect(() => {
    if (agentSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [agentSpeaking, pulse]);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Stop any in-flight recording.
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      // Drain playback queue.
      playbackQueueRef.current.forEach(s => s.unloadAsync().catch(() => {}));
      playbackQueueRef.current = [];
      // Tell the backend we're done.
      if (sessionId) {
        proto.end('user');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push-to-talk handlers ────────────────────────────────────────────

  const startTalking = async () => {
    if (status !== 'live' || !sessionId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStatus('recording');
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_PRESET);
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (e: any) {
      setError(`Couldn't start recording: ${e?.message || e}`);
      setStatus('error');
    }
  };

  const stopTalking = async () => {
    if (!recordingRef.current) {
      setStatus('live');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const rec = recordingRef.current;
      recordingRef.current = null;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) throw new Error('Recording produced no file');
      const b64 = await recordingToBase64(uri);
      // expo-av encoding is AAC/m4a at 16kHz — the Rust side knows how to
      // decode container audio (or will, once routing is wired). The
      // sampleRate field is the source rate, NOT the encoding.
      proto.sendAudio(b64, 16000);
      setStatus('live');
    } catch (e: any) {
      setError(`Couldn't send audio: ${e?.message || e}`);
      setStatus('error');
    }
  };

  /** Play one inbound audio chunk. Queues so chunks don't overlap. */
  const playInbound = async (b64: string) => {
    try {
      const FS = await import('expo-file-system/legacy');
      const path = `${FS.cacheDirectory}live_in_${Date.now()}.aac`;
      await FS.writeAsStringAsync(path, b64, { encoding: FS.EncodingType.Base64 });
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      playbackQueueRef.current.push(sound);
      sound.setOnPlaybackStatusUpdate(s => {
        if ('didJustFinish' in s && s.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          playbackQueueRef.current = playbackQueueRef.current.filter(x => x !== sound);
        }
      });
    } catch (e) {
      // Silent — single dropped chunks shouldn't kill the session.
      console.warn('Playback chunk failed', e);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.45] });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar — close button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: status === 'live' ? '#4A9E96' : status === 'recording' ? '#EF4444' : '#A0AEC0' }]} />
          <Text style={styles.statusText}>
            {/* Distinguish "waiting for the Mac WS" from "asking the model to
                start" — important for the iOS Shortcut cold-launch path where
                dispatch may take a few seconds to reconnect. */}
            {status === 'requesting' && dispatch.status !== 'connected' ? 'Connecting to your Mac…' :
             status === 'requesting'  ? 'Starting session…' :
             status === 'live'        ? 'Live' :
             status === 'recording'   ? 'Listening' :
             status === 'closing'     ? 'Hanging up…' :
             status === 'error'       ? 'Error' : 'Idle'}
          </Text>
        </View>
      </View>

      {/* Avatar with pulsing ring when the agent is speaking */}
      <View style={styles.avatarStack}>
        <Animated.View style={[styles.pulseRing, {
          backgroundColor: agentColor + '55',
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }]} />
        <View style={[styles.avatarRing, { backgroundColor: agentColor + '22', borderColor: agentColor + '88' }]}>
          <Text style={[styles.avatarInitial, { color: agentColor }]}>
            {agentName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.agentName}>{agentName}</Text>
      <Text style={styles.agentSub}>
        {forumId ? 'In project' : 'Live conversation'}
      </Text>

      {/* Error card */}
      {status === 'error' && error && (
        <View style={styles.errorCard}>
          <AlertCircle size={16} color="#FFB3B3" style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Transcript ticker — last 3 lines */}
      {transcript.length > 0 && (
        <View style={styles.transcriptArea}>
          {transcript.slice(-3).map(line => (
            <Text key={line.id} style={[
              styles.transcriptLine,
              { color: line.role === 'user' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.92)' },
              !line.isFinal && { fontStyle: 'italic', opacity: 0.7 },
            ]} numberOfLines={2}>
              <Text style={{ fontWeight: '700' }}>{line.role === 'user' ? 'You: ' : `${agentName}: `}</Text>
              {line.text}
            </Text>
          ))}
        </View>
      )}

      {/* Push-to-talk button */}
      {status === 'requesting' && (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
      )}
      {(status === 'live' || status === 'recording') && (
        <Pressable
          onPressIn={startTalking}
          onPressOut={stopTalking}
          style={[styles.pttButton, status === 'recording' && styles.pttButtonActive]}
        >
          <Mic size={48} color="#fff" />
          <Text style={styles.pttHint}>
            {status === 'recording' ? 'Listening — release to send' : 'Hold to talk'}
          </Text>
        </Pressable>
      )}

      {/* End call */}
      {(status === 'live' || status === 'recording' || status === 'error') && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.endButton}
        >
          <PhoneOff size={18} color="#fff" />
          <Text style={styles.endText}>End call</Text>
        </TouchableOpacity>
      )}

      {/* V1 caveat */}
      <Text style={styles.footnote}>
        Push to talk. True duplex live coming soon on mobile — desktop has it today.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop / paddingBottom are applied inline from useSafeAreaInsets so the
  // overlay respects notches and home-indicator areas on both platforms.
  container:     { flex: 1, backgroundColor: '#0a1314', paddingHorizontal: 20, alignItems: 'center' },
  topBar:        { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  closeBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  statusPill:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  statusDot:     { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:    { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  avatarStack:   { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 16 },
  pulseRing:     { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  avatarRing:    { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 64, fontWeight: '700' },

  agentName:     { color: '#fff', fontSize: 24, fontWeight: '700' },
  agentSub:      { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },

  errorCard:     { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(229,87,90,0.15)', borderColor: 'rgba(229,87,90,0.4)', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 20, maxWidth: 400 },
  errorText:     { color: '#FFB3B3', fontSize: 13, flex: 1, lineHeight: 18 },

  transcriptArea:{ marginTop: 24, width: '100%', maxWidth: 420, minHeight: 60, gap: 6 },
  transcriptLine:{ fontSize: 13, lineHeight: 18 },

  pttButton:     { marginTop: 36, width: 120, height: 120, borderRadius: 60, backgroundColor: '#3c6663', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  pttButtonActive:{ backgroundColor: '#E5575A', transform: [{ scale: 1.08 }] },
  pttHint:       { position: 'absolute', bottom: -28, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

  endButton:     { marginTop: 80, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
  endText:       { color: '#fff', fontWeight: '600', fontSize: 14 },

  footnote:      { position: 'absolute', bottom: 30, color: 'rgba(255,255,255,0.35)', fontSize: 11, paddingHorizontal: 40, textAlign: 'center', lineHeight: 16 },
});
