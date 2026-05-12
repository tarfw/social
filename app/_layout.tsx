import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/auth";
import { usePushNotifications } from "../hooks/usePushNotifications";

function InitialLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && segments[0] !== "login") {
      // Redirect to login if not authenticated and not on login screen
      router.replace("/login");
    } else if (isAuthenticated && segments[0] === "login") {
      // Redirect to tabs if authenticated and on login screen
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="write" options={{ presentation: 'modal', title: 'Compose' }} />
      <Stack.Screen name="view_thread" options={{ presentation: 'card', title: 'Thread' }} />
      <Stack.Screen name="profile_detail" options={{ presentation: 'card', title: 'Profile' }} />
      <Stack.Screen name="following" options={{ presentation: 'card', title: 'Follow' }} />
      <Stack.Screen name="edit_profile" options={{ presentation: 'modal', title: 'Edit Profile' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Initialize push notifications
  usePushNotifications();

  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}
