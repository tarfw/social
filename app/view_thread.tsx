import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import PostCard from '../components/PostCard';

type ThreadNode = {
  $type: string;
  post: any;
  parent?: ThreadNode;
  replies?: ThreadNode[];
};

export default function ThreadScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { agent } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [thread, setThread] = useState<ThreadNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchThread = useCallback(async () => {
    if (!agent || !uri) return;
    try {
      setIsLoading(true);
      const res = await agent.getPostThread({ uri, depth: 6, parentHeight: 10 });
      setThread(res.data.thread as ThreadNode);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [agent, uri]);

  useEffect(() => { fetchThread(); }, [fetchThread]);

  function collectParents(node: ThreadNode | undefined): any[] {
    if (!node) return [];
    const parents = collectParents(node.parent);
    if (node.$type === 'app.bsky.feed.defs#threadViewPost') {
      return [...parents, node.post];
    }
    return parents;
  }

  function directReplies(node: ThreadNode): any[] {
    return (node.replies ?? [])
      .filter(r => r.$type === 'app.bsky.feed.defs#threadViewPost')
      .map(r => r.post);
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0085FF" />
      </View>
    );
  }

  const focusedPost = thread?.post;
  const parentPosts = collectParents(thread?.parent);
  const replyPosts  = thread ? directReplies(thread) : [];

  type ListItem =
    | { kind: 'parent'; post: any; key: string }
    | { kind: 'focused'; post: any; key: string }
    | { kind: 'reply'; post: any; key: string };

  const items: ListItem[] = [
    ...parentPosts.map((p, i) => ({ kind: 'parent' as const, post: p, key: `p${i}` })),
    ...(focusedPost ? [{ kind: 'focused' as const, post: focusedPost, key: 'focused' }] : []),
    ...replyPosts.map((p, i) => ({ kind: 'reply' as const, post: p, key: `r${i}` })),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#14171A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thread</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.key}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        renderItem={({ item }) => {
          if (item.kind === 'focused') {
            return (
              <View style={styles.focusedWrap}>
                <PostCard post={item.post} />
              </View>
            );
          }
          return <PostCard post={item.post} />;
        }}
        ItemSeparatorComponent={({ leadingItem }) =>
          (leadingItem as ListItem).kind === 'parent'
            ? <View style={styles.threadLine} />
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F3F5',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#14171A' },
  focusedWrap: { backgroundColor: '#FAFCFF', borderBottomWidth: 4, borderBottomColor: '#F0F3F5' },
  threadLine: {
    width: 2, backgroundColor: '#E1E8ED',
    marginLeft: 16 + 24, 
    height: 12,
  },
});
