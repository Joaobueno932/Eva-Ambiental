import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradient, gradients, layout, radius, spacing, transition } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/Button';
import { roleLabel } from '@/utils/format';

/** Largura do menu lateral. */
export const SIDEBAR_WIDTH = layout.sidebar;

const icons: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Painel: { on: 'stats-chart', off: 'stats-chart-outline' },
  Pesagens: { on: 'scale', off: 'scale-outline' },
  Perfil: { on: 'person-circle', off: 'person-circle-outline' },
  Relatorios: { on: 'document-text', off: 'document-text-outline' },
};

/**
 * Menu lateral do site.
 *
 * Substitui a barra de abas do React Navigation em tela grande. A barra padrão
 * sabe listar rotas, mas não tem onde colocar a marca e a identificação de quem
 * está logado — que num sistema de uso diário precisam estar sempre visíveis.
 * Por isso a navegação é renderizada aqui, e não via `tabBarPosition`.
 *
 * O fundo é um degradê que escurece para baixo, e o item ativo é marcado por
 * uma faixa lima na borda esquerda sobre um verde mais claro. O bloco lima
 * inteiro que havia antes dominava a tela: o menu passava a ser a coisa mais
 * chamativa da interface, à frente dos próprios dados.
 */
export function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { canCreateWeighing, isAdmin } = usePermissions();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const initial = profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ?? '?';

  const renderItem = (opts: {
    key: string;
    label: string;
    icon: { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap };
    focused: boolean;
    onPress: () => void;
    role: 'tab' | 'button';
  }) => (
    <Pressable
      key={opts.key}
      onPress={opts.onPress}
      accessibilityRole={opts.role}
      accessibilityState={opts.role === 'tab' ? { selected: opts.focused } : undefined}
      accessibilityLabel={opts.label}
      style={({ hovered }: any) => [
        styles.item,
        transition(),
        hovered && !opts.focused && styles.itemHover,
        opts.focused && styles.itemActive,
      ]}
    >
      <View style={[styles.itemMarker, opts.focused && styles.itemMarkerOn]} />
      <Ionicons
        name={opts.focused ? opts.icon.on : opts.icon.off}
        size={18}
        color={opts.focused ? colors.accent : colors.onSidebarMuted}
      />
      <Text style={[styles.itemText, opts.focused && styles.itemTextActive]} numberOfLines={1}>
        {opts.label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.sidebar,
        gradient(gradients.sidebar, colors.sidebar),
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandMark, gradient(gradients.accent, colors.accent)]}>
          <Ionicons name="leaf" size={17} color={colors.brand[800]} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.brandText}>Eva Ambiental</Text>
          <Text style={styles.brandSub}>Controle operacional</Text>
        </View>
      </View>

      {canCreateWeighing ? (
        <Button
          title="Registrar pesagem"
          icon="add"
          variant="secondary"
          onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })}
          style={styles.cta}
        />
      ) : null}

      <View style={styles.nav}>
        <Text style={styles.caption}>Operação</Text>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          return renderItem({
            key: route.key,
            label,
            icon: icons[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' },
            focused,
            role: 'tab',
            onPress: () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.dispatch({
                  ...CommonActions.navigate(route.name, route.params),
                  target: state.key,
                });
              }
            },
          });
        })}

        {isAdmin ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.caption}>Gestão</Text>
            {renderItem({
              key: 'admin-hub',
              label: 'Cadastros',
              icon: { on: 'grid', off: 'grid-outline' },
              focused: false,
              role: 'button',
              onPress: () => navigation.navigate('Perfil', { screen: 'AdminHub' }),
            })}
            {renderItem({
              key: 'admin-users',
              label: 'Administração',
              icon: { on: 'shield-checkmark', off: 'shield-checkmark-outline' },
              focused: false,
              role: 'button',
              onPress: () => navigation.navigate('Perfil', { screen: 'AdminUsers' }),
            })}
          </>
        ) : null}
      </View>

      <View style={styles.user}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={styles.userName} numberOfLines={1}>
            {profile?.full_name ?? '—'}
          </Text>
          <Text style={styles.userRole} numberOfLines={1}>
            {roleLabel[profile?.role ?? 'viewer']}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 14.5, fontWeight: '700', color: colors.white, letterSpacing: -0.2 },
  brandSub: { fontSize: 10.5, color: colors.onSidebarMuted, letterSpacing: 0.4, marginTop: 1 },

  cta: { marginBottom: spacing.xl },

  caption: {
    color: colors.onSidebarMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  nav: { flex: 1, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 11,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.sm,
  },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  itemActive: { backgroundColor: 'rgba(199,244,100,0.10)' },
  /** Faixa vertical à esquerda: marca o item ativo sem inverter as cores. */
  itemMarker: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  itemMarkerOn: { backgroundColor: colors.accent },
  itemText: { fontSize: 13.5, fontWeight: '500', color: colors.onSidebar, flex: 1 },
  itemTextActive: { color: colors.white, fontWeight: '700' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.lg,
    marginHorizontal: spacing.sm,
  },

  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  userName: { fontSize: 13, fontWeight: '600', color: colors.white },
  userRole: { fontSize: 11, color: colors.onSidebarMuted, marginTop: 1 },
});
