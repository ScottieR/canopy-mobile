import { StyleSheet, TouchableOpacity, FlatList, View, Text, Switch, ScrollView } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { useEffect, useState } from 'react';
import { Bot, MapPin, Zap, Camera, Bell, Home, Activity, ChevronRight, ChevronDown } from 'lucide-react-native';

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
}

const SENSORS = [
  { id: 'apple_health', name: 'Apple Health Sync', desc: 'Sync vitals and workouts continuously in the background.', icon: Activity, color: '#ff2d55' },
  { id: 'live_location', name: 'Live Location & Geofencing', desc: 'Agent knows when you leave home or arrive at work.', icon: MapPin, color: '#007aff' },
  { id: 'shortcuts', name: 'Apple Shortcuts', desc: 'Allow the agent to trigger Siri Intents and Shortcuts.', icon: Zap, color: '#ff9500' },
  { id: 'vision', name: 'Vision & Photo Sync', desc: 'Agent silently indexes your recent camera roll for context.', icon: Camera, color: '#5856d6' },
  { id: 'notifications', name: 'Actionable Push Notifications', desc: 'Approve agent actions directly from your lock screen.', icon: Bell, color: '#ffcc00' },
  { id: 'homekit', name: 'Smart Home / HomeKit', desc: 'Bridge HomeKit access so the agent can control lights.', icon: Home, color: '#4cd964' },
];

export default function SensorsScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Fake state for toggles per agent
  const [sensorState, setSensorState] = useState<Record<string, Record<string, boolean>>>({});

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

  const toggleSensor = (agentId: string, sensorId: string, value: boolean) => {
    setSensorState(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] || {}),
        [sensorId]: value
      }
    }));
    // In a real app, this would send a message to the desktop to sync the token/status
    // sendMessage('update_sensor', { agentId, sensorId, value });
  };

  if (status !== 'connected') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sensors & Integrations</Text>
        <View style={styles.separator} />
        <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
          You must be connected to your Mac desktop to configure phone sensors for your agents.
        </Text>
      </View>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <View style={styles.container}>
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
                style={[styles.agentAvatar, isSelected && { borderColor: item.color || '#fff', borderWidth: 2 }]}
                onPress={() => setSelectedAgentId(item.id)}
              >
                {item.emoji && item.emoji.length <= 2 ? (
                  <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
                ) : (
                  <Bot size={32} color={item.color || '#888'} />
                )}
                <Text style={{ color: '#fff', fontSize: 10, marginTop: 4, fontWeight: isSelected ? 'bold' : 'normal' }} numberOfLines={1}>
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
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Configuring {selectedAgent.name}
              </Text>
              <Text style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
                Toggle which phone capabilities this agent can access.
              </Text>
            </View>

            {SENSORS.map(sensor => {
              const Icon = sensor.icon;
              const isEnabled = sensorState[selectedAgent.id]?.[sensor.id] || false;
              
              return (
                <View key={sensor.id} style={styles.sensorCard}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Icon size={20} color={sensor.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sensorName}>{sensor.name}</Text>
                    <Text style={styles.sensorDesc}>{sensor.desc}</Text>
                  </View>
                  <Switch 
                    value={isEnabled} 
                    onValueChange={(val) => toggleSensor(selectedAgent.id, sensor.id, val)} 
                    trackColor={{ false: '#333', true: '#218380' }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </>
        ) : (
          <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>No agents found.</Text>
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
    paddingTop: 60,
    backgroundColor: '#111',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  agentAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    padding: 4,
  },
  sensorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  sensorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  sensorDesc: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
    paddingRight: 10,
  }
});
