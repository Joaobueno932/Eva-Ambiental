import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, spacing, typography } from '@/theme';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const SIZE = 148;
const STROKE = 20;
/** Raio da linha central do traço — é sobre ela que o arco é medido. */
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Anel de composição com o total no centro.
 *
 * O anel responde "como se divide" e o número central responde "de quanto
 * estamos falando" — sem o total no meio, uma fatia de 100% e uma de 100% em
 * bases diferentes se desenham idênticas.
 *
 * A legenda traz contagem e participação lado a lado: a cor localiza a fatia
 * no anel, mas é o número que permite conferir o dado.
 */
export function DonutChart({
  slices,
  total,
  centerLabel,
}: {
  slices: DonutSlice[];
  /** Total exibido no centro. Por padrão, a soma das fatias. */
  total?: number;
  centerLabel: string;
}) {
  const sum = total ?? slices.reduce((acc, s) => acc + s.value, 0);

  // Cada arco começa onde o anterior terminou; o deslocamento acumula.
  const arcs = useMemo(() => {
    let offset = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((slice) => {
        const share = sum > 0 ? slice.value / sum : 0;
        const arc = { ...slice, share, offset };
        offset += share;
        return arc;
      });
  }, [slices, sum]);

  return (
    <View style={styles.wrap}>
      <View style={styles.ringBox}>
        <Svg width={SIZE} height={SIZE}>
          {/* Começa no topo: um anel que arranca às 3 horas se lê torto.
              A rotação vai no atributo `transform` do SVG — as props
              `rotation`/`originX` viram `transform-origin` no DOM e o React
              rejeita a propriedade. */}
          <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.surfaceSunken}
              strokeWidth={STROKE}
              fill="none"
            />
            {arcs.map((arc) => (
              <Circle
                key={arc.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={arc.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${arc.share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arc.offset * CIRCUMFERENCE}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerValue}>{sum}</Text>
          <Text style={styles.centerCaption}>{centerLabel}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.rowValue}>{slice.value}</Text>
            <Text style={styles.rowShare}>{sum > 0 ? Math.round((slice.value / sum) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xl },
  ringBox: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerValue: { ...typography.h1, fontSize: 30, color: colors.text },
  centerCaption: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  legend: { flex: 1, minWidth: 168, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  rowLabel: { flex: 1, color: colors.text, fontSize: 12.5, minWidth: 0 },
  rowValue: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 26,
    textAlign: 'right',
  },
  rowShare: {
    color: colors.textSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'right',
  },
});
