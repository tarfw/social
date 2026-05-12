/**
 * useProfileCache
 *
 * Stale-While-Revalidate cache for Bluesky profile + posts.
 *
 * Strategy:
 *  1. On mount → load from AsyncStorage instantly (no skeleton if cache hit)
 *  2. Fetch fresh data in background silently
 *  3. On fresh data → update state + write to AsyncStorage
 *  4. TTL: 3 minutes — stale cache served but re-fetched after TTL
 *
 * Cache keys:
 *  profile_cache_v1_{did}        → { profile, ts }
 *  posts_cache_v1_{did}_{tab}    → { feed, cursor, ts }
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = 'v1';
const PROFILE_TTL_MS = 3 * 60 * 1000;   // 3 minutes
const POSTS_TTL_MS   = 2 * 60 * 1000;   // 2 minutes

type TabKey = 'posts' | 'replies' | 'media' | 'likes';

function profileKey(did: string)            { return `profile_cache_${CACHE_VERSION}_${did}`; }
function postsKey(did: string, tab: TabKey) { return `posts_cache_${CACHE_VERSION}_${did}_${tab}`; }

// ─── Read / Write helpers ─────────────────────────────────────────────────────

async function readCache<T>(key: string): Promise<{ data: T; ts: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { data: T; ts: number };
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function isStale(ts: number, ttl: number): boolean {
  return Date.now() - ts > ttl;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchFeedForTab(agent: any, did: string, tab: TabKey) {
  let feed: any[] = [];
  let cursor: string | undefined;

  if (tab === 'posts') {
    const res = await agent.getAuthorFeed({ actor: did, limit: 30, filter: 'posts_no_replies' });
    feed   = res.data.feed;
    cursor = res.data.cursor;
  } else if (tab === 'replies') {
    const res = await agent.getAuthorFeed({ actor: did, limit: 30, filter: 'posts_with_replies' });
    feed   = res.data.feed.filter((i: any) => !!i.reply);
    cursor = res.data.cursor;
  } else if (tab === 'media') {
    const res = await agent.getAuthorFeed({ actor: did, limit: 40, filter: 'posts_with_media' });
    feed = res.data.feed.filter((i: any) =>
      i.post?.embed?.$type?.includes('images') ||
      i.post?.embed?.$type?.includes('video') ||
      i.post?.embed?.images?.length > 0
    );
    cursor = res.data.cursor;
  } else if (tab === 'likes') {
    const res = await agent.listLikes?.({ actor: did, limit: 30 });
    if (res?.data?.feed) {
      feed   = res.data.feed;
      cursor = res.data.cursor;
    }
  }

  return { feed, cursor };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfileCache(agent: any, did: string) {
  const [profile, setProfile]     = useState<any>(null);
  const [posts, setPosts]         = useState<any[]>([]);
  const [cursor, setCursor]       = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabKey>('posts');

  // Three loading states:
  //  'skeleton' = first time ever, show skeleton
  //  'background' = cache loaded, silently refreshing
  //  'idle' = fully ready
  const [loadState, setLoadState] = useState<'skeleton' | 'background' | 'idle'>('skeleton');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // ── Load profile ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async (forceRefresh = false) => {
    if (!agent || !did) return;
    const key = profileKey(did);

    // 1. Try cache first
    if (!forceRefresh) {
      const cached = await readCache<any>(key);
      if (cached && isMounted.current) {
        setProfile(cached.data);
        // If stale, we'll still background-refresh; if fresh, skip network call
        if (!isStale(cached.ts, PROFILE_TTL_MS)) return;
      }
    }

    // 2. Fetch fresh (background if we already have data)
    try {
      const res = await agent.getProfile({ actor: did });
      if (isMounted.current) {
        setProfile(res.data);
        await writeCache(key, res.data);
      }
    } catch (e) {
      console.error('[ProfileCache] profile fetch error', e);
    }
  }, [agent, did]);

  // ── Load tab posts ────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async (tab: TabKey, forceRefresh = false) => {
    if (!agent || !did) return;
    const key = postsKey(did, tab);

    // 1. Try cache
    let hadCache = false;
    if (!forceRefresh) {
      const cached = await readCache<{ feed: any[]; cursor: string | undefined }>(key);
      if (cached && isMounted.current) {
        setPosts(cached.data.feed);
        setCursor(cached.data.cursor);
        hadCache = true;

        if (!isStale(cached.ts, POSTS_TTL_MS)) {
          // Fresh enough — show immediately, skip network
          setLoadState('idle');
          return;
        }
        // Stale cache → show it but background-refresh
        setLoadState('background');
      }
    }

    // 2. Network fetch
    try {
      const { feed, cursor: nextCursor } = await fetchFeedForTab(agent, did, tab);
      if (isMounted.current) {
        setPosts(feed);
        setCursor(nextCursor);
        await writeCache(key, { feed, cursor: nextCursor });
      }
    } catch (e) {
      console.error('[ProfileCache] posts fetch error', e);
    } finally {
      if (isMounted.current) {
        setLoadState('idle');
        setIsRefreshing(false);
      }
    }
  }, [agent, did]);

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!did) return;

    let cancelled = false;

    const init = async () => {
      // Check if we have ANY cached data for the skeleton decision
      const [profCached, postsCached] = await Promise.all([
        readCache<any>(profileKey(did)),
        readCache<any>(postsKey(did, 'posts')),
      ]);

      if (cancelled) return;

      if (profCached && postsCached) {
        // Show cached data immediately, no skeleton
        setProfile(profCached.data);
        setPosts(postsCached.data.feed);
        setCursor(postsCached.data.cursor);
        setLoadState(
          isStale(profCached.ts, PROFILE_TTL_MS) ||
          isStale(postsCached.ts, POSTS_TTL_MS)
            ? 'background'
            : 'idle'
        );
      } else {
        // True first load — show skeleton
        setLoadState('skeleton');
      }

      // Always refresh (background if cache hit, blocking if first load)
      await Promise.all([loadProfile(), loadPosts('posts')]);
    };

    init();
    return () => { cancelled = true; };
  }, [did]);

  // ── Tab switch ───────────────────────────────────────────────────────────────

  const switchTab = useCallback(async (tab: TabKey) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPosts([]);
    setCursor(undefined);
    setLoadState('skeleton');
    await loadPosts(tab);
  }, [activeTab, loadPosts]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadProfile(true), loadPosts(activeTab, true)]);
    setIsRefreshing(false);
  }, [activeTab, loadProfile, loadPosts]);

  // ── Load more (pagination) ───────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!agent || !did || !cursor || isFetchingMore) return;
    try {
      setIsFetchingMore(true);
      const res = await agent.getAuthorFeed({ actor: did, limit: 30, cursor });
      if (isMounted.current) {
        setPosts(prev => [...prev, ...res.data.feed]);
        setCursor(res.data.cursor);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted.current) setIsFetchingMore(false);
    }
  }, [agent, did, cursor, isFetchingMore]);

  return {
    profile,
    setProfile,   // for optimistic updates (follow/unfollow)
    posts,
    cursor,
    activeTab,
    switchTab,
    loadState,    // 'skeleton' | 'background' | 'idle'
    isRefreshing,
    isFetchingMore,
    refresh,
    loadMore,
  };
}
