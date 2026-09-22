import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, gradient, gradients, radius, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
}

/**
 * Botão do sistema.
 *
 * No celular ele é alto (52px) e largo, porque o alvo é o dedo. No site o alvo
 * é o ponteiro: a mesma altura faria cada barra de ações parecer um formulário
 * de aplicativo, então lá o botão é mais compacto e reage ao mouse.
 *
 * A ação principal passou a ser o verde da marca em degradê, e não o lima
 * chapado: preenchimentos grandes em cor saturada puxam a interface para o
 * lado promocional. O lima ficou como acento — seleção, realce e a variante
 * `secondary`, onde aparece em áreas pequenas.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading;
  const isDesktop = useIsDesktop();
  const palette = getPalette(variant);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed, hovered }: any) => [
        isDesktop ? webStyles.base : styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        palette.fill && !isDisabled && gradient(palette.fill, palette.bg),
        palette.raised && !isDisabled && elevation('sm'),
        transition(),
        fullWidth && { alignSelf: 'stretch' },
        isDesktop && hovered && !isDisabled && [
          { backgroundColor: palette.hover, borderColor: palette.hoverBorder },
          palette.fillHover && gradient(palette.fillHover, palette.hover),
          palette.raised && elevation('md'),
        ],
        pressed && !isDisabled && { opacity: 0.9 },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon}
              size={isDesktop ? 16 : 20}
              color={palette.text}
              style={{ marginRight: isDesktop ? spacing.xs + 2 : spacing.sm }}
            />
          )}
          <Text style={[isDesktop ? webStyles.text : styles.text, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface Palette {
  bg: string;
  border: string;
  text: string;
  hover: string;
  hoverBorder: string;
  /** Degradê aplicado só na Web; no Android vale `bg`. */
  fill?: string;
  fillHover?: string;
  /** Ações sólidas ganham sombra; contornadas e fantasmas, não. */
  raised?: boolean;
}

function getPalette(v: Variant): Palette {
  switch (v) {
    case 'secondary':
      return {
        bg: colors.accent,
        border: colors.accentDeep,
        text: colors.onAccent,
        hover: colors.accentDeep,
        hoverBorder: colors.accentDeep,
        fill: gradients.accent,
        raised: true,
      };
    case 'outline':
      return {
        bg: colors.surface,
        border: colors.borderStrong,
        text: colors.brand[700],
        hover: colors.greenBg,
        hoverBorder: colors.brand[300],
      };
    case 'danger':
      return {
        bg: colors.danger,
        border: colors.danger,
        text: colors.white,
        hover: '#9B1F18',
        hoverBorder: '#9B1F18',
        fill: `linear-gradient(180deg, #C4332A 0%, ${colors.danger} 100%)`,
        fillHover: `linear-gradient(180deg, ${colors.danger} 0%, #9B1F18 100%)`,
        raised: true,
      };
    case 'ghost':
      return {
        bg: 'transparent',
        border: 'transparent',
        text: colors.brand[700],
        hover: colors.greenBg,
        hoverBorder: 'transparent',
      };
    default:
      return {
        bg: colors.brand[700],
        border: colors.brand[800],
        text: colors.white,
        hover: colors.brand[600],
        hoverBorder: colors.brand[700],
        fill: gradients.brand,
        fillHover: gradients.brandHover,
        raised: true,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  disabled: { opacity: 0.45 },
});

const webStyles = StyleSheet.create({
  base: {
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { fontSize: 13.5, fontWeight: '600', letterSpacing: 0.1 },
});
