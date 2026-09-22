import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { Weighing } from '@/types';
import { formatDateTime, formatWeight } from '@/utils/format';
import { Card } from './Card';
import { StatusBadge, Tag } from './StatusBadge';

interface Props {
  item: Weighing;
  onPress: () => void;
}

/**
 * Cartão de uma pesagem na listagem.
 *
 * Mesmo conteúdo nas duas plataformas; no site ele é mais compacto porque
 * aparece em grade de duas ou três colunas, e não um por linha.
 *
 * A massa é o dado que se procura primeiro numa lista de pesagens, então ela
 * ocupa a linha própria em corpo grande, e o resto (data, unidade, autor) desce
 * para um rodapé de apoio separado por uma divisória.
 */
export function WeighingCard({ item, onPress }: Props) {
  const isDesktop = useIsDesktop();
  const isCanceled = !!item.canceled_at;
  const s = isDesktop ? webStyles : styles;

  return (
    <Card onPress={onPress} style={isDesktop ? webStyles.card : undefined}>
      <View style={styles.headRow}>
        <Text style={s.waste} numberOfLines={1}>
          {item.waste_type?.name ?? 'Resíduo'}
        </Text>
        {isCanceled ? (
          <Tag label="Cancelada" color={colors.textMuted} bg={colors.surfaceSunken} dot />
        ) : (
          <StatusBadge status={item.approval_status} />
        )}
      </View>

      <Text style={[s.weight, isCanceled && styles.canceled]}>{formatWeight(item.weight_kg)}</Text>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.textSoft} />
          <Text style={s.metaText} numberOfLines={1}>
            {formatDateTime(item.weighing_date)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={13} color={colors.textSoft} />
          <Text style={s.metaText} numberOfLines={1}>
            {item.unit?.name ?? '-'}
            {item.client?.name ? ` • ${item.client.name}` : ''}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={colors.textSoft} />
          <Text style={s.metaText} numberOfLines={1}>
            {item.creator?.full_name ?? '-'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  meta: {
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  canceled: { textDecorationLine: 'line-through', color: colors.textSoft },
  waste: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: -0.2 },
  weight: { fontSize: 26, fontWeight: '700', color: colors.brand[700], marginTop: spacing.sm, letterSpacing: -0.8 },
  metaText: { color: colors.textMuted, fontSize: 12.5, flex: 1 },
});

const webStyles = StyleSheet.create({
  card: { flex: 1, padding: spacing.lg, marginBottom: 0, borderRadius: radius.md },
  waste: { fontSize: 14.5, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: -0.2 },
  weight: { fontSize: 24, fontWeight: '700', color: colors.brand[700], marginTop: 6, letterSpacing: -0.8 },
  metaText: { color: colors.textMuted, fontSize: 12, flex: 1 },
});
