import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, LogOut, UserPlus, UserCheck, Calendar } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import PostCard from '../components/PostCard';
import { THEME } from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  createdAt?: string;
  viewer?: {
    following?: string;
    followedBy?: string;
  };
};

type TabKey = 'posts' | 'replies' | 'media' | 'likes';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts',   label: 'Posts'   },
  { key: 'replies', label: 'Replies' },
  { key: 'media',   label: 'Media'   },
  { key: 'likes',   label: 'Likes'   },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ w, h, r = 8, style }: { w?: number | string; h: number; r?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: '#E1E8ED', opacity: anim }, style]}
    />
  );
}

function ProfileSkeleton({ insets }: { insets: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SkeletonBox h={130} r={0} style={{ width: '100%' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -38 }}>
        <SkeletonBox w={76} h={76} r={38} />
        <SkeletonBox w={100} h={36} r={20} />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
        <SkeletonBox w={140} h={22} />
        <SkeletonBox w={100} h={16} />
        <SkeletonBox w={'85%'} h={14} />
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
          <SkeletonBox w={80} h={16} />
          <SkeletonBox w={80} h={16} />
          <SkeletonBox w={60} h={16} />
        </View>
      </View>
    </View>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
  return (
    <TouchableOpacity style={styles.statPill} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.statValue}>{display}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

import { useProfileCache } from '../hooks/useProfileCache';

export default function ProfileDetailScreen() {
  const { did } = useLocalSearchParams<{ did: string }>();
  const insets  = useSafeAreaInsets();
  const { agent, logout } = useAuth();
  const router  = useRouter();

  const isMe      = did === agent?.session?.did || !did;
  const targetDid = did || agent?.session?.did;

  const {
    profile,
    setProfile,
    posts,
    cursor,
    activeTab,
    switchTab,
    loadState,
    isRefreshing,
    isFetchingMore,
    refresh,
    loadMore,
  } = useProfileCache(agent, targetDid as string);

  const handleTabChange = (tab: TabKey) => {
    switchTab(tab);
  };

  const toggleFollow = async () => {
    if (!agent || !profile) return;
    try {
      if (profile.viewer?.following) {
        await agent.deleteFollow(profile.viewer.following);
        setProfile(p => p ? { ...p, viewer: { ...p.viewer, following: undefined }, followersCount: p.followersCount - 1 } : null);
      } else {
        const res = await agent.follow(profile.did);
        setProfile(p => p ? { ...p, viewer: { ...p.viewer, following: res.uri }, followersCount: p.followersCount + 1 } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Profile Header ──────────────────────────────────────────────────────────
  const ProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.bannerWrap}>
        {profile?.banner
          ? <Image source={{ uri: profile.banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />}

        <View style={[styles.headerActions, { top: insets.top + 10 }]}>
          {!isMe && (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {isMe && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleLogout}>
              <LogOut size={18} color="#14171A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.avatarRow}>
        <Image source={{ uri: profile?.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
        {isMe ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit_profile')} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.followBtn, profile?.viewer?.following && styles.followingBtn]}
            onPress={toggleFollow}
            activeOpacity={0.8}
          >
            {profile?.viewer?.following
              ? <UserCheck size={17} color={THEME.primary} />
              : <UserPlus size={17} color="#fff" />}
            <Text style={[styles.followBtnText, profile?.viewer?.following && styles.followingBtnText]}>
              {profile?.viewer?.following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.nameBlock}>
        <Text style={styles.displayName}>{profile?.displayName || profile?.handle}</Text>
        <Text style={styles.handle}>@{profile?.handle}</Text>
        {profile?.description
          ? <Text style={styles.bio}>{profile.description}</Text>
          : <Text style={styles.bioEmpty}>No bio yet.</Text>}

        {joinedDate && (
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={13} color="#657786" />
              <Text style={styles.metaText}>Joined {joinedDate}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatPill
          value={profile?.followsCount ?? 0}
          label="Following"
          onPress={() => router.push({ pathname: '/following', params: { did: targetDid, tab: 'following' } })}
        />
        <StatPill
          value={profile?.followersCount ?? 0}
          label="Followers"
          onPress={() => router.push({ pathname: '/following', params: { did: targetDid, tab: 'followers' } })}
        />
        <StatPill value={profile?.postsCount ?? 0} label="Posts" />
      </View>

      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (loadState === 'skeleton') {
    return <ProfileSkeleton insets={insets} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item, i) => `${item.post?.uri ?? item.uri ?? i}-${i}`}
        renderItem={({ item }) => {
          const post = item.post ?? item;
          return <PostCard post={post} />;
        }}
        ListHeaderComponent={ProfileHeader}
        onRefresh={() => { refresh(); }}
        refreshing={isRefreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ padding: 20 }} color={THEME.primary} /> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          loadState !== 'skeleton' ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {activeTab === 'posts'   ? 'No posts yet'
                : activeTab === 'replies'? 'No replies yet'
                : activeTab === 'media'  ? 'No media yet'
                : 'No likes yet'}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BANNER_H    = 130;
const AVATAR_SIZE = 76;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  bannerWrap:     { height: BANNER_H, backgroundColor: '#CFD9DE', overflow: 'hidden' },
  bannerFallback: { backgroundColor: THEME.primary },
  headerActions: {
    position: 'absolute', right: 14, left: 14,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  actionBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 'auto',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center', alignItems: 'center',
  },

  profileHeader: { backgroundColor: '#fff' },
  avatarRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2),
  },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3, borderColor: '#fff', backgroundColor: '#CFD9DE',
  },
  editBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#CFD9DE',
  },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#14171A' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, backgroundColor: THEME.primary,
  },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: THEME.primary },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: THEME.primary },

  nameBlock:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  displayName: { fontSize: 20, fontWeight: '800', color: '#14171A' },
  handle:      { fontSize: 14, color: '#657786', marginTop: 2 },
  bio:         { fontSize: 15, color: '#14171A', marginTop: 8, lineHeight: 21 },
  bioEmpty:    { fontSize: 14, color: '#AAB8C2', marginTop: 8, fontStyle: 'italic' },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, marginBottom: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#657786' },

  statsRow:  { flexDirection: 'row', paddingHorizontal: 16, gap: 20, paddingBottom: 16, paddingTop: 4 },
  statPill:  { flexDirection: 'row', gap: 4, alignItems: 'baseline' },
  statValue: { fontSize: 15, fontWeight: '800', color: '#14171A' },
  statLabel: { fontSize: 14, color: '#657786' },

  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F3F5' },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: THEME.primary },
  tabText:       { fontSize: 14, fontWeight: '500', color: '#657786' },
  tabTextActive: { fontWeight: '700', color: THEME.primary },

  emptyWrap:  { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#14171A' },
});
