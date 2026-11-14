import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/stores/auth';
import { useNetwork } from '@/stores/network';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { role, isInitializing, initialize } = useAuth();
  const initializeNetwork = useNetwork((state) => state.initialize); // Get the network initializer

  useEffect(() => {
    void initialize();
    initializeNetwork(); // Start listening to connectivity changes
  }, [initialize, initializeNetwork]);

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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="search" />
        <Stack.Screen name="map" />
        
        <Stack.Screen 
          name="admin/login" 
          options={{ 
            headerShown: true, 
            title: 'Admin Sign In',
          }} 
        />

        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen 
            name="admin/index" 
            options={{ 
              headerShown: true, 
              title: 'Admin Dashboard' 
            }} 
          />
          <Stack.Screen 
            name="admin/burials" 
            options={{ 
              headerShown: true, 
              title: 'Burials Management' 
            }} 
          />
        </Stack.Protected>
      </Stack>
    </>
  );
}