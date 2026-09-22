import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, gradient, gradients, radius, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

type Variant = 'primary' | 'secondary' | 'cta' | 'deep' | 'outline' | 'dangerOutline' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
  /**
   * `lg`: botão alto (58px) em qualquer tela — a ação que conclui uma etapa
   * de formulário, onde o botão é o destino do olhar e não um item de barra.
   */
  size?: 'md' | 'lg';
  /** Ícone de traço (ex.: Lucide) no lugar do glifo do Ionicons. */
  iconComponent?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Ícone depois do texto — setas que indicam para onde o botão leva. */
  iconRight?: boolean;
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
  size = 'md',
  iconComponent: IconComponent,
  iconRight,
}: Props) {
  const large = size === 'lg';
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
        large && lgStyles.base,
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
        <View style={[styles.content, iconRight && { flexDirection: 'row-reverse' }]}>
          {IconComponent && (
            <View style={iconRight ? { marginLeft: large ? 12 : spacing.sm } : { marginRight: large ? 12 : spacing.sm }}>
              <IconComponent size={large ? 22 : 18} strokeWidth={2.25} color={palette.text} />
            </View>
          )}
          {icon && !IconComponent && (
            <Ionicons
              name={icon}
              size={isDesktop ? 16 : 20}
              color={palette.text}
              style={{ marginRight: isDesktop ? spacing.xs + 2 : spacing.sm }}
            />
          )}
          <Text style={[isDesktop ? webStyles.text : styles.text, large && lgStyles.text, { color: palette.text }]}>{title}</Text>
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
    // Chamada para ação: verde claro com texto quase preto. O contraste vem do
    // texto escuro sobre fundo claro, e não de branco sobre verde médio — que
    // nesta faixa de luminosidade não alcançaria a relação mínima.
    // Ação principal de formulário: o verde fechado do desenho, chapado.
    case 'deep':
      return {
        bg: colors.form.action,
        border: colors.form.action,
        text: colors.white,
        hover: colors.form.actionHover,
        hoverBorder: colors.form.actionHover,
        raised: true,
      };
    case 'cta':
      return {
        bg: colors.cta,
        border: colors.ctaDeep,
        text: colors.onCta,
        hover: colors.ctaDeep,
        hoverBorder: colors.ctaDeep,
        fill: `linear-gradient(180deg, ${colors.cta} 0%, ${colors.ctaDeep} 100%)`,
        raised: true,
      };
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
    // Destrutiva, mas secundária: o contorno vermelho avisa sem disputar o
    // peso visual com a ação que conclui a tarefa.
    case 'dangerOutline':
      return {
        bg: colors.surface,
        border: colors.dangerBorder,
        text: colors.danger,
        hover: colors.dangerBg,
        hoverBorder: colors.danger,
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

const lgStyles = StyleSheet.create({
  base: { minHeight: 58, borderRadius: 10, paddingHorizontal: spacing.xl },
  text: { fontSize: 18, fontWeight: '700', letterSpacing: 0 },
});
