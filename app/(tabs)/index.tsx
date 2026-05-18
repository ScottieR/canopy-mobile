import { StyleSheet, TouchableOpacity, FlatList, View, Text, Platform } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react-native';

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
}

export default function HomeScreen() {
  const { status, disconnect, sendMessage, subscribe } = useDispatch();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_agents');
      const unsubscribe = subscribe('agents_list', (payload: Agent[]) => {
        setAgents(payload);
      });
      return unsubscribe;
    }
  }, [status, sendMessage, subscribe]);

  const renderAgent = ({ item }: { item: Agent }) => {
    const isTextFallback = item.emoji && item.emoji.length > 2;
    
    return (
      <TouchableOpacity 
        style={[styles.agentCard, { borderLeftColor: item.color || '#333' }]}
        onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name)}&color=${encodeURIComponent(item.color)}`)}
      >
        {isTextFallback ? (
          <View style={{ marginRight: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} color={item.color || "#888"} />
          </View>
        ) : (
          <Text style={styles.agentEmoji}>{item.emoji || '🤖'}</Text>
        )}
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentRole}>{item.role}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Canopy Dispatch</Text>
      <View style={styles.separator} />

      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: status === 'connected' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b' }]} />
        <Text style={styles.statusText}>
          {status === 'disconnected' ? 'Not connected' : 
           status === 'connecting' ? 'Connecting to Mac...' :
           status === 'error' ? 'Connection Error' : 
           'Connected securely'}
        </Text>
      </View>

      {status !== 'connected' ? (
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/two')}
        >
          <Text style={styles.buttonText}>Scan QR Code</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, width: '100%', paddingHorizontal: 20 }}>
          <FlatList
            data={agents}
            keyExtractor={a => a.id}
            renderItem={renderAgent}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListHeaderComponent={<Text style={styles.sectionTitle}>Your Swarm</Text>}
          />
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: '#fff', alignSelf: 'center', marginTop: 20, marginBottom: 40, borderWidth: 1, borderColor: '#E2E8F0', shadowOpacity: 0.05 }]}
            onPress={() => disconnect()}
          >
            <Text style={[styles.buttonText, { color: '#718096' }]}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
    marginLeft: 4,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#F0F4F8',
    borderRightColor: '#F0F4F8',
    borderBottomColor: '#F0F4F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  agentEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  agentRole: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#3c6663',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3c6663',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  }
});
