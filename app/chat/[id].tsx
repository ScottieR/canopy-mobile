import {
  StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  View, Text, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Animated, Pressable } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { Send, ArrowLeft, Mic, Keyboard, ChevronDown, ChevronRight, FileText, Code, PhoneCall } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GenUIRenderer } from '../../components/GenUIRenderer';

// ─── Message type ─────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
}

// ─── Content parsers ──────────────────────────────────────────────────────────

/** Extract [THOUGHT_PROCESS]...[/THOUGHT_PROCESS] blocks from agent content. */
function parseThoughtBlocks(content: string): { thoughts: string[]; text: string } {
  const thoughts: string[] = [];
  const text = content.replace(
    /\[THOUGHT_PROCESS\]([\s\S]*?)\[\/THOUGHT_PROCESS\]/g,
    (_, thought) => { thoughts.push(thought.trim()); return ''; }
  ).trim();
  return { thoughts, text };
}

/** Parse ---FORMAT--- ... ---CONTENT--- delimiter blocks. */
function parseFormatBlock(content: string): { format: 'markdown' | 'html' | 'genui' | null; body: string } {
  const m = content.match(/---FORMAT---\s*(markdown|html|genui)\s*---CONTENT---\s*([\s\S]*)/i);
  if (!m) return { format: null, body: content };
  return { format: m[1].toLowerCase() as 'markdown' | 'html' | 'genui', body: m[2].trim() };
}

// ─── Collapsed thought block ──────────────────────────────────────────────────

