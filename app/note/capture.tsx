import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function CaptureNoteShortcut() {
  const { status, sendMessage } = useDispatch();
  const [isRecording, setIsRecording] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Auto-start recording on mount for the zero-tap Back Tap shortcut
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRecording(true);
    setStatusText('Listening...');
    
    Animated.loop(
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.5, friction: 5, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 5, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const handleStopRecording = () => {
    scaleAnim.stopAnimation();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    setStatusText('Processing and sending to agent swarm...');
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
    
    setTimeout(() => {
      if (status === 'connected') {
        setStatusText('Voice capture is not wired yet. Open chat and type your note.');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1600);
      } else {
        setStatusText('Not connected to desktop.');
        setTimeout(() => router.replace('/(tabs)'), 2000);
      }
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Capture</Text>
      <Text style={styles.subtitle}>Send a voice note straight to your agents' memory.</Text>

      <View style={styles.walkieContainer}>
        <Pressable
          onPress={handleStopRecording}
          style={styles.walkieButtonOuter}
        >
          <Animated.View style={[
            styles.walkieButtonInner, 
            { backgroundColor: isRecording ? '#EF4444' : '#3c6663' },
            { transform: [{ scale: scaleAnim }] }
          ]}>
            <Mic color="#fff" size={isRecording ? 56 : 48} />
          </Animated.View>
        </Pressable>
        <Text style={styles.walkieHint}>{statusText}</Text>
        {isRecording && (
          <Text style={{ color: '#718096', fontSize: 13, marginTop: 12 }}>
            Tap the button to stop & send
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f6',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 60,
  },
  walkieContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 100,
  },
  walkieButtonOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  walkieButtonInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
