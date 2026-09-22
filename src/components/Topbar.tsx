import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, transition } from '@/theme';

export interface Crumb {
  label: string;
  onPress?: () => void;
  /** Ícone antes do rótulo — a casa no início da trilha, por exemplo. */
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Barra superior do site: onde estou, o que está pendente, quem sou.
 *
 * O menu lateral diz qual seção está aberta, mas não a que registro se chegou
 * depois de dois cliques — é a trilha que fecha essa lacuna. À direita ficam
 * as pendências e a identificação, que num sistema com aprovação precisam
 * estar visíveis em qualquer tela, não só no painel.
 *
 * Fica acima do título da página e é independente dele: o `Header` continua
 * respondendo pelo título, subtítulo e ações da página.
 */
export function Topbar({
  crumbs,
  userName,
  userRole,
  notificationCount = 0,
  onNotifications,
  onSignOut,
  onUser,
  plain,
}: {
  crumbs: Crumb[];
  userName?: string | null;
  userRole?: string;
  /** Pendências aguardando ação; zero esconde o marcador. */
  notificationCount?: number;
  onNotifications?: () => void;
  onSignOut?: () => void;
  /**
   * Abre a conta de quem está logado. Com o menu lateral levando
   * "Configurações" para a administração, é por aqui que se chega ao próprio
   * perfil — onde ficam o guia, o "sobre" e a saída da conta.
   */
  onUser?: () => void;
  /**
   * Sem faixa branca e sem linha: a barra se apoia no fundo da página. Usado
   * nos formulários, onde o cabeçalho logo abaixo também não tem faixa e os
   * dois se leem como um único topo.
   */
  plain?: boolean;
}) {
  const initials = (userName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <View style={[s.bar, plain && s.barPlain]}>
      <View style={s.crumbs}>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <View key={crumb.label + i} style={s.crumbItem}>
              {i > 0 ? <Ionicons name="chevron-forward" size={13} color={colors.textSoft} /> : null}
              {crumb.onPress && !last ? (
                <Pressable
                  onPress={crumb.onPress}
                  accessibilityRole="link"
                  style={({ hovered }: any) => [s.crumbPress, transition('color'), hovered && s.crumbHover]}
                >
                  {crumb.icon ? <Ionicons name={crumb.icon} size={13} color={colors.textMuted} /> : null}
                  <Text style={s.crumbLink}>{crumb.label}</Text>
                </Pressable>
              ) : (
                <Text style={last ? s.crumbCurrent : s.crumbLink} numberOfLines={1}>
                  {crumb.label}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.right}>
        {onNotifications ? (
          <Pressable
            onPress={onNotifications}
            accessibilityRole="button"
            accessibilityLabel={
              notificationCount > 0
                ? `${notificationCount} pesagens aguardando validação`
                : 'Nenhuma pendência'
            }
            style={({ hovered }: any) => [s.iconBtn, transition(), hovered && s.iconBtnHover]}
          >
            <Ionicons name="notifications-outline" size={19} color={colors.textMuted} />
            {notificationCount > 0 ? <View style={s.badge} /> : null}
          </Pressable>
        ) : null}

        <Pressable
          onPress={onUser}
          disabled={!onUser}
          accessibilityRole={onUser ? 'button' : undefined}
          accessibilityLabel={onUser ? 'Abrir minha conta' : undefined}
          style={({ hovered }: any) => [s.user, transition(), onUser && hovered && s.userHover]}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.userText}>
            <Text style={s.userName} numberOfLines={1}>
              {userName ?? '—'}
            </Text>
            {userRole ? (
              <Text style={s.userRole} numberOfLines={1}>
                {userRole}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {onSignOut ? (
          <>
            <View style={s.divider} />
            <Pressable
              onPress={onSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sair"
              style={({ hovered }: any) => [s.signOut, transition(), hovered && s.signOutHover]}
            >
              <Ionicons name="log-out-outline" size={17} color={colors.textMuted} />
              <Text style={s.signOutText}>Sair</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl + 4,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  barPlain: { backgroundColor: 'transparent', borderBottomWidth: 0 },
  crumbs: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  crumbItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  crumbPress: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  crumbLink: { color: colors.textMuted, fontSize: 12.5, paddingHorizontal: 2 },
  crumbHover: { opacity: 0.7 },
  crumbCurrent: { color: colors.text, fontSize: 12.5, fontWeight: '600', paddingHorizontal: 2 },

  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconBtnHover: { backgroundColor: colors.surfaceSunken },
  // Ponto em vez de contagem: o número exato já está no cartão "Aguardando
  // validação", aqui basta saber que há algo esperando.
  badge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },

  // O padding cresce a área clicável e a margem negativa o devolve: o alvo
  // fica maior sem deslocar nada em volta.
  user: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: -6, marginVertical: -4,
    borderRadius: radius.sm,
  },
  userHover: { backgroundColor: colors.surfaceSunken },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
  userText: { maxWidth: 150 },
  userName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  userRole: { color: colors.textSoft, fontSize: 11.5, marginTop: 1 },

  divider: { width: 1, height: 26, backgroundColor: colors.border },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  signOutHover: { backgroundColor: colors.surfaceSunken },
  signOutText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