function ThoughtBlock({ thoughts }: { thoughts: string[] }) {
  const [open, setOpen] = useState(false);
  if (thoughts.length === 0) return null;
  return (
    <View style={thoughtStyles.container}>
      <TouchableOpacity style={thoughtStyles.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        {open ? <ChevronDown size={12} color="#718096" /> : <ChevronRight size={12} color="#718096" />}
        <Text style={thoughtStyles.label}>Thinking ({thoughts.length} block{thoughts.length > 1 ? 's' : ''})</Text>
      </TouchableOpacity>
      {open && (
        <View style={thoughtStyles.body}>
          {thoughts.map((t, i) => (
            <Text key={i} style={thoughtStyles.text}>{t}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const thoughtStyles = StyleSheet.create({
  container: { marginBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F7FAFC', gap: 6 },
  label:     { fontSize: 11, color: '#718096', fontStyle: 'italic' },
  body:      { padding: 10, backgroundColor: '#FAFAFA' },
  text:      { fontSize: 12, color: '#4A5568', lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

// ─── Artifact card (HTML / markdown from forums) ──────────────────────────────

function ArtifactCard({ format, body, agentColor }: { format: 'html' | 'markdown'; body: string; agentColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const isHtml = format === 'html';
  const preview = body.replace(/<[^>]+>/g, '').slice(0, 140).trim();

  return (
    <View style={[artifactStyles.card, { borderLeftColor: agentColor }]}>
      <View style={artifactStyles.header}>
        {isHtml
          ? <Code size={14} color={agentColor} />
          : <FileText size={14} color={agentColor} />
        }
        <Text style={[artifactStyles.typeLabel, { color: agentColor }]}>
          {isHtml ? 'Interactive App' : 'Document'}
        </Text>
      </View>
      <Text style={artifactStyles.preview} numberOfLines={expanded ? undefined : 3}>
        {preview}{body.length > 140 && !expanded ? '…' : ''}
      </Text>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={artifactStyles.toggle}>
        <Text style={[artifactStyles.toggleText, { color: agentColor }]}>
          {expanded ? 'Show less' : 'Show more'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const artifactStyles = StyleSheet.create({
  card:       { borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 3, backgroundColor: '#fff', padding: 14, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  typeLabel:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  preview:    { fontSize: 13, color: '#4A5568', lineHeight: 20 },
  toggle:     { marginTop: 8 },
  toggleText: { fontSize: 12, fontWeight: '600' },
});

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  item,
  agentColor,
  onGenUIAction,
}: {
  item: Message;
  agentColor: string;
  onGenUIAction: (payload: any, action: string, data: any) => void;
}) {
  const isUser = item.role === 'user';

  if (isUser) {
    return (
      <View style={[msgStyles.wrapper, msgStyles.wrapperUser]}>
        <View style={[msgStyles.bubble, msgStyles.bubbleUser, { backgroundColor: agentColor }]}>
          <Text style={msgStyles.textUser} selectable>{item.content}</Text>
        </View>
      </View>
    );
  }

  // ── Agent message — parse content ──────────────────────────────────────────
  const { format, body } = parseFormatBlock(item.content);

  // GenUI via format block
  if (format === 'genui') {
    try {
      const payload = JSON.parse(body);
      if (payload.component) {
        return (
          <View style={[msgStyles.wrapper, msgStyles.wrapperAgent]}>
            <GenUIRenderer payload={payload} onAction={(action, data) => onGenUIAction(payload, action, data)} />
          </View>
        );
      }
    } catch {}
  }

  // HTML mini-apps run inside the same locked-down WebView used by
  // parent-published companion resources. Actions return to the agent thread.
  if (format === 'html') {
    const payload = { component: 'HtmlMiniApp', props: { html: body, height: 480 } };
    return (
      <View style={[msgStyles.wrapper, msgStyles.wrapperAgent]}>
        <GenUIRenderer
          payload={payload}
          onAction={(action, data) => onGenUIAction(payload, action, data)}
        />
      </View>
    );
  }

  // Markdown artifacts remain readable document cards.
  if (format === 'markdown') {
    return (
      <View style={[msgStyles.wrapper, msgStyles.wrapperAgent]}>
        <ArtifactCard format={format} body={body} agentColor={agentColor} />
      </View>
    );
  }

  // Inline GenUI (legacy — bare JSON with "component" key)
  if (!format && item.content.trim().startsWith('{') && item.content.includes('"component"')) {
    try {
      const payload = JSON.parse(item.content);
      if (payload.component) {
        return (
          <View style={[msgStyles.wrapper, msgStyles.wrapperAgent]}>
            <GenUIRenderer payload={payload} onAction={(action, data) => onGenUIAction(payload, action, data)} />
          </View>
        );
      }
    } catch {}
  }

  // Regular prose — strip thought blocks and render them collapsed above
  const { thoughts, text: cleanText } = parseThoughtBlocks(item.content);

  return (
    <View style={[msgStyles.wrapper, msgStyles.wrapperAgent]}>
      <ThoughtBlock thoughts={thoughts} />
      {cleanText.length > 0 && (
        <View style={[msgStyles.bubble, msgStyles.bubbleAgent]}>
          <Text style={msgStyles.textAgent} selectable>{cleanText}</Text>
        </View>
      )}
    </View>
  );
}

const msgStyles = StyleSheet.create({
  wrapper:      { width: '100%', flexDirection: 'row', marginBottom: 16 },
  wrapperUser:  { justifyContent: 'flex-end' },
  wrapperAgent: { justifyContent: 'flex-start' },
  bubble:       { maxWidth: '80%', padding: 14, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  bubbleUser:   { borderBottomRightRadius: 4 },
  bubbleAgent:  { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  textUser:     { color: '#fff', fontSize: 16, lineHeight: 22 },
  textAgent:    { color: '#2D3748', fontSize: 16, lineHeight: 22 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id, name, color, mode, session_id } = useLocalSearchParams<{ id: string; name?: string; color?: string; mode?: string; session_id?: string }>();
  const { status, sendMessage, subscribe } = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>(mode === 'voice' ? 'voice' : 'text');
  const [isRecording, setIsRecording] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const agentColor = color || '#218380';

  // Scroll to the most recent message
  const scrollToBottom = useCallback((animated = true) => {
    // Small delay ensures FlatList has rendered the new item before scrolling
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;

    sendMessage('get_chat_history', { agent_id: id, session_id: session_id ?? null, mode: mode ?? null });

    const unsubHistory = subscribe('chat_history', (history: any[]) => {
      const mapped: Message[] = (history ?? []).map(m => ({
        id: m.id || Math.random().toString(),
        role: m.role === 'user' ? 'user' : 'agent',
        content: m.content || m.text || '',
        timestamp: m.timestamp || m.ts || Date.now(),
      }));
      // History comes newest-first from backend — reverse to oldest-first for display
      setMessages(mapped.reverse());
      // Jump to bottom without animation on initial load
      scrollToBottom(false);
    });

    const unsubResponse = subscribe('chat_response', (payload: any) => {
      if (payload.agent_id !== id) return;
      setIsSending(false);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'agent',
        content: payload.response?.response || payload.response?.content || String(payload.response),
        timestamp: Date.now(),
      }]);
      scrollToBottom(true);
    });

    const unsubError = subscribe('chat_error', (payload: any) => {
      if (payload.agent_id !== id) return;
      setIsSending(false);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'agent',
        content: `I couldn't complete that request: ${payload.error}`,
        timestamp: Date.now(),
      }]);
    });

    return () => { unsubHistory(); unsubResponse(); unsubError(); };
  }, [id, status, sendMessage, subscribe, scrollToBottom]);

  const sendMessageInternal = (text: string) => {
    setMessages(prev => [...prev, { id: Math.random().toString(), role: 'user', content: text, timestamp: Date.now() }]);
    setIsSending(true);
    sendMessage('send_message', { agent_id: id, text, session_id: session_id ?? null });
    scrollToBottom(true);
  };

  const handleSendText = () => {
    if (!inputText.trim() || isSending) return;
    sendMessageInternal(inputText.trim());
    setInputText('');
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRecording(true);
    Animated.spring(scaleAnim, { toValue: 1.5, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    // The standalone live voice screen replaces the in-line walkie. Tapping
    // the big mic now navigates there instead of pretending to record.
    setInputMode('text');
    router.push(`/live/${id}?name=${encodeURIComponent(String(name || ''))}&color=${encodeURIComponent(String(color || ''))}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: name || 'Chat',
        headerStyle: { backgroundColor: '#faf9f6' },
        headerShadowVisible: false,
        headerTintColor: '#2D3748',
        headerTitleStyle: { fontWeight: '700' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -10, padding: 10 }}>
            <ArrowLeft color="#2D3748" size={24} />
          </TouchableOpacity>
        ),
        // Mobile threads are scoped per-device — they don't follow whatever
        // thread the desktop currently has open. The badge tells the user
        // they're in their phone's dedicated thread with this agent.
        headerRight: () => session_id?.startsWith('mobile_') ? (
          <View style={{ marginRight: 12, backgroundColor: 'rgba(74,158,150,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 10, color: '#4A9E96', fontWeight: '600' }}>
              Mobile thread
            </Text>
          </View>
        ) : session_id ? (
          <View style={{ marginRight: 12, backgroundColor: 'rgba(74,158,150,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 10, color: '#4A9E96', fontWeight: '600' }}>
              Active thread
            </Text>
          </View>
        ) : null,
      }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            item={item}
            agentColor={agentColor}
            onGenUIAction={(payload, action, data) => {
              sendMessageInternal(
                `[Mini-app action] component=${payload.component}; action=${action}; data=${JSON.stringify(data)}`,
              );
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        // Scroll to bottom when content grows (new messages arriving)
        onContentSizeChange={() => scrollToBottom(false)}
      />

      {isSending && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={agentColor} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {inputMode === 'text' ? (
            <>
              <TouchableOpacity style={styles.modeSwitchBtn} onPress={() => setInputMode('voice')}>
                <Mic color="#718096" size={24} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message…"
                placeholderTextColor="#A0AEC0"
                multiline
                maxLength={1000}
                onSubmitEditing={handleSendText}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: inputText.trim() ? agentColor : '#E2E8F0' }]}
                onPress={handleSendText}
                disabled={!inputText.trim() || isSending}
              >
                <Send color={inputText.trim() ? '#fff' : '#A0AEC0'} size={20} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.voiceModeContainer}>
              <TouchableOpacity style={styles.modeSwitchBtnAbsolute} onPress={() => setInputMode('text')}>
                <Keyboard color="#718096" size={24} />
              </TouchableOpacity>
              <View style={styles.walkieContainer}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.walkieButtonOuter}>
                  <Animated.View style={[
                    styles.walkieButtonInner,
                    { backgroundColor: isRecording ? '#EF4444' : agentColor },
                    { transform: [{ scale: scaleAnim }] },
                  ]}>
                    <Mic color="#fff" size={isRecording ? 48 : 40} />
                  </Animated.View>
                </Pressable>
                <Text style={styles.walkieHint}>{isRecording ? 'Listening…' : 'Hold to Speak'}</Text>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#faf9f6' },
  listContent:          { padding: 16, paddingBottom: 20 },
  loadingContainer:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  loadingText:          { color: '#718096', marginLeft: 8, fontSize: 14 },
  inputContainer:       { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12, backgroundColor: '#fff', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  input:                { flex: 1, backgroundColor: '#F0F4F8', color: '#2D3748', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120, minHeight: 44 },
  sendButton:           { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeSwitchBtn:        { padding: 10, marginRight: 4, justifyContent: 'center' },
  modeSwitchBtnAbsolute:{ position: 'absolute', left: 16, bottom: Platform.OS === 'ios' ? 30 : 20, padding: 10, zIndex: 10, backgroundColor: '#F0F4F8', borderRadius: 20 },
  voiceModeContainer:   { flex: 1, height: 180, alignItems: 'center', justifyContent: 'center', width: '100%' },
  walkieContainer:      { alignItems: 'center', justifyContent: 'center' },
  walkieButtonOuter:    { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  walkieButtonInner:    { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  walkieHint:           { fontSize: 16, fontWeight: '600', color: '#718096' },
});
