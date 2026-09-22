import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradient, gradients, radius, spacing, transition, typography } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Trilha de contexto acima do título, no site (ex.: "Pesagens"). */
  eyebrow?: string;
  /** Marca da seção à esquerda do título, no site. Não aparece com `onBack`. */
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Cabeçalho responsivo com contexto, retorno e ações da página.
 *
 * No site ele é a barra branca que separa a área de trabalho do menu lateral —
 * fundo próprio e sombra curta, para continuar legível quando a página rola
 * por baixo. No celular mantém o bloco verde da marca, agora em degradê.
 */
export function Header({ title, subtitle, onBack, right, eyebrow, icon }: Props) {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <View style={webStyles.header}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ hovered }: any) => [webStyles.back, transition(), hovered && webStyles.backHover]}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {/* Marca da seção — só quando não há retorno, para não competir com
            a seta de voltar no mesmo canto. */}
        {icon && !onBack ? (
          <View style={[webStyles.mark, gradient(gradients.brand, colors.brand[700])]}>
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
        ) : null}
        <View style={styles.flex}>
          {eyebrow ? <Text style={webStyles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
          <Text style={webStyles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={webStyles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={webStyles.actions}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.header,
        gradient(gradients.header, colors.green),
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
        ) : (
          <View style={[styles.leaf, gradient(gradients.accent, colors.accent)]}>
            <Ionicons name="leaf" size={19} color={colors.brand[800]} />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginRight: spacing.xs,
  },
  leaf: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: { color: colors.white, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(220,232,226,0.82)', fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});

const webStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl + 4,
    paddingVertical: spacing.lg + 4,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  backHover: { backgroundColor: colors.brand[50], borderColor: colors.brand[200] },
  eyebrow: {
    color: colors.textSoft,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, ...typography.h1, fontSize: 23 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
