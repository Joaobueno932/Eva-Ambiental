import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { formatWeight } from '@/utils/format';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/**
 * Gráfico de distribuição em barras horizontais (didático e leve).
 */
export function BarChart({ data, max }: { data: BarItem[]; max?: number }) {
  const peak = max ?? Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <Text style={styles.empty}>Sem dados para exibir.</Text>;
  }

  return (
    <View>
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / peak) * 100);
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
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  label: { fontSize: 13, color: colors.text, flex: 1 },
  value: { fontSize: 13, fontWeight: '700', color: colors.greenDark },
  track: { height: 10, backgroundColor: colors.gray, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.full },
  empty: { color: colors.grayText, fontStyle: 'italic', paddingVertical: spacing.md },
});
