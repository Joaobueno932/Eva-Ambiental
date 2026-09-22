import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, elevation, gradient, gradients, radius, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Superfície rebaixada: para blocos dentro de um cartão (filtros, resumos). */
  sunken?: boolean;
  /** Faixa de acento no topo — usada para destacar um cartão entre os demais. */
  accent?: boolean;
  padded?: boolean;
}

/**
 * Superfície do sistema.
 *
 * O cartão não é mais um retângulo branco com uma linha em volta: tem um
 * degradê quase imperceptível, uma sombra em duas camadas que o apoia sobre o
 * fundo e um realce interno no topo. É o que diferencia uma pilha de cartões
 * de uma pilha de caixas.
 */
export function Card({ children, onPress, style, sunken, accent, padded = true }: Props) {
  const isDesktop = useIsDesktop();
  const base = [
    styles.card,
    padded && (isDesktop ? styles.padDesktop : styles.padMobile),
    sunken && styles.sunken,
    !sunken && gradient(gradients.surface, colors.surface),
    !sunken && elevation('sm'),
    transition(),
  ];

  const content = accent ? (
    <>
      <View style={[styles.accentBar, gradient(gradients.accent, colors.accent)]} />
      {children}
    </>
  ) : (
    children
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed, hovered }: any) => [
          ...base,
          accent && styles.accentClip,
          style,
          isDesktop && hovered && [styles.hover, elevation('md')],
          pressed && (isDesktop ? styles.pressed : { opacity: 0.92 }),
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[...base, accent && styles.accentClip, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padMobile: { padding: spacing.lg },
  padDesktop: { padding: spacing.xl - 4 },
  sunken: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
  },
  accentClip: { overflow: 'hidden', paddingTop: spacing.xl - 1 },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.accent },
  hover: { borderColor: colors.greenLine },
  pressed: { borderColor: colors.brand[400] },
});
