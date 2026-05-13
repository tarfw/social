import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Repeat2, MessageCircle, UserPlus, AtSign } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { THEME } from '../../constants/theme';

type NotifReason = 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote';

type Notif = {
  uri: string;
  author: { did: string; handle: string; displayName?: string; avatar?: string };
  reason: NotifReason;
  reasonSubject?: string;
  record: any;
  isRead: boolean;
  indexedAt: string;
};

const REASON_META: Record<NotifReason, { icon: (c: string) => JSX.Element; color: string; label: string }> = {
  like:    { icon: c => <Heart         size={18} color={c} fill={c} />, color: '#E0245E', label: 'liked your post'     },
  repost:  { icon: c => <Repeat2       size={18} color={c} />,          color: '#17BF63', label: 'reposted your post'  },
  follow:  { icon: c => <UserPlus      size={18} color={c} />,          color: '#0085FF', label: 'followed you'        },
  mention: { icon: c => <AtSign        size={18} color={c} />,          color: '#794BC4', label: 'mentioned you'       },
  reply:   { icon: c => <MessageCircle size={18} color={c} />,          color: '#1DA1F2', label: 'replied to your post'},
  quote:   { icon: c => <MessageCircle size={18} color={c} />,          color: '#F45D22', label: 'quoted your post'    },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { agent } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const handleNotifPress = (item: Notif) => {
    if (item.reason === 'follow') {
      router.push({ pathname: '/profile_detail', params: { did: item.author.did } });
    } else {
      const threadUri = item.reasonSubject || item.uri;
      if (threadUri) {
        router.push({ pathname: '/view_thread', params: { uri: threadUri } });
      }
    }
  };

  const fetchNotifs = useCallback(async (refresh = false) => {
    if (!agent) return;
    try {
      if (!refresh) setIsLoading(true);
      const r = await agent.listNotifications({ limit: 40 });
      setNotifs(r.data.notifications as Notif[]);
      setCursor(r.data.cursor);
      await agent.updateSeenNotifications();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [agent]);

  const fetchMore = async () => {
    if (!agent || !cursor || isFetchingMore) return;
    try {
      setIsFetchingMore(true);
      const res = await agent.listNotifications({ limit: 40, cursor });
      setNotifs(prev => [...prev, ...(res.data.notifications as Notif[])]);
      setCursor(res.data.cursor);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0085FF" />
      </View>
    );
  }

  const renderNotif = ({ item }: { item: Notif }) => {
    const meta = REASON_META[item.reason] ?? REASON_META.mention;
    const date = new Date(item.indexedAt);
    const text: string = item.record?.text ?? '';
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.isRead && styles.unread]}
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
          {meta.icon(meta.color)}
        </View>
        <View style={styles.notifBody}>
          <View style={styles.notifTop}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/profile_detail', params: { did: item.author.did } })}>
              <Image source={{ uri: item.author.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
            </TouchableOpacity>
            <View style={styles.notifText}>
              <Text style={styles.notifAuthor} numberOfLines={1}>
                <Text style={styles.bold}>{item.author.displayName || item.author.handle}</Text>
                {' '}<Text style={styles.dim}>{meta.label}</Text>
              </Text>
              <Text style={styles.notifTime}>{formatDistanceToNow(date, { addSuffix: true })}</Text>
            </View>
          </View>
          {text ? <Text style={styles.notifPreview} numberOfLines={2}>{text}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <FlatList
        data={notifs}
        keyExtractor={i => i.uri}
        renderItem={renderNotif}
        onRefresh={() => { setIsRefreshing(true); fetchNotifs(true); }}
        refreshing={isRefreshing}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ padding: 20 }} /> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          <View style={styles.center}><Text style={styles.emptyText}>No notifications yet</Text></View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F3F5' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#14171A' },
  notifRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F3F5', gap: 12,
  },
  unread: { backgroundColor: '#F0F7FF' },
  iconWrap: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F3F5', flexShrink: 0 },
  notifText: { flex: 1 },
  notifAuthor: { fontSize: 14, color: '#14171A', lineHeight: 19 },
  bold: { fontWeight: '700' },
  dim: { color: '#536471' },
  notifTime: { fontSize: 12, color: '#657786', marginTop: 1 },
  notifPreview: { fontSize: 14, color: '#536471', marginTop: 6, lineHeight: 19, paddingLeft: 48 },
  emptyText: { fontSize: 15, color: '#657786' },
});
