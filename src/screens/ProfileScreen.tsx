import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card, ConfirmModal, EvaImage, EvaInfoModal, Header } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { roleLabel } from '@/utils/format';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const { isAdmin } = usePermissions();
  const [confirmOut, setConfirmOut] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const showInfo = (title: string, message: string) => Alert.alert(title, message);

  return (
    <View style={styles.container}>
      <Header title="Perfil" subtitle="Sua conta e preferências" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile?.full_name?.charAt(0).toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile?.full_name}</Text>
              <Text style={styles.email}>{profile?.email}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleText}>{roleLabel[profile?.role ?? 'viewer']}</Text>
              </View>
            </View>
          </View>
        </Card>

        {isAdmin && (
          <Card onPress={() => navigation.navigate('AdminHub')} style={styles.adminCard}>
            <View style={styles.adminRow}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminTitle}>Administração</Text>
                <Text style={styles.adminSub}>Usuários, clientes, unidades e cadastros</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.greenDark} />
            </View>
          </Card>
        )}

        <Card>
          <MenuItem icon="person-outline" label="Meus Dados" onPress={() => showInfo('Meus Dados', `Nome: ${profile?.full_name}\nE-mail: ${profile?.email}\nPerfil: ${roleLabel[profile?.role ?? 'viewer']}`)} />
          <MenuItem icon="accessibility-outline" label="Acessibilidade" onPress={() => showInfo('Acessibilidade', 'O app usa botões grandes, alto contraste e textos legíveis. Ajuste o tamanho da fonte nas configurações do Android.')} />
          <MenuItem icon="help-circle-outline" label="Ajuda" onPress={() => setShowHelp(true)} />
          <MenuItem icon="information-circle-outline" label="Sobre" onPress={() => setShowAbout(true)} />
          <MenuItem icon="log-out-outline" label="Sair" danger onPress={() => setConfirmOut(true)} last />
        </Card>

        <View style={styles.brandFooter}>
          <EvaImage name="portrait" size={44} style={styles.brandLogo} />
          <Text style={styles.version}>Eva Ambiental • versão {version}</Text>
        </View>
      </ScrollView>

      <EvaInfoModal
        visible={showHelp}
        eva="pointing"
        title="Como usar o Eva Ambiental"
        message={
          'Registre pesagens na aba Pesagens (botão +), anexando foto e localização.\n\n' +
          'Acompanhe indicadores e a taxa de desvio de aterro no Painel.\n\n' +
          'Gere relatórios em PDF e CSV a qualquer momento. Em caso de dúvidas, fale com um administrador.'
        }
        onClose={() => setShowHelp(false)}
      />
      <EvaInfoModal
        visible={showAbout}
        eva="portrait"
        title="Sobre o Eva Ambiental"
        message={
          'Olá, eu sou a Eva! 🌱\n\n' +
          'O Eva Ambiental ajuda empresas e equipes no controle, na rastreabilidade e no monitoramento das pesagens de resíduos — com evidências fotográficas, indicadores e relatórios.\n\n' +
          'Sustentabilidade, confiança e organização.'
        }
        onClose={() => setShowAbout(false)}
      />

      <ConfirmModal
        visible={confirmOut}
        title="Sair da conta"
        message="Deseja realmente encerrar a sessão?"
        confirmLabel="Sair"
        destructive
        onConfirm={() => {
          setConfirmOut(false);
          signOut();
        }}
        onCancel={() => setConfirmOut(false)}
      />
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuItem, !last && styles.menuBorder]}
      accessibilityRole="button"
    >
      <View style={styles.menuRow}>
        <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.greenDark} />
        <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={18} color={colors.grayMedium} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  email: { color: colors.grayText, marginTop: 1 },
  roleTag: { alignSelf: 'flex-start', backgroundColor: colors.greenBg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: spacing.xs },
  roleText: { color: colors.greenDark, fontWeight: '700', fontSize: 12 },
  adminCard: { backgroundColor: colors.white },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  adminIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  adminTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  adminSub: { color: colors.grayText, fontSize: 13 },
  menuItem: { paddingVertical: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuLabel: { fontSize: 16, color: colors.text, fontWeight: '600' },
  brandFooter: { alignItems: 'center', marginTop: spacing.lg },
  brandLogo: { borderRadius: 22, marginBottom: spacing.xs },
  version: { textAlign: 'center', color: colors.grayText, fontSize: 13 },
});
