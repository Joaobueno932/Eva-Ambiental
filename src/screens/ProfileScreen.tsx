import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card, ConfirmModal, EvaImage, EvaInfoModal, Header } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ABOUT, HOW_TO_USE } from '@/utils/guides';
import { roleLabel } from '@/utils/format';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const { isAdmin } = usePermissions();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [confirmOut, setConfirmOut] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const showInfo = (title: string, message: string) => showAlert(title, message);

  return (
    <View style={styles.container}>
      <Header title="Perfil" subtitle="Sua conta e preferências" />
      <ScrollView
        contentContainerStyle={[
          isDesktop ? webStyles.scroll : styles.scroll,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
      >
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
        message={HOW_TO_USE}
        onClose={() => setShowHelp(false)}
      />
      <EvaInfoModal
        visible={showAbout}
        eva="portrait"
        title="Sobre o Eva Ambiental"
        message={ABOUT}
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
  const isDesktop = useIsDesktop();
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        isDesktop ? webStyles.menuItem : styles.menuItem,
        !last && styles.menuBorder,
        isDesktop && hovered && { backgroundColor: colors.surfaceAlt },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.menuRow}>
        <Ionicons name={icon} size={isDesktop ? 18 : 22} color={danger ? colors.danger : colors.greenDark} />
        <Text style={[isDesktop ? webStyles.menuLabel : styles.menuLabel, danger && { color: colors.danger }]}>
          {label}
        </Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { padding: spacing.lg },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.brand[700], fontSize: 22, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  email: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.greenLine,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  roleText: { color: colors.brand[700], fontWeight: '700', fontSize: 11.5, letterSpacing: 0.2 },
  adminCard: { backgroundColor: colors.surface },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  adminIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  adminSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  menuItem: { paddingVertical: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  brandFooter: { alignItems: 'center', marginTop: spacing.xl },
  brandLogo: { borderRadius: radius.lg, marginBottom: spacing.sm },
  version: { textAlign: 'center', color: colors.textSoft, fontSize: 12 },
});

const webStyles = StyleSheet.create({
  // Página de conta: coluna estreita lê melhor que a largura toda do monitor.
  // Alinhado à esquerda para acompanhar o título da página, que começa ali.
  scroll: { padding: spacing.xl + 4, width: '100%', maxWidth: 760 },
  menuItem: { paddingVertical: 11, paddingHorizontal: spacing.sm, borderRadius: radius.sm, marginHorizontal: -spacing.sm },
  menuLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
