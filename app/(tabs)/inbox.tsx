import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { useEffect, useState } from 'react';
import { Mic, Zap, FileText, Check, ArrowRight } from 'lucide-react-native';

interface InboxItem {
  id: string;
  type: 'voice_note' | 'agent_request';
  content: string;
  timestamp: number;
  agent_id?: string;
  agent_name?: string;
  suggestion?: string; // Orchestrator suggestion
}

export default function InboxScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_inbox');
      const unsubscribe = subscribe('inbox_list', (payload: InboxItem[]) => {
        setItems(payload);
      });
      return unsubscribe;
    } else {
      // Mock data for preview when disconnected
      setItems([
        {
          id: '1',
          type: 'voice_note',
          content: 'I need to rethink the database schema for the user auth flow, remind me to look at how supabase does their row level security.',
          timestamp: Date.now() - 1000 * 60 * 5,
          suggestion: 'Route to "Backend Architect" Agent',
        },
        {
          id: '2',
          type: 'agent_request',
          content: 'I need permission to navigate to github.com to review the PR.',
          agent_name: 'Code Reviewer',
          timestamp: Date.now() - 1000 * 60 * 60,
        }
      ]);
    }
  }, [status, sendMessage, subscribe]);

  const handleApprove = (id: string) => {
    if (status === 'connected') {
      sendMessage('send_message', { 
        agent_id: 'system', 
        text: `COMMAND: APPROVE_INBOX_ITEM: ${id}` 
      });
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleDismiss = (id: string) => {
    if (status === 'connected') {
      sendMessage('send_message', { 
        agent_id: 'system', 
        text: `COMMAND: DISMISS_INBOX_ITEM: ${id}` 
      });
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const renderItem = ({ item }: { item: InboxItem }) => {
    const isVoice = item.type === 'voice_note';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: isVoice ? '#EBF8FF' : '#FEF3C7' }]}>
            {isVoice ? <Mic size={16} color="#3182CE" /> : <Zap size={16} color="#D97706" />}
          </View>
          <Text style={styles.cardMeta}>
            {isVoice ? 'Quick Capture' : `${item.agent_name} Request`} • {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
        
        <Text style={styles.content}>{item.content}</Text>
        
        {item.suggestion && (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionLabel}>SYSTEM SUGGESTION</Text>
            <Text style={styles.suggestionText}>{item.suggestion}</Text>
          </View>
        )}
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnApprove]}
            onPress={() => handleApprove(item.id)}
          >
            <Check size={16} color="#fff" />
            <Text style={styles.btnApproveText}>
              {item.suggestion ? 'Approve Routing' : 'Approve'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnDismiss]}
            onPress={() => handleDismiss(item.id)}
          >
            <Text style={styles.btnDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Global Inbox</Text>
      <View style={styles.separator} />
      
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Check size={48} color="#CBD5E0" />
            <Text style={styles.emptyStateText}>Inbox Zero</Text>
            <Text style={styles.emptyStateSub}>You're all caught up!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#faf9f6',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    paddingHorizontal: 20,
  },
  separator: {
    marginVertical: 16,
    height: 1,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
  },
  content: {
    fontSize: 15,
    color: '#2D3748',
    lineHeight: 22,
    marginBottom: 16,
  },
  suggestionBox: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  suggestionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#A0AEC0',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '500',
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnApprove: {
    backgroundColor: '#3c6663',
  },
  btnApproveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnDismiss: {
    backgroundColor: '#EDF2F7',
  },
  btnDismissText: {
    color: '#4A5568',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A0AEC0',
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 14,
    color: '#CBD5E0',
    marginTop: 4,
  }
});
