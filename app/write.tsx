import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/auth';
import { X, ImageIcon, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COMMUNITY_LABELS, type CommunityLabelVal } from '../constants/labels';
import { THEME } from '../constants/theme';
import { useProfileCache } from '../hooks/useProfileCache';

export default function ComposeScreen() {
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<CommunityLabelVal | null>(null);
  const [images, setImages] = useState<{ uri: string; mimeType: string; width: number; height: number }[]>([]);

  const { agent } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    replyUri?: string;
    replyCid?: string;
    replyAuthorHandle?: string;
    quoteUri?: string;
    quoteCid?: string;
    initialCommunity?: string;
  }>();

  const isReply = !!params.replyUri;
  const isQuote = !!params.quoteUri;

  // Handle contextual community label pre-selection
  useEffect(() => {
    if (params.initialCommunity) {
      const label = COMMUNITY_LABELS.find(l => l.val === params.initialCommunity);
      if (label) {
        setSelectedLabel(label.val as CommunityLabelVal);
      }
    }
  }, [params.initialCommunity]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.85,
    });
    if (!result.canceled) {
      setImages(prev => {
        const combined = [
          ...prev,
          ...result.assets.map(a => ({
            uri: a.uri,
            mimeType: a.mimeType ?? 'image/jpeg',
            width: a.width,
            height: a.height,
          })),
        ];
        return combined.slice(0, 4);
      });
    }
  };

  const handlePost = useCallback(async () => {
    if (!text.trim() && images.length === 0) return;
    if (!agent) return;
    try {
      setIsPosting(true);

      // Upload images — use FileSystem to avoid blob.arrayBuffer() not available in RN
      let imageBlobs: any[] = [];
      for (const img of images) {
        const base64 = await FileSystem.readAsStringAsync(img.uri, {
          encoding: 'base64',
        });
        const byteCharacters = atob(base64);
        const uint8 = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          uint8[i] = byteCharacters.charCodeAt(i);
        }
        const uploadRes = await agent.uploadBlob(uint8, { encoding: img.mimeType });
        imageBlobs.push({
          image: uploadRes.data.blob,
          alt: '',
          aspectRatio: { width: img.width, height: img.height },
        });
      }

      const postRecord: Record<string, any> = {
        createdAt: new Date().toISOString(),
        langs: ['ta', 'en'],
      };

      let finalPostText = text.trim();
      if (selectedLabel) {
        // Append hashtag for universal indexing
        const labelDef = COMMUNITY_LABELS.find(l => l.val === selectedLabel);
        const hashtag = labelDef ? `#${labelDef.val}` : `#${selectedLabel}`;
        finalPostText = `${finalPostText}\n\n${hashtag}`;
        
        postRecord.labels = {
          $type: 'com.atproto.label.defs#selfLabels',
          values: [{ val: selectedLabel }],
        };
      }
      
      postRecord.text = finalPostText;

      if (imageBlobs.length > 0) {
        postRecord.embed = {
          $type: 'app.bsky.embed.images',
          images: imageBlobs,
        };
      }

      // Quote embed (overrides image embed if both — Bluesky uses recordWithMedia)
      if (isQuote && params.quoteUri && params.quoteCid) {
        const quoteEmbed = {
          $type: 'app.bsky.embed.record',
          record: { uri: params.quoteUri, cid: params.quoteCid },
        };
        if (imageBlobs.length > 0) {
          postRecord.embed = {
            $type: 'app.bsky.embed.recordWithMedia',
            record: quoteEmbed,
            media: { $type: 'app.bsky.embed.images', images: imageBlobs },
          };
        } else {
          postRecord.embed = quoteEmbed;
        }
      }

      if (isReply && params.replyUri && params.replyCid) {
        postRecord.reply = {
          root: { uri: params.replyUri, cid: params.replyCid },
          parent: { uri: params.replyUri, cid: params.replyCid },
        };
      }

      await agent.post(postRecord);
      router.back();
    } catch (e) {
      console.error('Failed to post', e);
    } finally {
      setIsPosting(false);
    }
  }, [text, images, selectedLabel, agent, isReply, isQuote, params, router]);

  const charCount = text.length;
  const remaining = 300 - charCount;
  const isOverLimit = remaining < 0;
  const canPost = (text.trim().length > 0 || images.length > 0) && !isPosting && !isOverLimit;

  const { profile } = useProfileCache(agent, agent?.session?.did ?? '');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={20} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {isPosting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled">
          <View style={styles.composerContent}>
            <View style={styles.mainRow}>
              <View style={styles.avatarCol}>
                <Image source={{ uri: profile?.avatar }} style={styles.avatar} contentFit="cover" />
                <View style={styles.threadLine} />
              </View>

              <View style={styles.bodyCol}>
                {(isReply || isQuote) && (
                  <Text style={styles.replyingTo}>
                    {isReply ? `Replying to @${params.replyAuthorHandle}` : 'Quoting post'}
                  </Text>
                )}
                <TextInput
                  style={styles.input}
                  placeholder={isReply ? 'Post your reply' : "What's happening?"}
                  placeholderTextColor="#536471"
                  multiline
                  autoFocus
                  value={text}
                  onChangeText={setText}
                  scrollEnabled={false}
                />

                {images.length > 0 && (
                  <View style={styles.imageContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviews}>
                      {images.map((img, i) => (
                        <View key={i} style={styles.imagePreviewWrap}>
                          <Image source={{ uri: img.uri }} style={styles.imagePreview} contentFit="cover" />
                          <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImages(p => p.filter((_, j) => j !== i))}>
                            <X size={14} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Native Bottom Deck */}
        <View style={styles.stickyFooter}>
          <View style={styles.communityBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityScroll}>
              <TouchableOpacity
                style={[styles.labelChip, selectedLabel === null && styles.labelChipActive]}
                onPress={() => setSelectedLabel(null)}
              >
                <Tag size={14} color={selectedLabel === null ? THEME.primary : '#536471'} />
                <Text style={[styles.labelChipText, selectedLabel === null && styles.labelChipTextActive]}>Public</Text>
              </TouchableOpacity>
              {COMMUNITY_LABELS.map(label => {
                const isActive = selectedLabel === label.val;
                return (
                  <TouchableOpacity
                    key={label.val}
                    style={[styles.labelChip, isActive && styles.labelChipActive]}
                    onPress={() => setSelectedLabel(isActive ? null : label.val as CommunityLabelVal)}
                  >
                    <Text style={[styles.labelChipText, isActive && styles.labelChipTextActive]}>
                      {label.display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.toolbar}>
            <View style={styles.toolbarLeft}>
              <TouchableOpacity style={styles.toolbarIcon} onPress={pickImage}>
                <ImageIcon size={22} color={THEME.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.toolbarRight}>
              {charCount > 0 && (
                <Text style={[styles.charCount, isOverLimit && styles.charCountWarning]}>
                  {remaining}
                </Text>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 54,
    backgroundColor: 'white',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F3F5',
  },
  headerBtn: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  cancelText: {
    fontSize: 17,
    color: '#14171A',
    fontWeight: '400',
  },
  postButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  
  composerContent: {
    flex: 1,
    paddingTop: 16,
  },
  mainRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  avatarCol: {
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
  },
  threadLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#F0F3F5',
    marginTop: 4,
    borderRadius: 1,
  },
  bodyCol: {
    flex: 1,
  },
  input: {
    fontSize: 19,
    lineHeight: 26,
    color: '#14171A',
    textAlignVertical: 'top',
    paddingTop: 0, // Align with avatar top
    minHeight: 120,
  },
  
  imageContainer: {
    marginTop: 12,
    marginBottom: 20,
  },
  imagePreviews: {
    flexDirection: 'row',
    gap: 8,
  },
  imagePreviewWrap: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F3F5',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  stickyFooter: {
    backgroundColor: 'white',
    borderTopWidth: 0.5,
    borderTopColor: '#CFD9DE',
  },
  communityBar: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F3F5',
  },
  communityScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CFD9DE',
    gap: 6,
  },
  labelChipActive: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primary + '10',
  },
  labelChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#536471',
  },
  labelChipTextActive: {
    color: THEME.primary,
  },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 54,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarIcon: {
    padding: 10,
  },
  toolbarRight: {
    paddingRight: 16,
  },
  charCount: {
    fontSize: 13,
    color: '#536471',
    fontWeight: '500',
  },
  charCountWarning: {
    color: '#E0245E',
  },
});
