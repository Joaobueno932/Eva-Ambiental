import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Check from 'lucide-react-native/icons/check';
import Info from 'lucide-react-native/icons/info';
import { colors, elevation, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import type { MenuIconProps } from './MenuIcons';

/**
 * Peças dos formulários de registro, medidas no desenho da Nova pesagem.
 *
 * Ficam juntas porque só fazem sentido juntas: o stepper, o cabeçalho de
 * seção, os avisos e o resumo lateral compartilham os mesmos selos, cinzas e
 * raios, e espalhá-los em arquivos separados convidaria cada um a derivar.
 */

type IconComponent = React.ComponentType<MenuIconProps>;

// ─── Selos ilustrados ──────────────────────────────────────────────────────
// Não são ícones de traço: são pequenas ilustrações em dois tons, como no
// desenho. Ficam dentro dos selos claros e marcam a identidade da tela.

/**
 * Folha do título da página: corpo em degradê claro, ponta em verde fechado
 * separada por um vinco branco, nervura central e talo. É o selo mais visível
 * da tela, e por isso a única ilustração com degradê.
 */
export function LeafSeal({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="leafBody" x1="4" y1="10" x2="22" y2="28" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#8FD45E" />
          <Stop offset="1" stopColor="#3B9A3F" />
        </LinearGradient>
      </Defs>
      <Path d="M28 4C16 4 5 9.5 5 20.5c0 2.4.6 4.3 1.6 5.8C9.5 27.8 12.4 28.6 15.5 28.6 25 28.6 29 18 28 4Z" fill="url(#leafBody)" />
      <Path d="M28 4c-5.6 0-10.6 1.2-14.3 3.4l6.1 7.1L28 4Z" fill="#1E6B3A" />
      <Path d="M28 4c.4 4.6-.3 8.8-1.8 12.2l-6.4-1.7L28 4Z" fill="#2F8A45" />
      <Path d="M5.5 27.5C10 20 16 13.5 26 6" stroke="#EAF7DF" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <Path d="M13.7 7.4l6.1 7.1 6.4 1.7" stroke="#EAF7DF" strokeWidth={1} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Ficha com canto dobrado e uma folha: o selo do resumo. */
export function RecordSeal({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Path d="M6 2h10l6 6v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" fill="#1E6B41" />
      <Path d="M16 2v4a2 2 0 0 0 2 2h4Z" fill="#8FCF52" />
      <Path d="M16.5 11.5c-4.2 0-6.5 2.2-6.5 5.2 0 .9.2 1.6.5 2.2 1.2-2.6 3-4.2 5.3-5.1-1.9 1.4-3.3 3-4 5.3.6.3 1.3.4 2 .4 2.6 0 3.1-4 2.7-8Z" fill="#FFFFFF" />
    </Svg>
  );
}

/** Escudo em quadrantes: o selo da garantia de salvamento. */
export function ShieldSeal({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Path d="M13 1.5 3.5 5v7c0 6 4 10.4 9.5 12.5C18.5 22.4 22.5 18 22.5 12V5Z" fill="#23913F" />
      <Path d="M13 4.2 6 6.8V12c0 1.2.2 2.3.5 3.3H13Z" fill="#FFFFFF" />
      <Path d="M13 15.3h6.5c-1 3.3-3.4 5.8-6.5 7.2Z" fill="#FFFFFF" />
      <Path d="M13 4.2v11.1h6.5c.3-1 .5-2.1.5-3.3V6.8Z" fill="#8FD05A" />
    </Svg>
  );
}

// ─── Cabeçalho da página ───────────────────────────────────────────────────

/**
 * Título da página sem faixa: selo claro, título grande e o que se faz aqui.
 *
 * No formulário o topo é leve de propósito — o cartão de etapas logo abaixo
 * já tem borda e sombra, e uma faixa branca por cima faria dois blocos
 * brigarem pelo mesmo papel de "início da página".
 */
export function PageHeader({ title, subtitle, seal, right, titleSize }: {
  title: string;
  subtitle?: string;
  seal?: React.ReactNode;
  right?: React.ReactNode;
  /** Tamanho do título. O formulário usa 37px; telas de consulta, um pouco menos. */
  titleSize?: number;
}) {
  return (
    <View style={s.pageHeader}>
      {seal ? <View style={s.pageSeal}>{seal}</View> : null}
      <View style={s.grow}>
        <Text accessibilityRole="header" style={[s.pageTitle, titleSize ? { fontSize: titleSize } : null]}>{title}</Text>
        {subtitle ? <Text style={s.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={s.pageRight}>{right}</View> : null}
    </View>
  );
}

// ─── Stepper ───────────────────────────────────────────────────────────────

export interface FormStep {
  title: string;
  description: string;
  /**
   * Largura relativa da coluna. No desenho as colunas acompanham o tamanho do
   * rótulo — "Pesagem e tratamento" ocupa mais que "Revisão" —, e com colunas
   * iguais as linhas de ligação ficariam desiguais sob textos desiguais.
   */
  weight?: number;
}

/**
 * Etapas do registro: círculo numerado, linha até a próxima e a legenda.
 *
 * A linha que sai da etapa atual já vem preenchida até perto da próxima: é o
 * "você está indo para lá", que o desenho mostra e que distingue a etapa
 * atual de uma concluída — nesta, a linha vai até o fim.
 */
export function FormStepper({ steps, current, onChange }: {
  steps: FormStep[];
  current: number;
  onChange?: (step: number) => void;
}) {
  // No celular só cabem os círculos: o nome da etapa atual já está no
  // cabeçalho ("Etapa 1 de 5 • Origem"), e cinco rótulos em 400px viram
  // cinco reticências.
  const compact = !useIsDesktop();
  return (
    <View style={[s.card, s.stepperCard, compact && s.stepperCompact, elevation('sm')]}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const progress = done ? 1 : active ? 0.73 : 0;
        return (
          <Pressable
            key={step.title}
            onPress={onChange ? () => onChange(i) : undefined}
            disabled={!onChange}
            accessibilityRole="button"
            accessibilityLabel={`Etapa ${i + 1}: ${step.title}`}
            accessibilityState={{ selected: active }}
            style={({ hovered }: any) => [s.step, { flex: compact ? 1 : step.weight ?? 1 }, transition('opacity'), hovered && !active && s.stepHover]}
          >
            <View style={[s.stepTrack, compact && s.stepTrackCompact]}>
              {active ? (
                <View style={s.circleRing}>
                  <View style={s.circleActive}>
                    <Text style={s.circleActiveText}>{i + 1}</Text>
                  </View>
                </View>
              ) : done ? (
                <View style={[s.circleIdle, s.circleDone]}>
                  <Check size={15} strokeWidth={3} color={colors.white} />
                </View>
              ) : (
                <View style={s.circleIdle}>
                  <Text style={s.circleIdleText}>{i + 1}</Text>
                </View>
              )}
              <View style={s.line}>
                {progress > 0 ? <View style={[s.lineDone, { width: `${progress * 100}%` }]} /> : null}
              </View>
            </View>
            {compact ? null : (
              <>
                <Text style={s.stepTitle} numberOfLines={1}>{step.title}</Text>
                <Text style={s.stepDescription} numberOfLines={1}>{step.description}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Seção ─────────────────────────────────────────────────────────────────

/** Cartão de seção do formulário. */
export function FormCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, s.formCard, elevation('sm'), style]}>{children}</View>;
}

/** Selo claro com ícone de traço, título e o que a seção pede. */
export function SectionHead({ icon: Icon, title, description }: {
  icon: IconComponent;
  title: string;
  description?: string;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={s.sectionSeal}>
        <Icon size={30} strokeWidth={1.9} color={colors.form.tileIcon} />
      </View>
      <View style={s.grow}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
        {description ? <Text style={s.sectionDescription}>{description}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Cabeçalho compacto de cartão: selo neutro, título e o que o cartão mostra.
 *
 * Mais baixo que o `SectionHead` do formulário: numa tela de consulta há
 * vários cartões lado a lado, e selos de 64px em cada um fariam os
 * cabeçalhos pesarem mais que os dados. O selo é cinza, não verde — o verde
 * fica para o título da página.
 */
export function CardHead({ icon: Icon, title, description, right, tone = 'neutral' }: {
  icon: IconComponent;
  title: string;
  description?: string;
  right?: React.ReactNode;
  /** `green`: seções que abrem um assunto da marca; `neutral`: blocos de dados. */
  tone?: 'neutral' | 'green';
}) {
  return (
    <View style={s.cardHead}>
      <View style={[s.cardSeal, tone === 'green' && s.cardSealGreen]}>
        <Icon size={22} strokeWidth={2} color={colors.form.tileIcon} />
      </View>
      <View style={s.grow}>
        <Text accessibilityRole="header" style={s.cardTitle}>{title}</Text>
        {description ? <Text style={s.cardDescription}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ─── Avisos ────────────────────────────────────────────────────────────────

/**
 * Aviso dentro do formulário.
 *
 * `info` explica para que servem os dados da etapa; `safe` tranquiliza sobre
 * o que acontece com eles. São tons diferentes porque respondem a perguntas
 * diferentes: "por que me pedem isto?" e "e se eu sair no meio?".
 */
export function Notice({ tone = 'info', children, style }: {
  tone?: 'info' | 'safe';
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const safe = tone === 'safe';
  return (
    <View style={[s.notice, safe ? s.noticeSafe : s.noticeInfo, style]}>
      {safe ? <ShieldSeal size={26} /> : <Info size={22} strokeWidth={2} color={colors.form.tileIcon} />}
      <Text style={[s.noticeText, safe && s.noticeTextSafe]}>{children}</Text>
    </View>
  );
}

// ─── Resumo ────────────────────────────────────────────────────────────────

/** Cartão lateral que acompanha o preenchimento. */
export function SummaryCard({ title, description, children, style }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.card, s.summaryCard, elevation('sm'), style]}>
      <View style={s.summaryHead}>
        <View style={s.summarySeal}><RecordSeal size={26} /></View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={s.summaryTitle}>{title}</Text>
          {description ? <Text style={s.summaryDescription}>{description}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/**
 * Uma linha do resumo.
 *
 * Vazio vira "Não informado" em itálico e cinza: a linha continua visível, e
 * é essa lacuna à vista que diz o que ainda falta preencher.
 */
export function SummaryRow({ icon: Icon, label, value, emphasis, last }: {
  icon: IconComponent;
  label: string;
  value?: string | null;
  /** Valor em destaque (data e hora), com o rótulo como legenda. */
  emphasis?: boolean;
  last?: boolean;
}) {
  const empty = !value;
  return (
    <View style={[s.summaryRow, !last && s.summaryRowDivider, emphasis && s.summaryRowEmphasis]}>
      <View style={s.rowSeal}>
        <Icon size={24} strokeWidth={1.8} color={colors.form.tileIcon} />
      </View>
      <View style={s.grow}>
        <Text style={emphasis ? s.rowCaption : s.rowLabel}>{label}</Text>
        <Text
          style={[emphasis ? s.rowEmphasis : s.rowValue, empty && s.rowEmpty]}
          numberOfLines={2}
        >
          {value || 'Não informado'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F1',
  },

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 22 },
  pageSeal: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.form.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: { fontSize: 37, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  pageSubtitle: { fontSize: 18, color: colors.form.muted, marginTop: 2 },
  pageRight: { alignSelf: 'flex-start', paddingTop: 6 },

  stepperCard: {
    flexDirection: 'row',
    paddingLeft: 47,
    paddingRight: 40,
    paddingTop: 21,
    paddingBottom: 23,
    marginBottom: 13,
  },
  stepperCompact: { paddingHorizontal: 18, paddingVertical: 16 },
  step: { minWidth: 0 },
  stepTrackCompact: { marginBottom: 0 },
  stepHover: { opacity: 0.8 },
  stepTrack: { flexDirection: 'row', alignItems: 'center', height: 32, marginBottom: 12 },
  circleRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.form.stepRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.form.stepActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActiveText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  circleIdle: {
    width: 30,
    height: 30,
    marginHorizontal: 1,
    borderRadius: 15,
    backgroundColor: colors.form.stepIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.form.stepActive },
  circleIdleText: { color: colors.form.stepIdleText, fontSize: 14, fontWeight: '600' },
  line: {
    flex: 1,
    height: 2,
    marginLeft: 9,
    marginRight: 7,
    borderRadius: 1,
    backgroundColor: colors.form.stepLine,
    overflow: 'hidden',
  },
  lineDone: { height: 2, backgroundColor: colors.form.stepLineDone },
  stepTitle: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  stepDescription: { fontSize: 13, color: colors.form.soft, marginTop: 4 },

  formCard: { paddingHorizontal: 25, paddingTop: 25, paddingBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 23, marginBottom: 22 },
  sectionSeal: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.form.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  sectionDescription: { fontSize: 16, color: colors.form.muted, marginTop: 4 },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  cardSeal: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSealGreen: { backgroundColor: '#E0F0E4' },
  cardTitle: { fontSize: 19.5, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  cardDescription: { fontSize: 14, color: colors.form.muted, marginTop: 3 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderWidth: 1,
    borderRadius: 10,
  },
  noticeInfo: {
    backgroundColor: colors.form.infoBg,
    borderColor: colors.form.infoBorder,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  noticeSafe: {
    backgroundColor: colors.form.safeBg,
    borderColor: colors.form.safeBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 16,
  },
  noticeText: { flex: 1, fontSize: 14.5, lineHeight: 21, color: colors.form.infoText },
  noticeTextSafe: { color: colors.form.safeText, lineHeight: 22 },

  summaryCard: { padding: 22 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24 },
  summarySeal: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.form.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontSize: 21, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  summaryDescription: { fontSize: 15, color: colors.form.muted, marginTop: 3 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 14 },
  summaryRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.form.divider },
  summaryRowEmphasis: { paddingTop: 36 },
  rowSeal: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.form.rowTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 15.5, fontWeight: '500', color: colors.form.label },
  rowValue: { fontSize: 15.5, color: colors.form.label, marginTop: 3 },
  rowEmpty: { fontStyle: 'italic', color: colors.form.soft, fontWeight: '400' },
  rowCaption: { fontSize: 15, color: colors.form.soft },
  rowEmphasis: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 3 },
});
