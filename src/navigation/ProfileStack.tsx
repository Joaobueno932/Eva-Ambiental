import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { AdminHubScreen } from '@/screens/admin/AdminHubScreen';
import { AdminUsersScreen } from '@/screens/admin/AdminUsersScreen';
import { AdminClientsScreen } from '@/screens/admin/AdminClientsScreen';
import { AdminUnitsScreen } from '@/screens/admin/AdminUnitsScreen';
import { AdminWasteTypesScreen } from '@/screens/admin/AdminWasteTypesScreen';
import { AdminTreatmentTypesScreen } from '@/screens/admin/AdminTreatmentTypesScreen';
import { AdminRecipientsScreen } from '@/screens/admin/AdminRecipientsScreen';
import { AdminImportScreen } from '@/screens/admin/AdminImportScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="AdminHub" component={AdminHubScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminClients" component={AdminClientsScreen} />
      <Stack.Screen name="AdminUnits" component={AdminUnitsScreen} />
      <Stack.Screen name="AdminWasteTypes" component={AdminWasteTypesScreen} />
      <Stack.Screen name="AdminTreatmentTypes" component={AdminTreatmentTypesScreen} />
      <Stack.Screen name="AdminRecipients" component={AdminRecipientsScreen} />
      <Stack.Screen name="AdminImport" component={AdminImportScreen} />
    </Stack.Navigator>
  );
}
