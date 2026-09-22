import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, gradient, gradients, radius, spacing, transition } from '@/theme';
import { formatWeight } from '@/utils/format';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/**
 * Distribuição em barras horizontais.
 *
 * Além da massa, cada linha mostra a participação no total: sem ela, o
 * comprimento da barra só permite comparar com a maior, e a pergunta usual
 * ("quanto isso representa?") fica sem resposta. O trilho é rebaixado e as
 * barras recebem um degradê leve, para não virarem tiras de cor chapada.
 */
export function BarChart({ data, max }: { data: BarItem[]; max?: number }) {
  const peak = max ?? Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.empty}>Sem dados para exibir no período.</Text>
      </View>
    );
  }

  return (
    <View>
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / peak) * 100);
        const share = total > 0 ? (d.value / total) * 100 : 0;
        const color = d.color ?? colors.chart[i % colors.chart.length];
        return (
          <View key={d.label + i} style={styles.row}>
            <View style={styles.labelRow}>
              <View style={styles.legend}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.label} numberOfLines={1}>
                  {d.label}
                </Text>
              </View>
              <Text style={styles.value}>{formatWeight(d.value)}</Text>
              <Text style={styles.share}>{share.toFixed(0)}%</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: color },
                  gradient(gradients.bar(color), color),
                  transition('width', 280),
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  legend: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 2, marginRight: spacing.sm },
  label: { fontSize: 13, color: colors.text, flex: 1 },
  value: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  share: { fontSize: 11.5, fontWeight: '600', color: colors.textSoft, width: 34, textAlign: 'right' },
  track: { height: 8, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.full },
  emptyBox: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  empty: { color: colors.textMuted, fontSize: 13 },
});
