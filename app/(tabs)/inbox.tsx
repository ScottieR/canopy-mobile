import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Mic, Zap, FileText, Check, ArrowRight, CheckCircle, Pause, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPrimaryInboxAction } from './inboxActions';

type InboxItemType =
  | 'voice_note'
  | 'agent_request'
  | 'forum_milestone'
  | 'forum_deliverable'
  | 'forum_blocked'
  | 'forum_paused';

interface InboxItem {
  id: string;
  type: InboxItemType;
  content: string;
  timestamp: number;
  agent_id?: string;
  agent_name?: string;
  forum_id?: string;
  forum_title?: string;
  suggestion?: string;
}

const TYPE_CONFIG: Record<InboxItemType, { Icon: any; color: string; bg: string; label: string }> = {
  voice_note:         { Icon: Mic,           color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', label: 'Voice Note'        },
  agent_request:      { Icon: Zap,           color: '#3c6663', bg: 'rgba(60,102,99,0.08)',  label: 'Agent Request'     },
  forum_milestone:    { Icon: Check,         color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Phase Complete'    },
  forum_deliverable:  { Icon: CheckCircle,   color: '#4A9E96', bg: 'rgba(74,158,150,0.08)', label: 'Deliverable Ready' },
  forum_blocked:      { Icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Needs Your Input'  },
  forum_paused:       { Icon: Pause,         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'Forum Paused'      },
};

// (no mock data)

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function InboxCard({ item, onApprove, onDismiss }: { item: InboxItem; onApprove: (id: string) => void; onDismiss: (id: string) => void }) {
  const cfg = TYPE_CONFIG[item.type];
  const primaryAction = getPrimaryInboxAction(item);

  const handlePrimary = () => {
    if (primaryAction.kind === 'approve') {
      onApprove(item.id);
      return;
    }

    if (primaryAction.kind === 'open_forum' && primaryAction.href) {
      router.push(primaryAction.href as never);
    }

    onDismiss(item.id);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
          <cfg.Icon size={14} color={cfg.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {(item.forum_title ?? item.agent_name) ? <Text style={styles.sourceLabel}>{item.forum_title ?? item.agent_name}</Text> : null}
        </View>
        <Text style={styles.timeText}>{timeAgo(item.timestamp)}</Text>
      </View>

      <Text style={styles.content}>{item.content}</Text>

      {item.suggestion && (
        <View style={styles.suggestionRow}>
          <Zap size={11} color="#718096" />
          <Text style={styles.suggestionText}>{item.suggestion}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissBtn} onPress={() => onDismiss(item.id)}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: cfg.color }]} onPress={handlePrimary}>
          <Text style={styles.primaryText}>{primaryAction.label}</Text>
          <ArrowRight size={13} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [items, setItems] = useState<InboxItem[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (status !== 'connected') return;
    sendMessage('list_inbox');
    const unsub = subscribe('inbox_list', (payload: InboxItem[]) => setItems(payload));
    const unsubPush = subscribe('inbox_push', (item: InboxItem) => setItems(prev => [item, ...prev.filter(i => i.id !== item.id)]));
    return () => { unsub(); unsubPush(); };
    // No else — keep whatever real items were loaded; they're still actionable
  }, [status, sendMessage, subscribe]);

  const handleApprove = (id: string) => {
    if (status === 'connected') sendMessage('resolve_inbox_item', { id, resolution: 'approved' });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleDismiss = (id: string) => {
    if (status === 'connected') sendMessage('resolve_inbox_item', { id, resolution: 'dismissed' });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const urgent = items.filter(i => ['forum_blocked', 'forum_paused', 'agent_request'].includes(i.type));
  const ready  = items.filter(i => ['forum_deliverable', 'forum_milestone'].includes(i.type));
  const other  = items.filter(i => !urgent.includes(i) && !ready.includes(i));
  const sections = [
    ...(urgent.length > 0 ? [{ title: '⚡ Needs Attention', data: urgent }] : []),
    ...(ready.length  > 0 ? [{ title: '✅ Ready to View',   data: ready  }] : []),
    ...(other.length  > 0 ? [{ title: '📬 Updates',          data: other  }] : []),
  ];
  const flat = sections.flatMap(s => [{ _header: s.title } as any, ...s.data]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.pageTitle}>Inbox</Text>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {status === 'connected' ? 'All clear' : 'Not connected'}
          </Text>
          <Text style={styles.emptySubText}>
            {status === 'connected'
              ? 'Decisions and deliverables from your agents appear here'
              : 'Connect to your Mac to receive agent updates'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flat}
          keyExtractor={(item: any) => item.id ?? item._header}
          renderItem={({ item }: any) =>
            item._header
              ? <Text style={styles.sectionHeader}>{item._header}</Text>
              : <InboxCard item={item} onApprove={handleApprove} onDismiss={handleDismiss} />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop is applied inline from useSafeAreaInsets so it adapts per device.
  container:      { flex: 1, backgroundColor: '#faf9f6' },
  pageTitle:      { fontSize: 28, fontWeight: 'bold', color: '#2D3748', paddingHorizontal: 20, marginBottom: 16 },
  sectionHeader:  { fontSize: 12, fontWeight: '700', color: '#718096', paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconBadge:      { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sourceLabel:    { fontSize: 12, color: '#718096', marginTop: 1 },
  timeText:       { fontSize: 12, color: '#A0AEC0' },
  content:        { fontSize: 15, color: '#2D3748', lineHeight: 22, marginBottom: 10 },
  suggestionRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, padding: 8, backgroundColor: '#F7FAFC', borderRadius: 8 },
  suggestionText: { fontSize: 12, color: '#718096', flex: 1 },
  actions:        { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  dismissBtn:     { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  dismissText:    { fontSize: 14, color: '#718096', fontWeight: '500' },
  primaryBtn:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  primaryText:    { fontSize: 14, color: '#fff', fontWeight: '600' },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText:      { fontSize: 22, fontWeight: '700', color: '#2D3748', marginBottom: 8 },
  emptySubText:   { fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 20 },
});
