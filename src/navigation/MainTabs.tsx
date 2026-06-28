import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { MainTabsParamList } from './types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { WeighingsStack } from './WeighingsStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.greenDark,
        tabBarInactiveTintColor: colors.grayText,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: colors.white,
          borderTopColor: colors.grayMedium,
        },
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
