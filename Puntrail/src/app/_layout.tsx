import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/stores/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { role, isInitializing, initialize } = useAuth();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing) {
      void SplashScreen.hideAsync();
    }
  }, [isInitializing]);

  if (isInitializing) {
    return null;
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0D1117' : '#FFFFFF',
          },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="search" />
        <Stack.Screen name="map" />
        <Stack.Screen name="admin/login" options={{ headerShown: true, title: 'Admin Sign In' }} />

        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen name="admin/index" options={{ headerShown: true, title: 'Admin Dashboard' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}