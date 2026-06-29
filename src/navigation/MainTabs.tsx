import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { MainTabsParamList } from './types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { WeighingsStack } from './WeighingsStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  // Respeita a safe area inferior (botões virtuais do Android / edge-to-edge).
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.greenDark,
        tabBarInactiveTintColor: colors.grayText,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.grayMedium,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icon: Record<string, keyof typeof Ionicons.glyphMap> = {
            Painel: 'stats-chart',
            Pesagens: 'scale',
            Perfil: 'person-circle',
          };
          return <Ionicons name={icon[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Painel" component={DashboardScreen} />
      <Tab.Screen name="Pesagens" component={WeighingsStack} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
    </Tab.Navigator>
  );
}
