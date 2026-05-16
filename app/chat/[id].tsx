import { StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, View, Text } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useDispatch } from '../../context/DispatchContext';
import { useEffect, useState, useRef } from 'react';
import { Send, ArrowLeft } from 'lucide-react-native';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
}

export default function ChatScreen() {
  const { id, name, color } = useLocalSearchParams<{ id: string, name: string, color: string }>();
  const { status, sendMessage, subscribe } = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('get_chat_history', { agent_id: id });

      const unsubHistory = subscribe('chat_history', (history: any[]) => {
        // Map backend history to our format
        const mapped = history.map(m => ({
          id: m.id || Math.random().toString(),
          role: m.role,
          content: m.content || m.text || '',
          timestamp: m.timestamp || m.ts || Date.now(),
        }));
        setMessages(mapped);
      });

      const unsubResponse = subscribe('chat_response', (payload: any) => {
        if (payload.agent_id === id) {
          setIsSending(false);
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            role: 'agent',
            content: payload.response?.response || payload.response?.content || String(payload.response),
            timestamp: Date.now()
          }]);
        }
      });

      return () => {
        unsubHistory();
        unsubResponse();
      };
    }
  }, [id, status, sendMessage, subscribe]);

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    
    const newMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, newMsg]);
    setIsSending(true);
    sendMessage('send_message', { agent_id: id, text: inputText.trim() });
    setInputText('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAgent]}>
        <View style={[
          styles.messageBubble, 
          isUser ? [styles.messageBubbleUser, { backgroundColor: color || '#218380' }] : styles.messageBubbleAgent
        ]}>
          <Text 
            style={isUser ? styles.messageTextUser : styles.messageTextAgent}
            selectable={true}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: name || 'Chat',
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -10, padding: 10 }}>
              <ArrowLeft color="#fff" size={24} />
            </TouchableOpacity>
          )
        }} 
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isSending && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={color || "#218380"} />
          <Text style={styles.loadingText}>Agent is thinking...</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Send a message..."
            placeholderTextColor="#888"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: inputText.trim() ? (color || '#218380') : '#444' }]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Send color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAgent: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleUser: {
    borderBottomRightRadius: 4,
  },
  messageBubbleAgent: {
    backgroundColor: '#222',
    borderBottomLeftRadius: 4,
  },
  messageTextUser: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextAgent: {
    color: '#eee',
    fontSize: 16,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  loadingText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: '#111',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  }
});
