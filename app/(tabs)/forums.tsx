import { StyleSheet, FlatList, View, Text, TouchableOpacity, Image } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Users, CheckCircle, Clock, Pause, Zap, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ForumStatus = 'drafting' | 'active' | 'paused' | 'completed' | 'archived';

interface ForumAgent {
  agentId: string;
  name: string;
  robeColor: string;
  image?: string | null;
}

interface Forum {
  id: string;
  title: string;
  brief: string;
  status: ForumStatus;
  agents: ForumAgent[];
  currentPhase?: string;        // label of active milestone
  completedMilestones: number;
  totalMilestones: number;
  artifactCount: number;
  hasDeliverable: boolean;
  lastActiveAt: number;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ForumStatus, { label: string; color: string; bg: string; Icon: any }> = {
  active:    { label: 'Active',    color: '#3c6663', bg: 'rgba(60,102,99,0.1)',  Icon: Zap          },
  completed: { label: 'Done',      color: '#10b981', bg: 'rgba(16,185,129,0.1)', Icon: CheckCircle  },
  paused:    { label: 'Paused',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', Icon: Pause        },
  drafting:  { label: 'Drafting',  color: '#718096', bg: 'rgba(113,128,150,0.1)',Icon: Clock        },
  archived:  { label: 'Archived',  color: '#a0aec0', bg: 'rgba(160,174,192,0.1)',Icon: Clock        },
};

// Mock data block deleted (was shipping in the bundle). Only real forums from
// the desktop's dispatch sync are shown now.

// ─── Forum card ───────────────────────────────────────────────────────────────

function ForumCard({ forum }: { forum: Forum }) {
  const cfg = STATUS_CONFIG[forum.status];
  const progress = forum.totalMilestones > 0
    ? forum.completedMilestones / forum.totalMilestones
    : 0;

  const timeAgo = (() => {
    const s = Math.floor((Date.now() - forum.lastActiveAt) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  })();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/chat/${forum.id}?name=${encodeURIComponent(forum.title)}&mode=forum`)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{forum.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <cfg.Icon size={10} color={cfg.color} style={{ marginRight: 4 }} />
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Brief */}
      <Text style={styles.cardBrief} numberOfLines={2}>{forum.brief}</Text>

      {/* Progress bar (shown when active or paused) */}
      {(forum.status === 'active' || forum.status === 'paused') && forum.totalMilestones > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: forum.status === 'paused' ? '#f59e0b' : '#3c6663' }]} />
          </View>
          <Text style={styles.progressLabel}>
            {forum.currentPhase || `${forum.completedMilestones}/${forum.totalMilestones} phases`}
          </Text>
        </View>
      )}

      {/* Deliverable ready badge */}
      {forum.hasDeliverable && (
        <View style={styles.deliverableBadge}>
          <CheckCircle size={11} color="#10b981" style={{ marginRight: 4 }} />
          <Text style={styles.deliverableText}>Deliverable ready</Text>
        </View>
      )}

      {/* Footer: agent pips + meta */}
      <View style={styles.cardFooter}>
        <View style={styles.agentPips}>
          {forum.agents.slice(0, 4).map((a, i) => (
            <View
              key={a.agentId}
              style={[styles.pip, { backgroundColor: `${a.robeColor}28`, borderColor: `${a.robeColor}88`, marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }]}
            >
              {a.image
                ? <Image source={{ uri: a.image }} style={styles.pipImage} />
                : <Text style={[styles.pipInitial, { color: a.robeColor }]}>{a.name.charAt(0)}</Text>
              }
            </View>
          ))}
          {forum.agents.length > 4 && (
            <View style={[styles.pip, styles.pipExtra, { marginLeft: -6 }]}>
              <Text style={styles.pipExtraText}>+{forum.agents.length - 4}</Text>
            </View>
          )}
        </View>
        <Text style={styles.metaText}>
          {forum.artifactCount} {forum.artifactCount === 1 ? 'file' : 'files'} · {timeAgo}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ForumsScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [forums, setForums] = useState<Forum[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (status !== 'connected') return;
    // Request immediately, then once more after 1.5s to handle the race
    // where the mobile connects before the desktop has synced mobile_state.
    sendMessage('list_forums');
    const retry = setTimeout(() => sendMessage('list_forums'), 1500);
    const unsub = subscribe('forums_list', (payload: Forum[]) => setForums(payload));
    return () => { clearTimeout(retry); unsub(); };
  }, [status, sendMessage, subscribe]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Forums</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/project/new')}
        >
          <Plus size={18} color="#3c6663" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={forums}
        keyExtractor={f => f.id}
        renderItem={({ item }) => <ForumCard forum={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {status === 'connected' ? 'No forums yet' : 'Not connected'}
            </Text>
            <Text style={styles.emptySubText}>
              {status === 'connected'
                ? 'Tap + to start a new one from your Mac'
                : 'Connect to your Mac to see your forums'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop is applied inline from useSafeAreaInsets so it adapts per device.
  container:      { flex: 1, backgroundColor: '#faf9f6' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  pageTitle:      { fontSize: 28, fontWeight: 'bold', color: '#2D3748', flex: 1 },
  newBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(60,102,99,0.1)', alignItems: 'center', justifyContent: 'center' },

  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardTitle:      { fontSize: 16, fontWeight: '700', color: '#2D3748', flex: 1, marginRight: 8 },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusLabel:    { fontSize: 11, fontWeight: '600' },

  cardBrief:      { fontSize: 13, color: '#718096', lineHeight: 18, marginBottom: 10 },

  progressRow:    { marginBottom: 8 },
  progressTrack:  { height: 3, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 4 },
  progressFill:   { height: 3, borderRadius: 2 },
  progressLabel:  { fontSize: 11, color: '#718096' },

  deliverableBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 10 },
  deliverableText:  { fontSize: 11, color: '#10b981', fontWeight: '600' },

  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentPips:      { flexDirection: 'row', alignItems: 'center' },
  pip:            { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pipImage:       { width: '100%', height: '100%' },
  pipInitial:     { fontSize: 8, fontWeight: '700' },
  pipExtra:       { backgroundColor: '#E2E8F0', borderColor: '#CBD5E0' },
  pipExtraText:   { fontSize: 8, color: '#718096', fontWeight: '600' },

  metaText:       { fontSize: 11, color: '#A0AEC0' },

  empty:          { alignItems: 'center', paddingTop: 60 },
  emptyText:      { fontSize: 18, fontWeight: '600', color: '#2D3748' },
  emptySubText:   { fontSize: 14, color: '#718096', marginTop: 4 },
});
