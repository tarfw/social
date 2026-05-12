import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth } from '../context/auth';
import { THEME } from '../constants/theme';

export default function LoginScreen() {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!handle || !password) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // Append .bsky.social if user didn't include a domain
      const identifier = handle.includes('.') ? handle : `${handle}.bsky.social`;
      await login(identifier, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message?.includes('Invalid') 
        ? 'Invalid handle or App Password. Please check and try again.'
        : (e?.message || 'Login failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.innerContent}>
            {/* Logo Section */}
            <Animated.View 
              entering={FadeInDown.delay(200).duration(800).springify()}
              style={styles.header}
            >
              <Image 
                source={require('../assets/images/gemini_logo.png')}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.appName}>social</Text>
            </Animated.View>

            {/* Form Section */}
            <Animated.View 
              entering={FadeInDown.delay(400).duration(800).springify()}
              style={styles.form}
            >
              <View style={styles.inputWrapper}>
                <View style={styles.handleInputContainer}>
                  <TextInput
                    style={styles.handleInput}
                    placeholder="handle"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={handle}
                    onChangeText={setHandle}
                    editable={!isSubmitting}
                  />
                  <Text style={styles.domainSuffix}>.bsky.social</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="App Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isSubmitting}
                />
              </View>

              {error && (
                <Animated.View entering={FadeIn.duration(400)} style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              <TouchableOpacity
                style={[styles.button, (!handle || !password || isSubmitting) && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={!handle || !password || isSubmitting}
                activeOpacity={0.9}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => Linking.openURL('https://bsky.app/settings/app-passwords')}
                style={styles.hintContainer}
                activeOpacity={0.7}
              >
                <Text style={styles.hint}>
                  Use an App Password. <Text style={styles.hintLink}>Get one here</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => WebBrowser.openBrowserAsync('https://bsky.app/signup')}
                style={styles.signUpContainer}
                activeOpacity={0.7}
              >
                <Text style={styles.signUpText}>
                  New to the network? <Text style={styles.signUpLink}>Join here</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View 
            entering={FadeIn.delay(800).duration(1000)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Powered by AT Protocol</Text>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  safe: { 
    flex: 1,
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 40,
  },
  innerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Header
  header: { 
    alignItems: 'center', 
    marginBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  appName: { 
    fontSize: 32, 
    fontWeight: '700', 
    color: THEME.text, 
    letterSpacing: -0.5,
  },

  // Form
  form: { 
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    fontSize: 16,
    color: THEME.text,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  handleInputContainer: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  handleInput: {
    flex: 1,
    fontSize: 16,
    color: THEME.text,
    padding: 0, // Reset default padding
  },
  domainSuffix: {
    fontSize: 16,
    color: THEME.textLight,
    fontWeight: '500',
  },

  // Button
  button: {
    backgroundColor: THEME.primary, 
    height: 56, 
    borderRadius: 16,
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: 12,
    // Premium shadow
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, 
    shadowRadius: 12, 
    elevation: 5,
  },
  buttonDisabled: { 
    opacity: 0.5, 
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    color: 'white', 
    fontSize: 17, 
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Error
  errorContainer: {
    backgroundColor: '#FFF1F2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  errorText: {
    color: '#E11D48',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Hint
  hintContainer: { 
    marginTop: 24, 
    alignItems: 'center',
  },
  hint: { 
    fontSize: 14, 
    color: THEME.textLight,
  },
  hintLink: { 
    color: THEME.primary, 
    fontWeight: '600',
  },

  // SignUp
  signUpContainer: {
    marginTop: 16,
    alignItems: 'center',
    padding: 8,
  },
  signUpText: {
    fontSize: 14,
    color: THEME.textLight,
  },
  signUpLink: {
    color: THEME.primary,
    fontWeight: '700',
  },

  // Footer
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

