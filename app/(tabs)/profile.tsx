import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert,
  Animated, Share, Linking, Modal, ScrollView, Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LogOut, Settings, MapPin, Link as LinkIcon,
  Calendar, Share2, X, Shield, VolumeX, User,
} from 'lucide-react-native';
import { useAuth } from '../../context/auth';
import PostCard from '../../components/PostCard';
import { THEME } from '../../constants/theme';
import { useRouter } from 'expo-router';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  associated?: { createdAt?: string };
  labels?: any[];
  createdAt?: string;
};

type TabKey = 'posts' | 'replies' | 'media' | 'likes';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts',   label: 'Posts'   },
  { key: 'replies', label: 'Replies' },
  { key: 'media',   label: 'Media'   },
  { key: 'likes',   label: 'Likes'   },
];

// ─── Skeleton ────────────────────────────────────────────────────────────────

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
      style={[
        { width: w as any, height: h, borderRadius: r, backgroundColor: '#E1E8ED', opacity: anim },
        style,
      ]}
    />
  );
}

function ProfileSkeleton({ insets }: { insets: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Banner */}
      <SkeletonBox h={130} r={0} style={{ width: '100%' }} />
      {/* Avatar row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -38 }}>
        <SkeletonBox w={76} h={76} r={38} />
        <SkeletonBox w={110} h={36} r={20} />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
        <SkeletonBox w={140} h={22} />
        <SkeletonBox w={100} h={16} />
        <SkeletonBox w={'90%'} h={14} />
        <SkeletonBox w={'70%'} h={14} />
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
          <SkeletonBox w={80} h={16} />
          <SkeletonBox w={80} h={16} />
          <SkeletonBox w={60} h={16} />
        </View>
      </View>
      {/* Tab bar */}
      <View style={{ flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: '#F0F3F5', paddingVertical: 14 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBox w={50} h={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Stat Pill (tappable) ─────────────────────────────────────────────────────

function StatPill({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
  return (
    <TouchableOpacity style={styles.statPill} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.statValue}>{display}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({
  visible, onClose, handle, onLogout,
}: {
  visible: boolean;
  onClose: () => void;
  handle: string;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const shareProfile = async () => {
    const url = `https://bsky.app/profile/${handle}`;
    try {
      await Share.share({ message: url, url });
    } catch {}
  };

  const copyLink = () => {
    const url = `https://bsky.app/profile/${handle}`;
    Clipboard.setString(url);
  };

  const items = [
    {
      icon: <User size={20} color={THEME.primary} />,
      label: 'Edit profile',
      onPress: () => router.push('/edit_profile'),
    },
    {
      icon: <Share2 size={20} color={THEME.primary} />,
      label: 'Share profile',
      onPress: shareProfile,
    },
    {
      icon: <LinkIcon size={20} color={THEME.primary} />,
      label: 'Copy profile link',
      onPress: copyLink,
    },
    {
      icon: <Shield size={20} color="#6B7280" />,
      label: 'Blocked accounts',
      onPress: () => {},
    },
    {
      icon: <VolumeX size={20} color="#6B7280" />,
      label: 'Muted accounts',
      onPress: () => {},
    },
    {
      icon: <LogOut size={20} color="#DC2626" />,
      label: 'Sign out',
      labelStyle: { color: '#DC2626' },
      onPress: onLogout,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sModal.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[sModal.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {/* Handle bar */}
          <View style={sModal.handleBar} />
          <Text style={sModal.title}>Settings</Text>

          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={sModal.row}
              onPress={() => { onClose(); setTimeout(item.onPress, 200); }}
              activeOpacity={0.7}
            >
              {item.icon}
              <Text style={[sModal.rowLabel, item.labelStyle]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const sModal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24,
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#F1F5F9', alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 18,
  },
  rowLabel: { fontSize: 16, color: '#111827', fontWeight: '600' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

import { useProfileCache } from '../../hooks/useProfileCache';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { agent, logout } = useAuth();
  const router = useRouter();
  const [settingsVisible, setSettingsVisible] = useState(false);

  const myDid = agent?.session?.did ?? '';

  const {
    profile,
    posts,
    cursor,
    activeTab,
    switchTab,
    loadState,
    isRefreshing,
    isFetchingMore,
    refresh,
    loadMore,
  } = useProfileCache(agent, myDid);

  const handleTabChange = (tab: TabKey) => {
    switchTab(tab);
  };

  const handleLogout = () => {
    logout();
  };

  const handleRefresh = () => {
    refresh();
  };

  // ── Format joined date ──────────────────────────────────────────────────────
  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Profile Header ──────────────────────────────────────────────────────────
  const ProfileHeader = () => (
    <View style={styles.profileHeader}>
      {/* Banner */}
      <View style={styles.bannerWrap}>
        {profile?.banner
          ? <Image source={{ uri: profile.banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />}

        {/* Actions top-right */}
        <View style={[styles.headerActions, { top: insets.top + 10 }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setSettingsVisible(true)}>
            <Settings size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Avatar row */}
      <View style={styles.avatarRow}>
        <Image
          source={{ uri: profile?.avatar }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* Name + handle */}
      <View style={styles.nameBlock}>
        <Text style={styles.displayName}>{profile?.displayName || profile?.handle}</Text>
        <Text style={styles.handle}>@{profile?.handle}</Text>

        {profile?.description ? (
          <Text style={styles.bio}>{profile.description}</Text>
        ) : (
          <Text style={styles.bioEmpty}>No bio yet.</Text>
        )}

        {/* Meta row: location, website, joined */}
        <View style={styles.metaRow}>
          {joinedDate && (
            <View style={styles.metaItem}>
              <Calendar size={13} color="#657786" />
              <Text style={styles.metaText}>Joined {joinedDate}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatPill
          value={profile?.followsCount ?? 0}
          label="Following"
          onPress={() => router.push({ pathname: '/following', params: { did: myDid, tab: 'following' } })}
        />
        <StatPill
          value={profile?.followersCount ?? 0}
          label="Followers"
          onPress={() => router.push({ pathname: '/following', params: { did: myDid, tab: 'followers' } })}
        />
        <StatPill value={profile?.postsCount ?? 0} label="Posts" />
      </View>

      {/* Tab bar */}
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
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Skeleton loading ────────────────────────────────────────────────────────
  if (loadState === 'skeleton') {
    return <ProfileSkeleton insets={insets} />;
  }

  return (
    <View style={styles.container}>
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        handle={profile?.handle ?? ''}
        onLogout={handleLogout}
      />

      <FlatList
        data={posts}
        keyExtractor={(item, i) => `${item.post?.uri ?? item.uri ?? i}-${i}`}
        renderItem={({ item }) => {
          const post = item.post ?? item;
          return <PostCard post={post} />;
        }}
        ListHeaderComponent={ProfileHeader}
        onRefresh={handleRefresh}
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
              <Text style={styles.emptySub}>
                {activeTab === 'media' ? 'Posts with photos or videos will appear here.' : ''}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BANNER_H   = 160;
const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Banner
  bannerWrap:     { height: BANNER_H, backgroundColor: '#CFD9DE', overflow: 'hidden' },
  bannerFallback: { backgroundColor: THEME.primary },
  headerActions: {
    position: 'absolute', right: 14,
    flexDirection: 'row', gap: 8,
  },
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)', // More subtle on banner
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  // Profile header container
  profileHeader: { backgroundColor: '#fff' },

  // Avatar row
  avatarRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2) - 4, // Added a bit more space
  },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4, borderColor: '#fff', backgroundColor: '#F8FAFC',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },

  // Name block
  nameBlock:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  displayName: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  handle:      { fontSize: 15, color: '#64748B', marginTop: 1 },
  bio:         { fontSize: 15, color: '#334155', marginTop: 12, lineHeight: 22 },
  bioEmpty:    { fontSize: 14, color: '#94A3B8', marginTop: 12, fontStyle: 'italic' },

  // Meta row (location, link, joined)
  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14, marginBottom: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  metaLink: { fontSize: 14, color: THEME.primary, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 24, paddingBottom: 20, paddingTop: 8 },
  statPill: { flexDirection: 'row', gap: 5, alignItems: 'baseline' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 15, color: '#64748B' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: THEME.primary },
  tabText:       { fontSize: 15, fontWeight: '600', color: '#64748B' },
  tabTextActive: { fontWeight: '700', color: THEME.primary },

  // Empty
  emptyWrap:  { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySub:   { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
