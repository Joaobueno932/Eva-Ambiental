import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header } from '@/components';
import { colors, spacing } from '@/theme';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'AdminHub'>;

const ITEMS: { route: keyof ProfileStackParamList; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { route: 'AdminUsers', icon: 'people', title: 'Usuários', sub: 'Criar, ativar e definir perfis' },
  { route: 'AdminClients', icon: 'business', title: 'Clientes', sub: 'Gerenciar clientes' },
  { route: 'AdminUnits', icon: 'location', title: 'Unidades', sub: 'Locais por cliente' },
  { route: 'AdminWasteTypes', icon: 'trash', title: 'Tipos de Resíduos', sub: 'Categorias de resíduos' },
  { route: 'AdminTreatmentTypes', icon: 'sync', title: 'Tipos de Tratamento', sub: 'Define desvio de aterro' },
  { route: 'AdminRecipients', icon: 'navigate', title: 'Destinatários', sub: 'Para onde o resíduo vai' },
  { route: 'AdminImport', icon: 'cloud-upload', title: 'Importação', sub: 'Importar dados via planilha Excel' },
];

export function AdminHubScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.container}>
      <Header title="Administração" subtitle="Gestão do sistema" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {ITEMS.map((item) => (
          <Card key={item.route} onPress={() => navigation.navigate(item.route as any)}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={item.icon} size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.greenDark} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { color: colors.grayText, fontSize: 13 },
});
