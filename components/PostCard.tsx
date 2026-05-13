import React from 'react';
import { getLabelByVal, getCommunityLabels } from '../constants/labels';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Heart,
  MessageCircle,
  Repeat2,
  MoreHorizontal,
  ExternalLink,
  Play,
  Quote,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/auth';
import { usePostActions } from '../hooks/usePostActions';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_WIDTH = SCREEN_WIDTH - 16 * 2 - 48 - 12;

interface PostCardProps {
  post: any;
  hideCommunityLabels?: boolean;
  /** Called when the thread view should open */
  onOpenThread?: (post: any) => void;
}

// ─── Embed helpers ─────────────────────────────────────────────────────────────

function getImages(embed: any): any[] {
  if (!embed) return [];
  const type: string = embed.$type ?? '';
  if (type === 'app.bsky.embed.images#view') return embed.images ?? [];
  if (type === 'app.bsky.embed.recordWithMedia#view') return getImages(embed.media);
  return [];
}

function getExternal(embed: any): any | null {
  if (!embed) return null;
  const type: string = embed.$type ?? '';
  if (type === 'app.bsky.embed.external#view') return embed.external ?? null;
  if (type === 'app.bsky.embed.recordWithMedia#view') return getExternal(embed.media);
  return null;
}

function getVideo(embed: any): any | null {
  if (!embed) return null;
  const type: string = embed.$type ?? '';
  if (type === 'app.bsky.embed.video#view') return embed;
  if (type === 'app.bsky.embed.recordWithMedia#view') return getVideo(embed.media);
  return null;
}

