import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, transition } from '@/theme';

/** Uma coluna: as três situações empilhadas num mesmo dia. */
export interface ColumnPoint {
  label: string;
  approved: number;
  pending: number;
  rejected: number;
}

/** Ordem de empilhamento, de baixo para cima. */
const SERIES = [
  { key: 'approved', label: 'Aprovadas', color: colors.statusChart.approved },
  { key: 'pending', label: 'Aguardando validação', color: colors.statusChart.pending },
  { key: 'rejected', label: 'Rejeitadas', color: colors.statusChart.rejected },
] as const;

const PLOT_HEIGHT = 190;

/**
 * Passo inteiro entre as marcas do eixo.
 *
 * Num gráfico de contagem só existem inteiros, então o passo também precisa
 * ser: 1, 2, 5, 10, 20… Um passo fracionário (0,6 para um topo de 3 em cinco
 * marcas) arredondava para rótulos repetidos — "2, 2, 1, 1" — e o eixo
 * deixava de dizer qual linha vale quanto.
 */
function niceStep(peak: number, ticks: number): number {
  const raw = Math.max(peak, 1) / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((st) => st >= raw) ?? magnitude * 10;
  return Math.max(1, Math.ceil(step));
}

/**
 * Evolução diária das pesagens, empilhada por situação.
 *
 * Colunas verticais e não barras horizontais como o `BarChart`: aqui o eixo X
 * é o tempo, e tempo se lê da esquerda para a direita. O empilhamento mostra
 * duas coisas na mesma coluna — quantas pesagens entraram no dia (a altura
 * total) e em que pé está a validação (a divisão interna).
 *
 * Só uma parte dos rótulos do eixo é impressa: num mês, trinta datas lado a
 * lado se sobrepõem e nenhuma fica legível.
 */
export function ColumnChart({ data, ticks = 5 }: { data: ColumnPoint[]; ticks?: number }) {
  const { max, step, totals, labelStride } = useMemo(() => {
    const peak = Math.max(0, ...data.map((d) => d.approved + d.pending + d.rejected));
    const tickStep = niceStep(peak, ticks);
    return {
      step: tickStep,
      max: tickStep * ticks,
      totals: {
        approved: data.reduce((sum, d) => sum + d.approved, 0),
        pending: data.reduce((sum, d) => sum + d.pending, 0),
        rejected: data.reduce((sum, d) => sum + d.rejected, 0),
      },
      // Mira ~10 rótulos, sempre incluindo o primeiro dia.
      labelStride: Math.max(1, Math.ceil(data.length / 10)),
    };
  }, [data, ticks]);

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.empty}>Sem pesagens no período selecionado.</Text>
      </View>
    );
  }

  // Múltiplos exatos do passo: cada linha tem um valor próprio.
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => step * (ticks - i));

  return (
    <View>
      <View style={styles.plotRow}>
        {/* Eixo Y: as marcas ficam fora da área de plotagem para que nenhuma
            coluna comece atrás de um número. */}
        <View style={styles.axis}>
          {gridLines.map((value) => (
            <Text key={value} style={styles.axisLabel}>
              {value}
            </Text>
          ))}
        </View>

        <View style={styles.plot}>
          <View style={styles.grid} pointerEvents="none">
            {gridLines.map((value, i) => (
              <View key={value} style={[styles.gridLine, i === gridLines.length - 1 && styles.gridLineBase]} />
            ))}
          </View>

          <View style={styles.columns}>
            {data.map((point, i) => {
              const total = point.approved + point.pending + point.rejected;
              return (
                <View key={point.label + i} style={styles.column}>
                  <View
                    style={styles.stack}
                    accessibilityRole="image"
                    accessibilityLabel={`${point.label}: ${total} pesagens — ${point.approved} aprovadas, ${point.pending} aguardando validação, ${point.rejected} rejeitadas`}
                  >
                    {[...SERIES].reverse().map((serie) => {
                      const value = point[serie.key];
                      if (value <= 0) return null;
                      // A menor coluna visível tem 2px: um dia com uma pesagem
                      // não pode desaparecer por arredondamento.
                      const height = Math.max(2, (value / max) * PLOT_HEIGHT);
                      const isTop = serie.key === topSerie(point);
                      return (
                        <View
                          key={serie.key}
                          style={[
                            styles.segment,
                            { height, backgroundColor: serie.color },
                            isTop && styles.segmentTop,
                            transition('height', 280),
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.labelsRow}>
        <View style={styles.axisSpacer} />
        {/* Os rótulos são posicionados sobre a faixa, não distribuídos numa
            linha flex: numa célula de ~23px o flex recorta "01/09" para
            "01…". Cada data é centrada no meio da sua coluna. */}
        <View style={styles.labels}>
          {data.map((point, i) =>
            i % labelStride === 0 ? (
              <Text
                key={point.label + i}
                style={[styles.label, { left: `${((i + 0.5) / data.length) * 100}%` }]}
              >
                {point.label}
              </Text>
            ) : null
          )}
        </View>
      </View>

      <View style={styles.legend}>
        {SERIES.map((serie) => (
          <View key={serie.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: serie.color }]} />
            <Text style={styles.legendText}>
              {serie.label} ({totals[serie.key]})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Qual série fecha a coluna — só ela recebe o canto arredondado. */
function topSerie(point: ColumnPoint): keyof Omit<ColumnPoint, 'label'> {
  if (point.rejected > 0) return 'rejected';
  if (point.pending > 0) return 'pending';
  return 'approved';
}

const styles = StyleSheet.create({
  plotRow: { flexDirection: 'row' },
  axis: {
    width: 26,
    height: PLOT_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
  },
  // O rótulo é centrado na própria linha de grade, meia altura acima.
  axisLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    lineHeight: 12,
    marginBottom: -6,
    marginTop: -6,
  },
  axisSpacer: { width: 26 },

  plot: { flex: 1, height: PLOT_HEIGHT },
  grid: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  gridLine: { height: 1, backgroundColor: colors.borderSoft },
  gridLineBase: { backgroundColor: colors.border },

  columns: { flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT, gap: 2 },
  column: { flex: 1, justifyContent: 'flex-end', minWidth: 3 },
  stack: { justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 2 },
  segment: { width: '100%' },
  segmentTop: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },

  labelsRow: { flexDirection: 'row', marginTop: spacing.sm },
  labels: { flex: 1, height: 14 },
  // `marginLeft` negativo de meia largura centra a data no `left` calculado,
  // sem depender de translate percentual (que o React Native não aceita).
  label: {
    position: 'absolute',
    top: 0,
    width: 40,
    marginLeft: -20,
    textAlign: 'center',
    color: colors.textSoft,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 12 },

  emptyBox: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  empty: { color: colors.textMuted, fontSize: 13 },
});
