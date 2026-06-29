import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConfigErrorScreen } from '@/screens/ConfigErrorScreen';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style="light" backgroundColor={colors.green} />
          {isSupabaseConfigured ? (
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          ) : (
            <ConfigErrorScreen />
          )}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
