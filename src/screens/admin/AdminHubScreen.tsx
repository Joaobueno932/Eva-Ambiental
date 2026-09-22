import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header } from '@/components';
import { useIsDesktop } from '@/hooks/useLayout';
import { SectionHeading } from '@/components/Operations';
import { colors, layout, radius, spacing } from '@/theme';
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
  const isDesktop = useIsDesktop();
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.container}>
      <Header
        eyebrow="Administração"
        title="Cadastros e administração"
        subtitle="Estruture a operação e gerencie os acessos"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.scroll, isDesktop && styles.scrollDesktop]}>
        <SectionHeading title="Base da operação" description="Clientes, locais, classificação, destinação e responsáveis." />
        <View style={isDesktop ? styles.grid : undefined}>
          {ITEMS.map((item) => (
            <Card style={isDesktop ? styles.gridItem : undefined} key={item.route} onPress={() => navigation.navigate(item.route as any)}>
              <View style={styles.row}>
                {/* Ícone em verde claro, não no verde cheio: são sete cartões
                    na mesma tela e sete blocos escuros dominariam a página. */}
                <View style={styles.icon}>
                  <Ionicons name={item.icon} size={19} color={colors.brand[600]} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.sub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  grow: { flex: 1 },
  scroll: { padding: spacing.lg },
  scrollDesktop: { padding: spacing.xl + 4, width: '100%', maxWidth: layout.content, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { flexBasis: '31%', flexGrow: 1, minWidth: 260, marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  sub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
});
