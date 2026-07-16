import { StyleSheet, TouchableOpacity, FlatList, View, Text, Switch, ScrollView, Platform } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { useEffect, useState } from 'react';
import { Bot, MapPin, Zap, Camera, Bell, Home, Activity, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
}

const SENSORS = [
  { id: 'apple_health', name: 'Apple Health Sync', desc: 'Sync vitals and workouts continuously in the background.', icon: Activity, color: '#ff2d55', prefix: 'ah_' },
  { id: 'live_location', name: 'Live Location & Geofencing', desc: 'Agent knows when you leave home or arrive at work.', icon: MapPin, color: '#007aff', prefix: 'll_' },
  { id: 'shortcuts', name: 'Apple Shortcuts', desc: 'Allow the agent to trigger Siri Intents and Shortcuts.', icon: Zap, color: '#ff9500', prefix: 'sh_' },
  { id: 'vision', name: 'Vision & Photo Sync', desc: 'Agent silently indexes your recent camera roll for context.', icon: Camera, color: '#5856d6', prefix: 'vs_' },
  { id: 'notifications', name: 'Actionable Push Notifications', desc: 'Approve agent actions directly from your lock screen.', icon: Bell, color: '#ffcc00', prefix: 'pn_' },
  { id: 'homekit', name: 'Smart Home / HomeKit', desc: 'Bridge HomeKit access so the agent can control lights.', icon: Home, color: '#4cd964', prefix: 'hk_' },
];

export default function SensorsScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Fake state for toggles per agent
  const [sensorState, setSensorState] = useState<Record<string, Record<string, boolean>>>({});
  const [sensorTokens, setSensorTokens] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_agents');
      const unsubscribe = subscribe('agents_list', (payload: Agent[]) => {
        setAgents(payload);
        if (payload.length > 0 && !selectedAgentId) {
          setSelectedAgentId(payload[0].id);
        }
      });
      return unsubscribe;
    }
  }, [status, sendMessage, subscribe]);

  const toggleSensor = async (agentId: string, sensorId: string, value: boolean, prefix: string) => {
    setSensorState(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] || {}),
        [sensorId]: value
      }
    }));
    
    // Generate a secure bridge token if turning on and one doesn't exist
    if (value) {
      const agentTokens = sensorTokens[agentId] || {};
      if (!agentTokens[sensorId]) {
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        const randomString = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
        const token = `${prefix}${randomString}`;
        
        sendMessage('set_sensor_token', { agent_id: agentId, sensor_id: sensorId, token });
        
        setSensorTokens(prev => ({
          ...prev,
          [agentId]: {
            ...(prev[agentId] || {}),
            [sensorId]: token
          }
        }));
      }
    }
  };

  if (status !== 'connected') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sensors & Integrations</Text>
        <View style={styles.separator} />
        <Text style={{ color: '#718096', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
          You must be connected to your Mac desktop to configure phone sensors for your agents.
        </Text>
      </View>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Sensors & Integrations</Text>
      <View style={styles.separator} />

      {/* Agent Picker Horizontal List */}
      <View style={{ height: 100, marginBottom: 10 }}>
        <FlatList
          horizontal
          data={agents}
          keyExtractor={a => a.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedAgentId;
            return (
              <TouchableOpacity 
                style={[styles.agentAvatar, isSelected && { borderColor: item.color || '#3c6663', borderWidth: 3 }]}
                onPress={() => setSelectedAgentId(item.id)}
              >
                {item.emoji && item.emoji.length <= 2 ? (
                  <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
                ) : (
                  <Bot size={32} color={item.color || '#888'} />
                )}
                <Text style={{ color: '#2D3748', fontSize: 10, marginTop: 4, fontWeight: isSelected ? '700' : '500' }} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Sensors List for Selected Agent */}
      <ScrollView style={{ flex: 1, width: '100%', paddingHorizontal: 20 }}>
        {selectedAgent ? (
          <>
            <View style={{ marginBottom: 20, paddingHorizontal: 4 }}>
              <Text style={{ color: '#2D3748', fontSize: 16, fontWeight: '700' }}>
                Configuring {selectedAgent.name}
              </Text>
              <Text style={{ color: '#718096', fontSize: 13, marginTop: 4 }}>
                Toggle which phone capabilities this agent can access.
              </Text>
            </View>

            {SENSORS.map(sensor => {
              const Icon = sensor.icon;
              const isEnabled = sensorState[selectedAgent.id]?.[sensor.id] || false;
              
              return (
                <View key={sensor.id} style={{ marginBottom: 12 }}>
                  <View style={styles.sensorCard}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Icon size={20} color={sensor.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sensorName}>{sensor.name}</Text>
                      <Text style={styles.sensorDesc}>{sensor.desc}</Text>
                    </View>
                    <Switch 
                      value={isEnabled} 
                      onValueChange={(val) => toggleSensor(selectedAgent.id, sensor.id, val, sensor.prefix)} 
                      trackColor={{ false: '#E2E8F0', true: '#3c6663' }}
                      thumbColor="#fff"
                    />
                  </View>
                  
                  {isEnabled && sensorTokens[selectedAgent.id]?.[sensor.id] && (
                    <View style={styles.tokenContainer}>
                      <Text style={[styles.tokenLabel, { color: '#3c6663' }]}>Synced automatically to your Mac ✓</Text>
                      <View style={styles.tokenBox}>
                        <Text style={styles.tokenText} selectable={true}>
                          {sensorTokens[selectedAgent.id][sensor.id]}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <Text style={{ color: '#718096', textAlign: 'center', marginTop: 40 }}>No agents found.</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    // paddingTop is applied inline from useSafeAreaInsets so it adapts per device.
    backgroundColor: '#faf9f6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: '#E2E8F0',
  },
  agentAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sensorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F4F8',
  },
  sensorName: {
    color: '#2D3748',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sensorDesc: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 16,
    paddingRight: 10,
  },
  tokenContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: -4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  tokenLabel: {
    color: '#2D3748',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  tokenBox: {
    backgroundColor: '#F0F4F8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tokenText: {
    color: '#218380',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  }
});
