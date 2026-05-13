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
import PostCard from '../../components/PostCard';
import { THEME } from '../../constants/theme';

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
  const [postResults, setPostResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Actor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'people' | 'posts'>('people');

  // Load suggested follows on mount
  useEffect(() => {
    if (!agent) return;
    agent.getSuggestions({ limit: 20 })
      .then(r => setSuggestions(r.data.actors as Actor[]))
      .catch(() => {});
  }, [agent]);

  const doSearch = useCallback(async (q: string) => {
    if (!agent || !q.trim()) { 
      setResults([]); 
      setPostResults([]);
      return; 
    }
    try {
      setIsSearching(true);
      if (searchMode === 'people') {
        const r = await agent.searchActors({ q: q.trim(), limit: 25 });
        setResults(r.data.actors as Actor[]);
      } else {
        const r = await agent.app.bsky.feed.searchPosts({ q: q.trim(), limit: 25 });
        setPostResults(r.data.posts.map(post => ({ post })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, [agent, searchMode]);

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

  const displayList = searchMode === 'people' 
    ? (query.trim() ? results : suggestions)
    : postResults;
  const sectionTitle = query.trim() 
    ? `Results for "${query}"` 
    : (searchMode === 'people' ? 'Suggested accounts' : '');

  const renderActor = ({ item }: { item: Actor }) => {
    const isFollowing = !!item.viewer?.following;
    return (
      <TouchableOpacity 
        style={styles.actorRow} 
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/profile_detail', params: { did: item.did } })}
      >
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
      <View style={styles.header}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <SearchIcon size={18} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder={searchMode === 'people' ? "Search people" : "Search posts"}
            placeholderTextColor="#AAB8C2"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setPostResults([]); Keyboard.dismiss(); }}>
              <X size={18} color="#657786" />
            </TouchableOpacity>
          )}
        </View>

        {/* Mode toggle - Twitter Android style tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabItem, searchMode === 'people' && styles.tabItemActive]}
            onPress={() => setSearchMode('people')}
          >
            <Text style={[styles.tabText, searchMode === 'people' && styles.tabTextActive]}>People</Text>
            {searchMode === 'people' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabItem, searchMode === 'posts' && styles.tabItemActive]}
            onPress={() => setSearchMode('posts')}
          >
            <Text style={[styles.tabText, searchMode === 'posts' && styles.tabTextActive]}>Posts</Text>
            {searchMode === 'posts' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {isSearching ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0085FF" />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(i, idx) => (i.did || i.post?.uri || idx.toString())}
          renderItem={({ item }) => (
            searchMode === 'people' 
              ? renderActor({ item: item as Actor }) 
              : <PostCard post={item.post} />
          )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#657786' },
  header: {
    backgroundColor: 'white',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F1F3F4',
    borderRadius: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#14171A' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabItemActive: {
    // No background for active tab in Twitter style
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#657786',
  },
  tabTextActive: {
    color: '#14171A',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 4,
    backgroundColor: THEME.primary,
    borderRadius: 2,
  },
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
});
