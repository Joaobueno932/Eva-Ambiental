import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, gradient, gradients, radius, spacing, transition, typography } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

/**
 * Título de seção.
 *
 * O número virou uma marca com o verde da marca; antes era um quadrado cinza
 * que se lia como caixa de texto vazia. O `right` recebe as ações da seção,
 * que assim ficam na mesma linha do título em vez de flutuarem acima.
 */
export function SectionHeading({ number, title, description, right }: {
  number?: string; title: string; description?: string; right?: React.ReactNode;
}) {
  return <View style={s.heading}>
    {number ? <View style={[s.numberChip, gradient(gradients.brand, colors.brand[700])]}>
      <Text style={s.numberText}>{number}</Text>
    </View> : null}
    <View style={s.grow}>
      <Text accessibilityRole="header" style={s.title}>{title}</Text>
      {description ? <Text style={s.muted}>{description}</Text> : null}
    </View>
    {right}
  </View>;
}

export interface MetricItem {
  label: string;
  value: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Cor do valor e do ícone. Por padrão, o verde da marca. */
  tone?: string;
}

/**
 * Faixa de indicadores.
 *
 * Eram quatro células separadas por linhas dentro de uma caixa única — o
 * resultado parecia uma tabela sem cabeçalho. Agora cada indicador é um cartão
 * com hierarquia própria: rótulo pequeno em caixa alta, número grande, nota de
 * escopo embaixo e um ícone que dá reconhecimento imediato.
 */
export function MetricStrip({ items }: { items: MetricItem[] }) {
  const isDesktop = useIsDesktop();
  return <View style={s.metrics}>{items.map(item => {
    const tone = item.tone ?? colors.brand[700];
    return <View
      key={item.label}
      style={[
        s.metric,
        isDesktop ? s.metricDesktop : s.metricMobile,
        gradient(gradients.metric, colors.surface),
        elevation('sm'),
        transition(),
      ]}
    >
      <View style={s.metricTop}>
        <Text style={s.label} numberOfLines={2}>{item.label}</Text>
        {item.icon ? <View style={[s.metricIcon, { backgroundColor: tone + '14' }]}>
          <Ionicons name={item.icon} size={15} color={tone} />
        </View> : null}
      </View>
      <Text style={[s.value, { color: tone }, isDesktop ? null : s.valueMobile]} numberOfLines={1}>
        {item.value}
      </Text>
      {item.hint ? <Text style={s.metricHint}>{item.hint}</Text> : null}
    </View>;
  })}</View>;
}

/**
 * Passos do cadastro.
 *
 * Um trilho contínuo liga os passos e mostra o quanto já foi vencido — a fila
 * de pílulas anterior dizia onde se está, mas não quanto falta.
 */
export function Stepper({ steps, current, onChange }: { steps: string[]; current: number; onChange: (step: number) => void }) {
  return <View style={s.steps}>{steps.map((label, i) => {
    const done = i < current;
    const active = i === current;
    return <React.Fragment key={label}>
      {i > 0 ? <View style={[s.connector, (done || active) ? s.connectorDone : null]} /> : null}
      <Pressable
        onPress={() => onChange(i)}
        accessibilityRole="button"
        accessibilityLabel={'Etapa ' + (i + 1) + ': ' + label}
        accessibilityState={{ selected: active }}
        style={({ hovered }: any) => [s.step, transition(), hovered && !active && s.stepHover, active && s.stepActive]}
      >
        <View style={[s.stepMark, done && s.stepMarkDone, active && s.stepMarkActive]}>
          {done
            ? <Ionicons name="checkmark" size={13} color={colors.white} />
            : <Text style={[s.stepNum, active && s.stepNumActive]}>{i + 1}</Text>}
        </View>
        <Text style={[s.stepText, (active || done) && s.stepTextOn]} numberOfLines={1}>{label}</Text>
      </Pressable>
    </React.Fragment>;
  })}</View>;
}

export function SummaryLine({ label, value }: { label: string; value?: string | null }) {
  return <View style={s.summary}>
    <Text style={s.summaryLabel}>{label}</Text>
    <Text style={[s.summaryValue, !value && s.summaryEmpty]}>{value || 'Não informado'}</Text>
  </View>;
}

/** Linha do tempo de eventos do registro. */
export function Timeline({ events }: { events: { label: string; date: string; detail?: string | null }[] }) {
  return <View>{events.map((event, index) => <View key={event.label + '-' + event.date} style={s.event}>
    <View style={s.rail}>
      <View style={[s.dot, index === 0 && s.dotFirst]} />
      {index < events.length - 1 ? <View style={s.line} /> : null}
    </View>
    <View style={s.eventBody}>
      <Text style={s.eventTitle}>{event.label}</Text>
      <Text style={s.muted}>{event.date}</Text>
      {event.detail ? <Text style={s.eventDetail}>{event.detail}</Text> : null}
    </View>
  </View>)}</View>;
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  heading: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, alignItems: 'center' },
  numberChip: {
    width: 30, height: 30, borderRadius: radius.sm,
    backgroundColor: colors.brand[700], alignItems: 'center', justifyContent: 'center',
  },
  numberText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, ...typography.h3 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },

  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  metric: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.surface, justifyContent: 'space-between',
  },
  metricDesktop: { flexGrow: 1, flexBasis: '22%', minWidth: 196, padding: spacing.lg + 2 },
  metricMobile: { flexGrow: 1, flexBasis: '44%', minWidth: 148, padding: spacing.md + 2 },
  metricTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metricIcon: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  label: {
    flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 15,
  },
  value: { ...typography.metric, color: colors.brand[700], marginTop: spacing.sm },
  valueMobile: { fontSize: 24, letterSpacing: -0.6 },
  metricHint: { color: colors.textSoft, fontSize: 11.5, marginTop: 4, lineHeight: 16 },

  steps: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.xl },
  connector: { width: 14, height: 2, backgroundColor: colors.border, borderRadius: 1 },
  connectorDone: { backgroundColor: colors.brand[300] },
  step: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: 12, minHeight: 40, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
  },
  stepHover: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
  stepActive: { backgroundColor: colors.brand[50], borderColor: colors.brand[400] },
  stepMark: {
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  stepMarkDone: { backgroundColor: colors.brand[400] },
  stepMarkActive: { backgroundColor: colors.brand[700] },
  stepNum: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepNumActive: { color: colors.white },
  stepText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  stepTextOn: { color: colors.brand[700] },

  summary: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, gap: 3 },
  summaryLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  summaryEmpty: { color: colors.textSoft, fontWeight: '400', fontStyle: 'italic' },

  event: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 14 },
  dot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand[300], marginTop: 5,
    borderWidth: 2, borderColor: colors.surface,
  },
  dotFirst: { backgroundColor: colors.brand[700] },
  line: { flex: 1, width: 2, backgroundColor: colors.borderSoft, marginTop: 2, borderRadius: 1 },
  eventBody: { flex: 1, paddingBottom: spacing.lg },
  eventTitle: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  eventDetail: { color: colors.text, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
});
