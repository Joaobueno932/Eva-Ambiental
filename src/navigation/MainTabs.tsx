import React from 'react';
import { Platform } from 'react-native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { MainTabsParamList } from './types';
import { Sidebar } from './Sidebar';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { WeighingsStack } from './WeighingsStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/**
 * Altura da barra inferior no celular.
 *
 * No navegador o texto ocupa um pouco mais que no React Native, e com 64px o
 * rótulo abaixo do ícone chega a ser cortado.
 */
const BOTTOM_BAR_HEIGHT = Platform.OS === 'web' ? 74 : 64;


const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Painel: 'stats-chart',
  Pesagens: 'scale',
  Perfil: 'person-circle',
  Relatorios: 'document-text-outline',
};

export function MainTabs() {
  // Respeita a safe area inferior (botões virtuais do Android / edge-to-edge).
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  return (
    <Tab.Navigator
      // Em tela grande a navegação é o menu lateral próprio (marca + usuário);
      // no celular continua a barra de abas padrão do React Navigation.
      tabBar={(props) => (isDesktop ? <Sidebar {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.textSoft,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarStyle: {
          height: BOTTOM_BAR_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 10,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // A barra é a base da tela: a sombra a destaca do conteúdo que rola
          // por baixo, em vez de deixá-la colada nele.
          ...elevation('md'),
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.1 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name] ?? 'ellipse'} size={size} color={color} />
        ),
        // Área de trabalho ocupa o espaço disponível ao lado da navegação.
        sceneStyle: isDesktop
          ? { width: '100%', marginHorizontal: 'auto' }
          : undefined,
      })}
    >
      <Tab.Screen name="Painel" component={DashboardScreen} options={{ title: 'Visão geral' }} />
      <Tab.Screen name="Pesagens" component={WeighingsStack} />
      <Tab.Screen name="Relatorios" component={ReportsScreen} options={{ title: 'Relatórios' }} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
    </Tab.Navigator>
  );
}
