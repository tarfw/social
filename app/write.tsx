import React, { useState, useCallback } from 'react';
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
  }>();

  const isReply = !!params.replyUri;
  const isQuote = !!params.quoteUri;

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

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <X size={26} color="#14171A" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {isReply && (
              <Text style={styles.replyingTo}>Replying to @{params.replyAuthorHandle}</Text>
            )}
            {isQuote && <Text style={styles.replyingTo}>Quoting post</Text>}
          </View>
          <TouchableOpacity
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost}
            accessibilityLabel="Post"
          >
            {isPosting
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.postButtonText}>Post</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled">
          {/* Text input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={isReply ? 'Write your reply…' : "What's happening?"}
              placeholderTextColor="#AAB8C2"
              multiline
              autoFocus
              value={text}
              onChangeText={setText}
            />
          </View>

          {/* Image previews */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagePreviews}>
              {images.map((img, i) => (
                <View key={i} style={styles.imagePreviewWrap}>
                  <Image source={{ uri: img.uri }} style={styles.imagePreview} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => setImages(p => p.filter((_, j) => j !== i))}
                    accessibilityLabel="Remove image"
                  >
                    <X size={14} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Label picker */}
          <View style={styles.labelSection}>
            <View style={styles.labelHeader}>
              <Tag size={15} color="#657786" />
              <Text style={styles.labelHeaderText}>Community label</Text>
            </View>
            <View style={styles.labelRow}>
              <TouchableOpacity
                style={[styles.labelChip, selectedLabel === null && styles.labelChipNoneSelected]}
                onPress={() => setSelectedLabel(null)}
              >
                <Text style={[styles.labelChipText, selectedLabel === null && styles.labelChipTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {COMMUNITY_LABELS.map(label => {
                const isActive = selectedLabel === label.val;
                return (
                  <TouchableOpacity
                    key={label.val}
                    style={[styles.labelChip, isActive && { backgroundColor: label.bg, borderColor: label.color }]}
                    onPress={() => setSelectedLabel(isActive ? null : label.val as CommunityLabelVal)}
                  >
                    {isActive && <View style={[styles.labelDot, { backgroundColor: label.color }]} />}
                    <Text style={[styles.labelChipText, isActive && { color: label.color, fontWeight: '700' }]}>
                      {label.display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.footerIcon}
            onPress={pickImage}
            disabled={images.length >= 4}
            accessibilityLabel="Attach image"
          >
            <ImageIcon size={22} color={images.length >= 4 ? '#AAB8C2' : THEME.primary} />
          </TouchableOpacity>
          <View style={styles.charRow}>
            {remaining <= 50 && (
              <Text style={[styles.charCount, isOverLimit && styles.charCountWarning]}>
                {remaining}
              </Text>
            )}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F3F5',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  replyingTo: { fontSize: 13, color: '#657786' },
  postButton: {
    backgroundColor: THEME.primary, paddingHorizontal: 22, paddingVertical: 9,
    borderRadius: 20, minWidth: 80, alignItems: 'center',
  },
  postButtonDisabled: { opacity: 0.45 },
  postButtonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  inputContainer: { paddingHorizontal: 16, paddingTop: 14, minHeight: 140 },
  input: { fontSize: 19, lineHeight: 26, color: '#14171A', textAlignVertical: 'top' },
  imagePreviews: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  imagePreviewWrap: { position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden' },
  imagePreview: { width: 90, height: 90 },
  imageRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  labelSection: {
    marginHorizontal: 16, marginTop: 16, padding: 14,
    backgroundColor: '#F8FAFC', borderRadius: 14,
    borderWidth: 1, borderColor: '#E8ECF0',
  },
  labelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  labelHeaderText: {
    fontSize: 13, fontWeight: '600', color: '#657786',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  labelChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#D9E1E8', backgroundColor: 'white', gap: 6,
  },
  labelChipNoneSelected: { borderColor: THEME.primary, backgroundColor: '#F0FDF4' },
  labelDot: { width: 7, height: 7, borderRadius: 4 },
  labelChipText: { fontSize: 14, color: '#657786', fontWeight: '500' },
  labelChipTextSelected: { color: THEME.primary, fontWeight: '700' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F3F5',
  },
  footerIcon: { padding: 6 },
  charRow: { alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  charCount: { fontSize: 14, color: '#657786', fontWeight: '600' },
  charCountWarning: { color: '#E0245E' },
});
