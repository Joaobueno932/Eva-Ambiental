import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WeighingsStackParamList } from './types';
import { WeighingsListScreen } from '@/screens/WeighingsListScreen';
import { WeighingFormScreen } from '@/screens/WeighingFormScreen';
import { WeighingDetailsScreen } from '@/screens/WeighingDetailsScreen';

const Stack = createNativeStackNavigator<WeighingsStackParamList>();

export function WeighingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WeighingsList" component={WeighingsListScreen} />
      <Stack.Screen name="WeighingForm" component={WeighingFormScreen} />
      <Stack.Screen name="WeighingDetails" component={WeighingDetailsScreen} />
    </Stack.Navigator>
  );
}
