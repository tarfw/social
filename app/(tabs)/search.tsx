import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon, X, UserPlus, UserCheck } from 'lucide-react-native';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router';

type Actor = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  viewer?: { following?: string; followedBy?: string };
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { agent } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Actor[]>([]);
  const [suggestions, setSuggestions] = useState<Actor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, string>>({});

  // Load suggested follows on mount
  useEffect(() => {
    if (!agent) return;
    agent.getSuggestions({ limit: 20 })
      .then(r => setSuggestions(r.data.actors as Actor[]))
      .catch(() => {});
  }, [agent]);

  const doSearch = useCallback(async (q: string) => {
    if (!agent || !q.trim()) { setResults([]); return; }
    try {
      setIsSearching(true);
      const r = await agent.searchActors({ q: q.trim(), limit: 25 });
      setResults(r.data.actors as Actor[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, [agent]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const toggleFollow = async (actor: Actor) => {
    if (!agent) return;
    try {
      if (actor.viewer?.following) {
        await agent.deleteFollow(actor.viewer.following);
        setResults(p => p.map(a => a.did === actor.did
          ? { ...a, viewer: { ...a.viewer, following: undefined } } : a));
        setSuggestions(p => p.map(a => a.did === actor.did
          ? { ...a, viewer: { ...a.viewer, following: undefined } } : a));
      } else {
        const res = await agent.follow(actor.did);
        setResults(p => p.map(a => a.did === actor.did
          ? { ...a, viewer: { ...a.viewer, following: res.uri } } : a));
        setSuggestions(p => p.map(a => a.did === actor.did
          ? { ...a, viewer: { ...a.viewer, following: res.uri } } : a));
      }
    } catch (e) { console.error(e); }
  };

  const displayList = query.trim() ? results : suggestions;
  const sectionTitle = query.trim() ? `Results for "${query}"` : 'Suggested accounts';

  const renderActor = ({ item }: { item: Actor }) => {
    const isFollowing = !!item.viewer?.following;
    return (
      <TouchableOpacity style={styles.actorRow} activeOpacity={0.7}>
        <Image source={{ uri: item.avatar }} style={styles.actorAvatar} contentFit="cover" transition={200} />
        <View style={styles.actorInfo}>
          <Text style={styles.actorName} numberOfLines={1}>{item.displayName || item.handle}</Text>
          <Text style={styles.actorHandle} numberOfLines={1}>@{item.handle}</Text>
          {item.description ? (
            <Text style={styles.actorBio} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => toggleFollow(item)}
          activeOpacity={0.8}
        >
          {isFollowing
            ? <UserCheck size={15} color="#0085FF" />
            : <UserPlus size={15} color="white" />}
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon size={18} color="#657786" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people…"
          placeholderTextColor="#AAB8C2"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); Keyboard.dismiss(); }}>
            <X size={17} color="#657786" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {isSearching ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0085FF" />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={i => i.did}
          renderItem={renderActor}
          ListHeaderComponent={
            displayList.length > 0 ? (
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            ) : null
          }
          ListEmptyComponent={
            query.trim() && !isSearching ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No accounts found</Text>
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F0F3F5',
    borderRadius: 24,
    gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 15, color: '#14171A' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#657786',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
    gap: 12,
  },
  actorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F3F5',
  },
  actorInfo: { flex: 1 },
  actorName: { fontSize: 15, fontWeight: '700', color: '#14171A' },
  actorHandle: { fontSize: 13, color: '#657786', marginTop: 1 },
  actorBio: { fontSize: 13, color: '#536471', marginTop: 3, lineHeight: 17 },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0085FF',
  },
  followingBtn: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#0085FF',
  },
  followBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },
  followingBtnText: { color: '#0085FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#657786' },
});
