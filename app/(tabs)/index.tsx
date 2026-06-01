import { StyleSheet, TouchableOpacity, FlatList, View, Text, Platform, Image } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react-native';

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  image_url?: string | null;
  /** The agent's individual chat conversation ID — must be passed to chat/history calls
   *  so forum orchestration sessions never bleed into the mobile thread. */
  conversation_id?: string | null;
}

export default function HomeScreen() {
  const { status, error, disconnect, reconnect, sendMessage, subscribe } = useDispatch();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_agents');
      const unsub = subscribe('agents_list', (payload: Agent[]) => setAgents(payload));
      return unsub;
    }
  }, [status, sendMessage, subscribe]);

  // Status pill config
  const statusConfig = {
    connected:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Connected', Icon: Wifi },
    connecting:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Connecting…', Icon: RefreshCw },
    disconnected: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Reconnecting…', Icon: RefreshCw },
    error:        { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Disconnected', Icon: WifiOff },
  }[status];

  const renderAgent = ({ item }: { item: Agent }) => (
    <TouchableOpacity
      style={[styles.agentCard, { borderLeftColor: item.color || '#3c6663' }]}
      onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name)}&color=${encodeURIComponent(item.color)}${item.conversation_id ? `&session_id=${encodeURIComponent(item.conversation_id)}` : ''}`)}
      activeOpacity={0.85}
    >
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={styles.agentImage} />
        : (
          <View style={[styles.agentImageFallback, { backgroundColor: `${item.color || '#3c6663'}22` }]}>
            <Text style={[styles.agentInitial, { color: item.color || '#3c6663' }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )
      }
      <View style={styles.agentInfo}>
        <Text style={styles.agentName}>{item.name}</Text>
        <Text style={styles.agentRole}>{item.role}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Canopy</Text>

      {/* Status pill */}
      <TouchableOpacity
        style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}
        onPress={status === 'error' ? reconnect : undefined}
        activeOpacity={status === 'error' ? 0.7 : 1}
      >
        <statusConfig.Icon size={12} color={statusConfig.color} style={{ marginRight: 6 }} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        {status === 'error' && (
          <Text style={[styles.statusText, { color: statusConfig.color, marginLeft: 6, opacity: 0.7 }]}>· Tap to retry</Text>
        )}
      </TouchableOpacity>

      {/* Error details */}
      {error && status === 'error' && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {status !== 'connected' ? (
        <View style={styles.disconnectedContent}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/two')}>
            <Text style={styles.buttonText}>Scan QR Code to Pair</Text>
          </TouchableOpacity>
          {status === 'error' && (
            <TouchableOpacity style={[styles.primaryButton, styles.secondaryButton]} onPress={reconnect}>
              <Text style={[styles.buttonText, { color: '#3c6663' }]}>Try Reconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ flex: 1, width: '100%', paddingHorizontal: 16 }}>
          <FlatList
            data={agents}
            keyExtractor={a => a.id}
            renderItem={renderAgent}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListHeaderComponent={<Text style={styles.sectionTitle}>Your Swarm</Text>}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No agents yet — create one in the desktop app</Text>
            }
          />
          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, alignItems: 'center', paddingTop: 60, backgroundColor: '#faf9f6' },
  title:             { fontSize: 28, fontWeight: 'bold', color: '#2D3748', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 16 },

  statusPill:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 8 },
  statusText:        { fontSize: 13, fontWeight: '600' },
  errorText:         { fontSize: 12, color: '#ef4444', textAlign: 'center', paddingHorizontal: 32, marginBottom: 12, opacity: 0.8 },

  disconnectedContent: { alignItems: 'center', paddingTop: 24, gap: 12 },
  primaryButton:     { backgroundColor: '#3c6663', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  secondaryButton:   { backgroundColor: 'rgba(60,102,99,0.08)', shadowOpacity: 0 },
  buttonText:        { color: '#fff', fontWeight: '700', fontSize: 16 },

  sectionTitle:      { fontSize: 13, fontWeight: '700', color: '#718096', marginTop: 16, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4 },
  emptyText:         { color: '#A0AEC0', textAlign: 'center', paddingTop: 40, fontSize: 14 },

  agentCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  agentImage:        { width: 44, height: 44, borderRadius: 22, marginRight: 14 },
  agentImageFallback:{ width: 44, height: 44, borderRadius: 22, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  agentInitial:      { fontSize: 20, fontWeight: '700' },
  agentInfo:         { flex: 1 },
  agentName:         { fontSize: 16, fontWeight: '700', color: '#2D3748', marginBottom: 2 },
  agentRole:         { fontSize: 13, color: '#718096' },

  disconnectBtn:     { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, marginVertical: 20, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#fff' },
  disconnectText:    { color: '#718096', fontWeight: '500', fontSize: 14 },
});
