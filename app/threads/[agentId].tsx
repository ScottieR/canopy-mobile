import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { MessageSquarePlus, MessageSquare, Loader } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileSessionId } from '../../utils/session';

// A trimmed mirror of the desktop's ConversationSummary (src-tauri/src/db.rs).
// Field names match the Rust struct's serde output (snake_case, no rename).
interface Thread {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  first_user_message: string | null;
  thread_status: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!isFinite(s) || s < 0) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ThreadCard({ thread, onPress }: { thread: Thread; onPress: () => void }) {
  const preview = thread.first_user_message?.trim();
  const isRunning = thread.thread_status === 'running';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <MessageSquare size={14} color="#718096" />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {thread.title && thread.title !== 'New Conversation' ? thread.title : (preview || 'Untitled thread')}
        </Text>
        {isRunning && (
          <View style={styles.runningBadge}>
            <Loader size={10} color="#3c6663" />
            <Text style={styles.runningText}>Active</Text>
          </View>
        )}
      </View>
      {preview && (
        <Text style={styles.cardPreview} numberOfLines={2}>{preview}</Text>
      )}
      <Text style={styles.cardMeta}>
        {thread.message_count} {thread.message_count === 1 ? 'message' : 'messages'} · {timeAgo(thread.updated_at)}
      </Text>
    </TouchableOpacity>
  );
}

export default function ThreadPickerScreen() {
  const { agentId, name, color } = useLocalSearchParams<{ agentId: string; name?: string; color?: string }>();
  const { status, assignment, sendMessage, subscribe } = useDispatch();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const insets = useSafeAreaInsets();
  const agentColor = color || '#3c6663';

  useEffect(() => {
    if (status !== 'connected' || !agentId) return;
    setLoaded(false);
    sendMessage('list_threads', { agent_id: agentId });
    const unsub = subscribe('threads_list', (payload: Thread[]) => {
      setThreads(payload ?? []);
      setLoaded(true);
    });
    return unsub;
  }, [status, agentId, sendMessage, subscribe]);

  const openChat = (sessionId: string) => {
    router.push(`/chat/${agentId}?name=${encodeURIComponent(String(name || ''))}&color=${encodeURIComponent(String(color || ''))}&session_id=${encodeURIComponent(sessionId)}`);
  };

  const startNewChat = () => openChat(mobileSessionId(String(agentId), assignment?.deviceId));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ title: name || 'Threads', headerStyle: { backgroundColor: '#faf9f6' }, headerShadowVisible: false, headerTintColor: '#2D3748', headerTitleStyle: { fontWeight: '700' } }} />

      <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: agentColor }]} onPress={startNewChat} activeOpacity={0.85}>
        <MessageSquarePlus size={18} color="#fff" />
        <Text style={styles.newChatText}>New chat</Text>
      </TouchableOpacity>

      {threads.length > 0 && <Text style={styles.sectionTitle}>Continue from your Mac</Text>}

      <FlatList
        data={threads}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <ThreadCard thread={item} onPress={() => openChat(item.id)} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.emptyText}>
              No existing threads with {name || 'this agent'} yet — start one above.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#faf9f6' },
  newChatBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, paddingVertical: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  newChatText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#718096', marginBottom: 10, marginHorizontal: 20, textTransform: 'uppercase', letterSpacing: 0.6 },

  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle:       { flex: 1, fontSize: 15, fontWeight: '700', color: '#2D3748' },
  runningBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(60,102,99,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  runningText:     { fontSize: 10, fontWeight: '700', color: '#3c6663' },
  cardPreview:     { fontSize: 13, color: '#718096', lineHeight: 18, marginBottom: 8 },
  cardMeta:        { fontSize: 11, color: '#A0AEC0' },

  emptyText:       { color: '#A0AEC0', textAlign: 'center', paddingTop: 20, paddingHorizontal: 32, fontSize: 14, lineHeight: 20 },
});
