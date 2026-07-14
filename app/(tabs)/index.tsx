import { StyleSheet, TouchableOpacity, FlatList, View, Text, Platform, Image, Share } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GenUIRenderer } from '../../components/GenUIRenderer';

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  image_url?: string | null;
  /** Desktop's currently-active conversation id. We intentionally IGNORE this
   *  on mobile and use a device-scoped session id instead — otherwise mobile
   *  would mirror whichever thread the desktop has open at the moment,
   *  including thread switches and even forum orchestration sessions.
   *  Kept on the type for diagnostic purposes only. */
  conversation_id?: string | null;
}

interface CompanionResource {
  id: string;
  profileId: string;
  agentId: string;
  resourceType: string;
  title: string;
  version: number;
  contentJson: any;
}

/** Mobile uses a stable per-agent session id, completely decoupled from the
 *  desktop's active thread. The backend creates this conversation lazily on
 *  first send_message / get_chat_history call. On the desktop's ThreadsRail
 *  the same conversation will appear as a regular thread the user can rename. */
function mobileSessionId(agentId: string, deviceId?: string): string {
  return deviceId ? `companion_${deviceId}_${agentId}` : `mobile_${agentId}`;
}

/** Build the deep link that launches the app directly into a live voice
 *  session with this agent. The URL uses the `canopymobile://` scheme
 *  declared in app.json + expo-router's auto-routing to /live/[id].
 *  Users can save this URL into an iOS Shortcut via the "Open URL" action;
 *  one tap on the Shortcut then launches Canopy → live mic call. */
function liveDeepLink(agent: Agent): string {
  const params = new URLSearchParams({
    name: agent.name,
    color: agent.color || '#3c6663',
  });
  return `canopymobile:///live/${agent.id}?${params.toString()}`;
}

/** Open the native share sheet with the live deep link pre-filled. On iOS the
 *  share sheet includes an "Add to Shortcuts" affordance — the user picks it
 *  and ends up with a one-tap "Go live with {agent}" shortcut on their home
 *  screen or Lock Screen widget. */
async function shareLiveShortcut(agent: Agent) {
  const url = liveDeepLink(agent);
  try {
    await Share.share({
      title: `Talk live with ${agent.name}`,
      message: `Talk live with ${agent.name}: ${url}`,
      url,                       // iOS uses this for the share-sheet preview
    }, {
      subject: `Talk live with ${agent.name}`,
      // Best UX hint for iOS — keeps the title pretty when saved to Shortcuts.
      dialogTitle: `Save as iOS Shortcut`,
    });
  } catch {
    // User cancelled — silent.
  }
}

export default function HomeScreen() {
  const { status, error, assignment, disconnect, reconnect, sendMessage, subscribe } = useDispatch();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [resources, setResources] = useState<CompanionResource[]>([]);
  // Honour the device's safe area instead of a hardcoded paddingTop: 60.
  // On notchless devices (small iPhones, most Android phones) this collapses
  // close to zero so we add a base padding for breathing room.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_agents');
      if (assignment?.experience === 'focused' || assignment?.experience === 'learning') {
        sendMessage('list_companion_resources');
      }
      const unsub = subscribe('agents_list', (payload: Agent[]) => setAgents(payload));
      const unsubResources = subscribe('companion_resources', (payload: CompanionResource[]) => setResources(payload ?? []));
      const unsubUpdates = subscribe('assignment_updated', () => {
        sendMessage('list_agents');
        sendMessage('list_companion_resources');
      });
      return () => { unsub(); unsubResources(); unsubUpdates(); };
    }
  }, [status, assignment?.experience, sendMessage, subscribe]);

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
      onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name)}&color=${encodeURIComponent(item.color)}&session_id=${encodeURIComponent(mobileSessionId(item.id, assignment?.deviceId))}`)}
      onLongPress={() => shareLiveShortcut(item)}
      delayLongPress={450}
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
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
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
            ListHeaderComponent={(
              <View>
                {assignment?.profile?.displayName && (
                  <Text style={styles.welcomeText}>Hi {assignment.profile.displayName}</Text>
                )}
                {resources.map((resource) => (
                  <View key={`${resource.id}:${resource.version}`} style={styles.resourceCard}>
                    <Text style={styles.resourceTitle}>{resource.title}</Text>
                    {resource.resourceType === 'mini_app' ? (
                      <GenUIRenderer
                        payload={resource.contentJson}
                        onAction={(action, data) => sendMessage('companion_resource_action', {
                          resource_id: resource.id,
                          agent_id: resource.agentId,
                          action,
                          data,
                        })}
                      />
                    ) : (
                      <Text style={styles.resourceBody}>{String(resource.contentJson?.summary ?? resource.contentJson?.text ?? '')}</Text>
                    )}
                  </View>
                ))}
                <Text style={styles.sectionTitle}>
                  {assignment?.experience === 'learning' ? 'Your learning companion' : assignment?.experience === 'focused' ? 'Shared with you' : 'Your Swarm'}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No agents yet — create one in the desktop app</Text>
            }
            ListFooterComponent={
              agents.length > 0 ? (
                <Text style={styles.shortcutHint}>
                  Long-press an agent to save them as an iOS Shortcut — one tap to go live.
                </Text>
              ) : null
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
  // paddingTop is applied inline from useSafeAreaInsets so it adapts per device.
  container:         { flex: 1, alignItems: 'center', backgroundColor: '#faf9f6' },
  title:             { fontSize: 28, fontWeight: 'bold', color: '#2D3748', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 16 },

  statusPill:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 8 },
  statusText:        { fontSize: 13, fontWeight: '600' },
  errorText:         { fontSize: 12, color: '#ef4444', textAlign: 'center', paddingHorizontal: 32, marginBottom: 12, opacity: 0.8 },

  disconnectedContent: { alignItems: 'center', paddingTop: 24, gap: 12 },
  primaryButton:     { backgroundColor: '#3c6663', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  secondaryButton:   { backgroundColor: 'rgba(60,102,99,0.08)', shadowOpacity: 0 },
  buttonText:        { color: '#fff', fontWeight: '700', fontSize: 16 },

  sectionTitle:      { fontSize: 13, fontWeight: '700', color: '#718096', marginTop: 16, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4 },
  welcomeText:       { fontSize: 24, fontWeight: '700', color: '#2D3748', marginTop: 16, marginBottom: 8 },
  resourceCard:      { backgroundColor: '#F7FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginTop: 12 },
  resourceTitle:     { fontSize: 13, fontWeight: '700', color: '#4A5568', marginBottom: 8 },
  resourceBody:      { fontSize: 14, color: '#4A5568', lineHeight: 20 },
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
  shortcutHint:      { fontSize: 11, color: '#A0AEC0', textAlign: 'center', marginTop: 12, paddingHorizontal: 24, lineHeight: 16 },
});
