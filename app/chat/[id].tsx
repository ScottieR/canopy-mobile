import { StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, View, Text } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Animated, Platform, Pressable } from 'react-native';
import { Send, ArrowLeft, Mic, Keyboard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GenUIRenderer } from '../../components/GenUIRenderer';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
}

export default function ChatScreen() {
  const { id, name, color, mode } = useLocalSearchParams<{ id: string, name?: string, color?: string, mode?: string }>();
  const { status, sendMessage, subscribe } = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>(mode === 'voice' ? 'voice' : 'text');
  const [isRecording, setIsRecording] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
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

  const handleSendText = () => {
    if (!inputText.trim() || isSending) return;
    sendMessageInternal(inputText.trim());
    setInputText('');
  };

  const sendMessageInternal = (text: string) => {
    const newMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, newMsg]);
    setIsSending(true);
    sendMessage('send_message', { agent_id: id, text: text });
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRecording(true);
    Animated.spring(scaleAnim, {
      toValue: 1.5,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
    
    // Mock sending the voice transcription
    setTimeout(() => {
      sendMessageInternal('*(Sent via Voice Walkie-Talkie)* Hey Sloane, what is the status of my recent project?');
    }, 500);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    
    // Check if content is a GenUI JSON payload
    let genUIPayload = null;
    if (!isUser && item.content.trim().startsWith('{') && item.content.includes('"component"')) {
      try {
        genUIPayload = JSON.parse(item.content);
      } catch (e) {
        // Not valid JSON, treat as text
      }
    }

    if (genUIPayload && genUIPayload.component) {
      return (
        <View style={[styles.messageWrapper, styles.messageWrapperAgent]}>
           <GenUIRenderer 
             payload={genUIPayload} 
             onAction={(action, data) => {
               const replyText = `I chose to ${action} the ${genUIPayload.component} payload.`;
               sendMessage('send_message', { agent_id: id, text: replyText });
               setMessages(prev => [...prev, {
                 id: Math.random().toString(),
                 role: 'user',
                 content: replyText,
                 timestamp: Date.now()
               }]);
             }}
           />
        </View>
      );
    }

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
          headerStyle: { backgroundColor: '#faf9f6' },
          headerShadowVisible: false,
          headerTintColor: '#2D3748',
          headerTitleStyle: { fontWeight: '700' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -10, padding: 10 }}>
              <ArrowLeft color="#2D3748" size={24} />
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
          {inputMode === 'text' ? (
            <>
              <TouchableOpacity style={styles.modeSwitchBtn} onPress={() => setInputMode('voice')}>
                <Mic color="#718096" size={24} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message..."
                placeholderTextColor="#A0AEC0"
                multiline
                maxLength={1000}
              />
              <TouchableOpacity 
                style={[styles.sendButton, { backgroundColor: inputText.trim() ? (color || '#3c6663') : '#E2E8F0' }]}
                onPress={handleSendText}
                disabled={!inputText.trim() || isSending}
              >
                <Send color={inputText.trim() ? "#fff" : "#A0AEC0"} size={20} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.voiceModeContainer}>
              <TouchableOpacity style={styles.modeSwitchBtnAbsolute} onPress={() => setInputMode('text')}>
                <Keyboard color="#718096" size={24} />
              </TouchableOpacity>
              
              <View style={styles.walkieContainer}>
                <Pressable
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={styles.walkieButtonOuter}
                >
                  <Animated.View style={[
                    styles.walkieButtonInner, 
                    { backgroundColor: isRecording ? '#EF4444' : (color || '#3c6663') },
                    { transform: [{ scale: scaleAnim }] }
                  ]}>
                    <Mic color="#fff" size={isRecording ? 48 : 40} />
                  </Animated.View>
                </Pressable>
                <Text style={styles.walkieHint}>
                  {isRecording ? "Listening..." : "Hold to Speak"}
                </Text>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f6',
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
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  messageBubbleUser: {
    borderBottomRightRadius: 4,
  },
  messageBubbleAgent: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageTextUser: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextAgent: {
    color: '#2D3748',
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
    color: '#718096',
    marginLeft: 8,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    color: '#2D3748',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeSwitchBtn: {
    padding: 10,
    marginRight: 4,
    justifyContent: 'center',
  },
  modeSwitchBtnAbsolute: {
    position: 'absolute',
    left: 16,
    bottom: Platform.OS === 'ios' ? 30 : 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
  },
  voiceModeContainer: {
    flex: 1,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  walkieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkieButtonOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  walkieButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  walkieHint: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
  }
});
