import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { Loading } from '@/components';
import { colors } from '@/theme';
import { LoginScreen } from '@/screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { documentTitle, linking } from './linking';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.greenBg, primary: colors.green },
};

export function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading message="Iniciando o Eva Ambiental..." />;

  const authenticated = !!session && !!profile;

  return (
    <NavigationContainer
      theme={navTheme}
      linking={linking}
      documentTitle={documentTitle}
      fallback={<Loading message="Carregando..." />}
    >
      {authenticated ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}