function getQuoteRecord(embed: any): any | null {
  if (!embed) return null;
  const type: string = embed.$type ?? '';
  if (type === 'app.bsky.embed.record#view') return embed.record ?? null;
  if (type === 'app.bsky.embed.recordWithMedia#view') return getQuoteRecord(embed.record);
  return null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ImageGrid({ images }: { images: any[] }) {
  if (images.length === 0) return null;
  if (images.length === 1) {
    const img = images[0];
    const ar = img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : 16 / 9;
    return (
      <View style={[styles.imageGridSingle, { height: CONTENT_WIDTH / ar }]}>
        <Image
          source={{ uri: img.thumb }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          accessibilityLabel={img.alt}
        />
      </View>
    );
  }
  return (
    <View style={styles.imageGrid}>
      {images.map((img: any, i: number) => (
        <View key={i} style={styles.imageGridCell}>
          <Image
            source={{ uri: img.thumb }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
            accessibilityLabel={img.alt}
          />
        </View>
      ))}
    </View>
  );
}

function ExternalCard({ external }: { external: any }) {
  const thumb = external?.thumb;
  return (
    <TouchableOpacity
      style={styles.externalCard}
      activeOpacity={0.8}
      onPress={() => external?.uri && Linking.openURL(external.uri)}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.externalThumb} contentFit="cover" transition={300} />
      ) : null}
      <View style={styles.externalMeta}>
        <View style={styles.externalDomain}>
          <ExternalLink size={11} color="#657786" />
          <Text style={styles.externalDomainText} numberOfLines={1}>
            {external?.uri ? new URL(external.uri).hostname : ''}
          </Text>
        </View>
        {external?.title ? <Text style={styles.externalTitle} numberOfLines={2}>{external.title}</Text> : null}
        {external?.description ? <Text style={styles.externalDesc} numberOfLines={2}>{external.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function VideoCard({ video }: { video: any }) {
  const thumb = video?.thumbnail;
  return (
    <View style={styles.videoCard}>
      {thumb
        ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />}
      <View style={styles.videoPlayBtn}>
        <Play size={28} color="white" fill="white" />
      </View>
    </View>
  );
}

/** Inline quote-post preview (non-recursive — just shows the quoted author + text) */
function QuoteCard({ record }: { record: any }) {
  if (!record || record.notFound || record.blocked) return null;
  const author = record.author;
  const text: string = record.value?.text ?? '';
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteAuthorRow}>
        <Image source={{ uri: author?.avatar }} style={styles.quoteAvatar} contentFit="cover" />
        <Text style={styles.quoteAuthorName} numberOfLines={1}>
          {author?.displayName || author?.handle}
        </Text>
        <Text style={styles.quoteAuthorHandle} numberOfLines={1}> @{author?.handle}</Text>
      </View>
      {text ? <Text style={styles.quoteText} numberOfLines={4}>{text}</Text> : null}
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default React.memo(function PostCard({ post: initialPost, hideCommunityLabels = false, onOpenThread }: PostCardProps) {
  const router = useRouter();
  const { agent } = useAuth();
  const { post, toggleLike, toggleRepost } = usePostActions(agent, initialPost);

  const { author, record, embed } = post;
  const replyCount   = post.replyCount   ?? 0;
  const likeCount    = post.likeCount    ?? 0;
  const repostCount  = post.repostCount  ?? 0;
  const isLiked      = !!post.viewer?.like;
  const isReposted   = !!post.viewer?.repost;

  const text: string = record?.text ?? '';
  const date = new Date(post.indexedAt || post.createdAt || Date.now());

  const images   = getImages(embed);
  const external = images.length === 0 ? getExternal(embed) : null;
  const video    = images.length === 0 && !external ? getVideo(embed) : null;
  const quote    = getQuoteRecord(embed);

  const postLabels: any[]   = post.labels ?? [];
  const recordLabels: any[] = post.record?.labels?.values ?? [];
  const communityLabelVals  = [...new Set(getCommunityLabels([...postLabels, ...recordLabels]))];
  const communityLabelDefs  = communityLabelVals.map(v => getLabelByVal(v)).filter(Boolean);

  const openThread = () => {
    if (onOpenThread) { onOpenThread(post); return; }
    router.push({ pathname: '/view_thread', params: { uri: post.uri } });
  };

  const openProfile = (did: string) => {
    router.push({ pathname: '/profile_detail', params: { did } });
  };

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={openThread} style={styles.container}>
      <View style={styles.row}>
        {/* Avatar → profile */}
        <TouchableOpacity onPress={() => author?.did && openProfile(author.did)} hitSlop={8}>
          <Image source={{ uri: author?.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <TouchableOpacity onPress={() => author?.did && openProfile(author.did)}>
              <Text style={styles.displayName} numberOfLines={1}>
                {author?.displayName || author?.handle}
              </Text>
            </TouchableOpacity>
            <Text style={styles.handle} numberOfLines={1}> @{author?.handle}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.time}>{formatDistanceToNow(date, { addSuffix: false })}</Text>
          </View>

          {/* Post text */}
          {text ? <Text style={styles.postText}>{text}</Text> : null}

          {/* Community label badges — hidden in filtered feed */}
          {!hideCommunityLabels && communityLabelDefs.length > 0 && (
            <View style={styles.labelBadgeRow}>
              {communityLabelDefs.map(def => def && (
                <View key={def.val} style={[styles.labelBadge, { backgroundColor: def.bg, borderColor: def.color }]}>
                  <View style={[styles.labelBadgeDot, { backgroundColor: def.color }]} />
                  <Text style={[styles.labelBadgeText, { color: def.color }]}>{def.display}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Media embeds */}
          {images.length > 0 && <ImageGrid images={images} />}
          {external && <ExternalCard external={external} />}
          {video && <VideoCard video={video} />}
          {quote && <QuoteCard record={quote} />}

          {/* Actions */}
          <View style={styles.actions}>
            {/* Reply */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                router.push({
                  pathname: '/write',
                  params: {
                    replyUri: post.uri,
                    replyCid: post.cid,
                    replyAuthorHandle: author?.handle ?? '',
                  },
                })
              }
              accessibilityLabel={`Reply, ${replyCount} replies`}
            >
              <MessageCircle size={18} color="#657786" />
              {replyCount > 0 && <Text style={styles.actionText}>{replyCount}</Text>}
            </TouchableOpacity>

            {/* Repost */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={toggleRepost}
              accessibilityLabel={isReposted ? 'Undo repost' : 'Repost'}
            >
              <Repeat2 size={18} color={isReposted ? '#17BF63' : '#657786'} />
              {repostCount > 0 && (
                <Text style={[styles.actionText, isReposted && { color: '#17BF63' }]}>{repostCount}</Text>
              )}
            </TouchableOpacity>

            {/* Like */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={toggleLike}
              accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={18} color={isLiked ? '#E0245E' : '#657786'} fill={isLiked ? '#E0245E' : 'none'} />
              {likeCount > 0 && (
                <Text style={[styles.actionText, isLiked && { color: '#E0245E' }]}>{likeCount}</Text>
              )}
            </TouchableOpacity>

            {/* Quote */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                router.push({
                  pathname: '/write',
                  params: { quoteUri: post.uri, quoteCid: post.cid },
                })
              }
              accessibilityLabel="Quote post"
            >
              <Quote size={17} color="#657786" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} accessibilityLabel="More options">
              <MoreHorizontal size={18} color="#657786" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const GAP = 4;
const CELL_SIZE = (CONTENT_WIDTH - GAP) / 2;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F5',
    backgroundColor: 'white',
  },
  row: { flexDirection: 'row' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F3F5' },
  content: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, gap: 0 },
  displayName: { fontWeight: '700', fontSize: 15, color: '#14171A', flexShrink: 1 },
  handle: { fontSize: 14, color: '#657786', flexShrink: 1 },
  dot: { color: '#657786', marginHorizontal: 3 },
  time: { fontSize: 13, color: '#657786' },
  postText: { fontSize: 15, lineHeight: 21, color: '#14171A', marginBottom: 10 },

  // Images
  imageGridSingle: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F3F5', marginBottom: 10 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 10 },
  imageGridCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F0F3F5' },

  // External
  externalCard: { borderWidth: 1, borderColor: '#E1E8ED', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  externalThumb: { width: '100%', height: 150, backgroundColor: '#F0F3F5' },
  externalMeta: { padding: 10 },
  externalDomain: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  externalDomainText: { fontSize: 12, color: '#657786' },
  externalTitle: { fontSize: 14, fontWeight: '700', color: '#14171A', marginBottom: 2 },
  externalDesc: { fontSize: 13, color: '#657786', lineHeight: 18 },

  // Video
  videoCard: {
    width: '100%', height: CONTENT_WIDTH * (9 / 16), borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#1a1a1a', marginBottom: 10, justifyContent: 'center', alignItems: 'center',
  },
  videoPlayBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Quote
  quoteCard: {
    borderWidth: 1, borderColor: '#E1E8ED', borderRadius: 12,
    padding: 10, marginBottom: 10, backgroundColor: '#FAFCFF',
  },
  quoteAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  quoteAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E1E8ED' },
  quoteAuthorName: { fontSize: 13, fontWeight: '700', color: '#14171A', flexShrink: 1 },
  quoteAuthorHandle: { fontSize: 13, color: '#657786', flexShrink: 1 },
  quoteText: { fontSize: 14, color: '#14171A', lineHeight: 19 },

  // Label badges
  labelBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  labelBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, gap: 4,
  },
  labelBadgeDot: { width: 5, height: 5, borderRadius: 3 },
  labelBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingBottom: 10,
    marginTop: 4,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 36 },
  actionText: { fontSize: 13, color: '#657786' },
});
