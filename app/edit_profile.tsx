import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Camera } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import { THEME } from '../constants/theme';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agent } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri]     = useState<string | undefined>(undefined);
  const [bannerUri, setBannerUri]     = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving]       = useState(false);
  const [isLoading, setIsLoading]     = useState(true);

  // Load existing profile
  useEffect(() => {
    const load = async () => {
      if (!agent?.session?.did) return;
      try {
        const res = await agent.getProfile({ actor: agent.session.did });
        setDisplayName(res.data.displayName ?? '');
        setDescription(res.data.description ?? '');
        setAvatarUri(res.data.avatar);
        setBannerUri(res.data.banner);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [agent]);

  const pickImage = async (type: 'avatar' | 'banner') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'avatar') setAvatarUri(result.assets[0].uri);
      else setBannerUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!agent) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const byteCharacters = atob(base64);
      const uint8 = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        uint8[i] = byteCharacters.charCodeAt(i);
      }
      const res = await agent.uploadBlob(uint8, { encoding: 'image/jpeg' });
      return res.data.blob;
    } catch (e) {
      console.error('Upload failed', e);
      throw e;
    }
  };

  const handleSave = async () => {
    if (!agent) return;
    try {
      setIsSaving(true);
      const did = agent.session?.did;
      
      // Fetch current record to preserve other fields
      const record = await agent.com.atproto.repo.getRecord({
        repo: did!,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      }).catch(() => ({ data: { value: {} } }));

      const current: any = record.data.value ?? {};
      const nextRecord: any = {
        ...current,
        $type: 'app.bsky.actor.profile',
        displayName: displayName.trim(),
        description: description.trim(),
      };

      // Check if avatar is local URI (file://)
      if (avatarUri && avatarUri.startsWith('file')) {
        const blob = await uploadImage(avatarUri);
        if (blob) nextRecord.avatar = blob;
      } else if (!avatarUri) {
        delete nextRecord.avatar;
      }

      // Check if banner is local URI (file://)
      if (bannerUri && bannerUri.startsWith('file')) {
        const blob = await uploadImage(bannerUri);
        if (blob) nextRecord.banner = blob;
      } else if (!bannerUri) {
        delete nextRecord.banner;
      }

      await agent.com.atproto.repo.putRecord({
        repo: did!,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: nextRecord,
      });

      router.back();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Done'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Banner */}
          <TouchableOpacity 
            style={styles.bannerWrap} 
            onPress={() => pickImage('banner')}
            activeOpacity={0.9}
          >
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />}
            <View style={styles.cameraOverlay}>
              <Camera size={24} color="white" />
            </View>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={() => pickImage('avatar')}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.avatarCameraOverlay}>
                <Camera size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor="#94A3B8"
                maxLength={64}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell the world about yourself"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={256}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const BANNER_H    = 160;
const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  iconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  saveBtn: {
    paddingHorizontal: 4, paddingVertical: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: THEME.primary, fontWeight: '700', fontSize: 16 },

  scroll: { flex: 1 },

  bannerWrap: { height: BANNER_H, backgroundColor: '#F1F5F9', position: 'relative' },
  bannerFallback: { backgroundColor: THEME.primary },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarWrap: {
    paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2) - 4,
  },
  avatarContainer: { position: 'relative', width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4, borderColor: '#fff', backgroundColor: '#F8FAFC',
  },
  avatarCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fields: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 24 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  bioInput: { minHeight: 120, paddingTop: 14 },
});
