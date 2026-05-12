import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, UserPlus, UserCheck } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import { THEME } from '../constants/theme';

type Person = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  viewer?: { following?: string };
};

type TabKey = 'following' | 'followers';

function PersonRow({ person, isSelf, onToggleFollow }: {
  person: Person;
  isSelf: boolean;
  onToggleFollow: (person: Person) => void;
}) {
  const router = useRouter();
  const isFollowing = !!person.viewer?.following;

  return (
    <TouchableOpacity
      style={pStyles.row}
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/profile_detail', params: { did: person.did } })}
    >
      <Image
        source={{ uri: person.avatar }}
        style={pStyles.avatar}
        contentFit="cover"
      />
      <View style={pStyles.info}>
        <Text style={pStyles.displayName} numberOfLines={1}>
          {person.displayName || person.handle}
        </Text>
        <Text style={pStyles.handle} numberOfLines={1}>@{person.handle}</Text>
        {person.description ? (
          <Text style={pStyles.bio} numberOfLines={2}>{person.description}</Text>
        ) : null}
      </View>
      {!isSelf && (
        <TouchableOpacity
          style={[pStyles.followBtn, isFollowing && pStyles.followingBtn]}
          onPress={() => onToggleFollow(person)}
          activeOpacity={0.8}
        >
          {isFollowing
            ? <UserCheck size={15} color={THEME.primary} />
            : <UserPlus size={15} color="#fff" />}
          <Text style={[pStyles.followBtnText, isFollowing && pStyles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const pStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F3F5',
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E1E8ED' },
  info: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700', color: '#14171A' },
  handle: { fontSize: 13, color: '#657786', marginTop: 2 },
  bio: { fontSize: 13, color: '#657786', marginTop: 4, lineHeight: 18 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: THEME.primary,
  },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: THEME.primary },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: THEME.primary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FollowingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agent } = useAuth();
  const { did, tab: initialTab } = useLocalSearchParams<{ did: string; tab: TabKey }>();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'following');
  const [people, setPeople]       = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor]       = useState<string | undefined>(undefined);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const myDid = agent?.session?.did ?? '';

  const fetchPeople = useCallback(async (tab: TabKey, refresh = false) => {
    if (!agent || !did) return;
    try {
      if (!refresh) setIsLoading(true);
      let list: Person[] = [];
      let nextCursor: string | undefined;

      if (tab === 'following') {
        const res = await agent.getFollows({ actor: did, limit: 50 });
        list = res.data.follows as Person[];
        nextCursor = res.data.cursor;
      } else {
        const res = await agent.getFollowers({ actor: did, limit: 50 });
        list = res.data.followers as Person[];
        nextCursor = res.data.cursor;
      }

      setPeople(list);
      setCursor(nextCursor);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [agent, did]);

  const fetchMore = async () => {
    if (!agent || !did || !cursor || isFetchingMore) return;
    try {
      setIsFetchingMore(true);
      let list: Person[] = [];
      let nextCursor: string | undefined;

      if (activeTab === 'following') {
        const res = await agent.getFollows({ actor: did, limit: 50, cursor });
        list = res.data.follows as Person[];
        nextCursor = res.data.cursor;
      } else {
        const res = await agent.getFollowers({ actor: did, limit: 50, cursor });
        list = res.data.followers as Person[];
        nextCursor = res.data.cursor;
      }

      setPeople(prev => [...prev, ...list]);
      setCursor(nextCursor);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => { fetchPeople(activeTab); }, []);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPeople([]);
    setCursor(undefined);
    fetchPeople(tab);
  };

  const toggleFollow = async (person: Person) => {
    if (!agent) return;
    try {
      if (person.viewer?.following) {
        await agent.deleteFollow(person.viewer.following);
        setPeople(prev => prev.map(p =>
          p.did === person.did ? { ...p, viewer: { ...p.viewer, following: undefined } } : p
        ));
      } else {
        const res = await agent.follow(person.did);
        setPeople(prev => prev.map(p =>
          p.did === person.did ? { ...p, viewer: { ...p.viewer, following: res.uri } } : p
        ));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#14171A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTab === 'following' ? 'Following' : 'Followers'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['following', 'followers'] as TabKey[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item, i) => `${item.did}-${i}`}
          renderItem={({ item }) => (
            <PersonRow
              person={item}
              isSelf={item.did === myDid}
              onToggleFollow={toggleFollow}
            />
          )}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ padding: 16 }} color={THEME.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {activeTab === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F3F5',
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#14171A' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F3F5' },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: THEME.primary },
  tabText:   { fontSize: 14, fontWeight: '500', color: '#657786' },
  tabTextActive: { fontWeight: '700', color: THEME.primary },

  emptyText: { fontSize: 15, color: '#657786' },
});
