import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <MessageSquare size={40} color={THEME.primary} />
        </View>
        <Text style={styles.title}>Chat</Text>
        <Text style={styles.subtitle}>Under building</Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressBar} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#14171A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#657786', marginBottom: 24 },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#F0F3F5', borderRadius: 3, overflow: 'hidden' },
  progressBar: { width: '60%', height: '100%', backgroundColor: THEME.primary },
});
