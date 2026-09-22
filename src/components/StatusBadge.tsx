import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { ApprovalStatus } from '@/types';
import { approvalBadgeLabel } from '@/utils/format';

/**
 * Cada situação tem fundo, traço e ponto próprios.
 *
 * Só o fundo colorido não basta: em telas com muitos registros as pílulas
 * viram manchas. O ponto dá o sinal mesmo quando a cor é fraca, e o traço
 * separa a pílula da linha da tabela.
 */
const map: Record<ApprovalStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: colors.warningBg, text: colors.warning, border: colors.warningBorder },
  approved: { bg: colors.successBg, text: colors.success, border: colors.successBorder },
  rejected: { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder },
};

export function StatusBadge({ status, large, small }: {
  status: ApprovalStatus;
  large?: boolean;
  /** Pílula das prévias em meia largura, onde "Aguardando validação" precisa caber inteira. */
  small?: boolean;
}) {
  const c = map[status] ?? map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, large && styles.large, small && styles.small]}>
      <View style={[styles.dot, { backgroundColor: c.text }, large && styles.dotLarge, small && styles.dotSmall]} />
      <Text style={[styles.text, { color: c.text }, large && styles.textLarge, small && styles.textSmall]} numberOfLines={1}>{approvalBadgeLabel[status]}</Text>
    </View>
  );
}

/** Badge genérico para texto livre (ex.: classificação de desempenho). */
export function Tag({
  label,
  color = colors.brand[700],
  bg = colors.greenBg,
  border,
  dot,
}: {
  label: string;
  color?: string;
  bg?: string;
  border?: string;
  /** Mostra o ponto colorido à esquerda; por padrão a etiqueta é só texto. */
  dot?: boolean;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border ?? colors.borderSoft }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  large: { paddingHorizontal: 13, paddingVertical: 6, gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotLarge: { width: 7, height: 7, borderRadius: 3.5 },
  text: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
  textLarge: { fontSize: 13.5 },
  small: { paddingHorizontal: 7, paddingVertical: 3, gap: 5 },
  dotSmall: { width: 5, height: 5, borderRadius: 2.5 },
  textSmall: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0 },
});
