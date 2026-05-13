import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth';
import PostCard from '../../components/PostCard';
import { Plus, Bell, Search, Asterisk, ArrowUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { InteractionManager } from 'react-native';
import {
  COMMUNITY_LABELS,
  ALL_FILTER,
  type FeedFilter,
  getCommunityLabels,
} from '../../constants/labels';

// Removed static FILTERS constant to handle dynamic rearrangement

export default function HomeScreen() {
  const { agent } = useAuth();
  const router = useRouter();
  const [postsCache, setPostsCache] = useState<Record<string, any[]>>({});
  const [cursorsCache, setCursorsCache] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(ALL_FILTER);
  const insets = useSafeAreaInsets();
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [defaultFilter, setDefaultFilter] = useState<FeedFilter>(ALL_FILTER);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const listRef = React.useRef<FlatList>(null);
  const lastFetchedUri = React.useRef<string | null>(null);
  const postsCacheRef = React.useRef<Record<string, any[]>>({});

  const currentPosts = postsCache[activeFilter] || [];
  const currentCursor = cursorsCache[activeFilter];

  // Keep ref in sync
  useEffect(() => {
    postsCacheRef.current = postsCache;
  }, [postsCache]);

  // Derive dynamic filters list based on default selection
  const dynamicFilters = React.useMemo(() => {
    const base = [
      { key: ALL_FILTER, label: 'All' },
      ...COMMUNITY_LABELS.map(l => ({ key: l.val as FeedFilter, label: l.display })),
    ];
    // Put default filter at the first position
    return [...base].sort((a, b) => {
      if (a.key === defaultFilter) return -1;
      if (b.key === defaultFilter) return 1;
      return 0;
    });
  }, [defaultFilter]);

  // Load default filter
  useEffect(() => {
    AsyncStorage.getItem('default_feed').then(val => {
      if (val) {
        setDefaultFilter(val as FeedFilter);
        setActiveFilter(val as FeedFilter);
      }
    });
  }, []);

  const saveDefaultFilter = async (filter: FeedFilter) => {
    try {
      await AsyncStorage.setItem('default_feed', filter);
      setDefaultFilter(filter);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTimeline = useCallback(async (refresh = false) => {
    if (!agent) return;
    const hasCache = (postsCacheRef.current[activeFilter]?.length ?? 0) > 0;
    try {
      if (!refresh && !hasCache) {
        setIsLoading(true);
      }
      
      let posts: any[] = [];
      let nextCursor: string | undefined = undefined;

      if (activeFilter === ALL_FILTER) {
        // Mode 1: Follows-based Timeline
        const response = await agent.getTimeline({ limit: 40 });
        posts = response.data.feed;
        nextCursor = response.data.cursor;
      } else {
        // Mode 2: Universal Global Search for Community Labels
        const response = await agent.app.bsky.feed.searchPosts({ 
          q: activeFilter, 
          limit: 40 
        });
        // Map search result (PostView) to look like timeline result (FeedViewPost)
        posts = response.data.posts.map(post => ({ post }));
        nextCursor = response.data.cursor;
      }

      setPostsCache(prev => ({ ...prev, [activeFilter]: posts }));
      setCursorsCache(prev => ({ ...prev, [activeFilter]: nextCursor }));

      if (posts.length > 0 && activeFilter === ALL_FILTER) {
        lastFetchedUri.current = posts[0].post?.uri;
      }
      setHasNewPosts(false);
    } catch (e) {
      console.error('Failed to fetch feed', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [agent, activeFilter]);

  // Periodic check for new posts
  useEffect(() => {
    if (!agent || activeFilter !== ALL_FILTER) return;

    const interval = setInterval(async () => {
      try {
        const response = await agent.getTimeline({ limit: 1 });
        const newestUri = response.data.feed[0]?.post?.uri;
        if (newestUri && newestUri !== lastFetchedUri.current) {
          setHasNewPosts(true);
        }
      } catch (e) {
        // Silent fail for background check
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [agent, activeFilter]);

  const fetchMore = async () => {
    if (!agent || !currentCursor || isFetchingMore) return;
    try {
      setIsFetchingMore(true);
      let posts: any[] = [];
      let nextCursor: string | undefined = undefined;

      if (activeFilter === ALL_FILTER) {
        const res = await agent.getTimeline({ limit: 40, cursor: currentCursor });
        posts = res.data.feed;
        nextCursor = res.data.cursor;
      } else {
        const res = await agent.app.bsky.feed.searchPosts({ 
          q: activeFilter, 
          limit: 40, 
          cursor: currentCursor 
        });
        posts = res.data.posts.map(post => ({ post }));
        nextCursor = res.data.cursor;
      }

      setPostsCache(prev => ({
        ...prev,
        [activeFilter]: [...(prev[activeFilter] || []), ...posts]
      }));
      setCursorsCache(prev => ({ ...prev, [activeFilter]: nextCursor }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Do not clear posts immediately; show cache while loading
  useEffect(() => {
    fetchTimeline();
  }, [activeFilter, fetchTimeline]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTimeline(true);
  };

  const renderItem = useCallback(({ item }: { item: any }) => (
    <PostCard
      post={item.post}
      hideCommunityLabels={activeFilter !== ALL_FILTER}
    />
  ), [activeFilter]);

  const SkeletonCard = useCallback(() => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonLineShort} />
        <View style={styles.skeletonLineLong} />
        <View style={styles.skeletonLineLong} />
      </View>
    </View>
  ), []);

  const filteredPosts = currentPosts;

  // Removed full-screen loader to keep UI responsive during tab switches
  // Skeletons will show if the cache is empty

  return (
    <View style={styles.container}>
      {/* Compact Top Bar: Brand + Filters + Icons */}
      <View style={[styles.mergedHeader, { paddingTop: insets.top + 8 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.flexShrink}
        >
          {/* Brand Logo in Filter Bar */}
          <View style={styles.brandChip}>
            <Asterisk size={18} color={THEME.white} strokeWidth={3} />
          </View>

          {dynamicFilters.map(f => {
            const isActive = activeFilter === f.key;
            const isDefault = defaultFilter === f.key;
            const labelDef = COMMUNITY_LABELS.find(l => l.val === f.key);
            
            // Design: Minimalist & Dynamic
            const activeColor = labelDef?.color ?? THEME.primary;
            const activeBg   = labelDef?.bg   ?? '#F8FAFC'; // Very light grey for "All"
            
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && {
                    backgroundColor: activeBg,
                    borderWidth: 0, // No border for active
                  },
                  !isActive && {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                  }
                ]}
                onPress={() => setActiveFilter(f.key)}
                onLongPress={() => saveDefaultFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && { color: activeColor, fontWeight: '800' },
                    !isActive && { color: '#8E8E93', fontWeight: '500' }
                  ]}
                >
                  {f.label}
                </Text>
                {isDefault && (
                  <View style={[styles.defaultIndicator, { backgroundColor: activeColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      {/* New Posts Pill */}
      {hasNewPosts && (
        <TouchableOpacity
          style={[styles.newPostsPill, { top: insets.top + 60 }]}
          onPress={() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
            InteractionManager.runAfterInteractions(() => {
              onRefresh();
            });
          }}
          activeOpacity={0.9}
        >
          <ArrowUp size={14} color="white" />
          <Text style={styles.newPostsText}>New posts</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={filteredPosts}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        keyExtractor={(item, index) => `${item.post?.uri ?? index}-${index}`}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
        }
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ padding: 20 }} /> : null}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 56 + 80,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ flex: 1 }}>
              {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === ALL_FILTER
                  ? 'Your timeline is empty.'
                  : `No posts labelled "${dynamicFilters.find(f => f.key === activeFilter)?.label}" yet.`}
              </Text>
            </View>
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 16, backgroundColor: THEME.primary, shadowColor: THEME.primary }]}
        onPress={() => router.push({
          pathname: '/write',
          params: { initialCommunity: activeFilter !== ALL_FILTER ? activeFilter : undefined }
        })}
        activeOpacity={0.85}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },

  // Header
  mergedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
    backgroundColor: 'white',
  },
  flexShrink: { flex: 1 },
  brandChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#14171A' },
  compactBrand: { fontSize: 18, fontWeight: '900', color: THEME.primary, marginLeft: 6 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  iconButton: { padding: 4 },

  // Filter bar
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
    backgroundColor: 'white',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  filterChipText: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  defaultIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 2,
    opacity: 0.8,
  },
  filterCount: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#14171A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#657786',
    textAlign: 'center',
    lineHeight: 20,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0085FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0085FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  newPostsPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    gap: 6,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  newPostsText: { color: 'white', fontWeight: '700', fontSize: 13 },
  // Skeleton Styles
  skeletonContainer: {
    padding: 16,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  skeletonLineShort: {
    width: '40%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  skeletonLineLong: {
    width: '100%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
});
