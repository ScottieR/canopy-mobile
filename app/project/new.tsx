import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';

export default function NewProjectShortcut() {
  const { status, sendMessage } = useDispatch();

  useEffect(() => {
    if (status === 'connected') {
      // Instruct the backend to create a new collaborative project space
      // with a few auto-selected agents.
      sendMessage('send_message', { 
        agent_id: 'system', // Or specific orchestrator agent
        text: 'COMMAND: CREATE_PROJECT_SPACE_AUTO'
      });
      
      // Give it a second to send, then go back to home
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    }
  }, [status, sendMessage]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3c6663" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Creating Project Space...</Text>
      <Text style={styles.subtitle}>Waking up agents and configuring blackboard...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  }
});
