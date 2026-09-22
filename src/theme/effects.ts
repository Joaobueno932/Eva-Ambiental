/**
 * Profundidade, gradientes e transições.
 *
 * O que separa uma tela "de template" de um sistema é a camada: a sombra que
 * apoia o cartão sobre o fundo, o degradê que tira o bloco chapado da barra
 * lateral, a transição que confirma o passar do mouse. Nada disso existe em
 * `StyleSheet` de forma portátil — daí este módulo.
 *
 * Tudo aqui é aplicado só na Web. No Android o React Native não interpreta
 * degradês CSS nem transições, então lá cada helper devolve o equivalente
 * sólido (ou nada) e a interface continua idêntica à que já era entregue.
 */
import { Platform } from 'react-native';
import { colors } from './colors';

const isWeb = Platform.OS === 'web';

/** Estilos que só existem no react-native-web e não constam no tipo ViewStyle. */
type WebStyle = any;

/**
 * Escala de elevação.
 *
 * Duas sombras por nível: uma curta e opaca que cola o elemento na superfície,
 * outra longa e difusa que o levanta. Uma sombra só, como havia antes, deixa
 * o cartão com aparência de caixa recortada.
 */
const shadows = {
  xs: '0 1px 2px rgba(10,31,25,0.05)',
  sm: '0 1px 2px rgba(10,31,25,0.05), 0 2px 6px -1px rgba(10,31,25,0.06)',
  md: '0 2px 4px rgba(10,31,25,0.05), 0 8px 18px -6px rgba(10,31,25,0.10)',
  lg: '0 4px 8px rgba(10,31,25,0.05), 0 16px 32px -12px rgba(10,31,25,0.14)',
  xl: '0 8px 16px rgba(10,31,25,0.06), 0 28px 60px -20px rgba(10,31,25,0.20)',
} as const;

/** Equivalentes nativos — o Android só entende uma sombra e a elevação. */
const nativeShadows = {
  xs: { shadowColor: '#0A1F19', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#0A1F19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#0A1F19', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor: '#0A1F19', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  xl: { shadowColor: '#0A1F19', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 32, elevation: 14 },
} as const;

export type ElevationLevel = keyof typeof shadows;

export function elevation(level: ElevationLevel): WebStyle {
  return isWeb ? { boxShadow: shadows[level] } : nativeShadows[level];
}

/** Sombra combinada com um traço interno claro — o acabamento dos cartões. */
export function raised(level: ElevationLevel = 'sm'): WebStyle {
  if (!isWeb) return nativeShadows[level];
  return { boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), ${shadows[level]}` };
}

/** Degradês nomeados do sistema. */
export const gradients = {
  /** Botão e superfícies de ação principais. */
  brand: `linear-gradient(180deg, ${colors.brand[600]} 0%, ${colors.brand[700]} 100%)`,
  brandHover: `linear-gradient(180deg, ${colors.brand[500]} 0%, ${colors.brand[600]} 100%)`,
  /** Menu lateral: escurece de cima para baixo, com um véu verde no topo. */
  sidebar: `linear-gradient(180deg, ${colors.brand[800]} 0%, ${colors.brand[900]} 55%, #071712 100%)`,
  /** Cartões: branco com um sopro de verde na base, tira o ar de folha em branco. */
  surface: 'linear-gradient(180deg, #FFFFFF 0%, #FBFDFC 100%)',
  /** Faixa de indicadores. */
  metric: `linear-gradient(135deg, #FFFFFF 0%, ${colors.brand[50]} 140%)`,
  /** Cabeçalho do aplicativo no celular. */
  header: `linear-gradient(135deg, ${colors.brand[700]} 0%, ${colors.brand[900]} 100%)`,
  /**
   * Véu da tela de acesso, aplicado *sobre* a fotografia da mata.
   *
   * São três camadas: a elipse que avança da esquerda e recorta a foto numa
   * curva — é ela que dá o gesto da composição, e não um corte reto —, a
   * rampa horizontal que escurece o lado do texto o bastante para o branco
   * ficar legível, e um assentamento no rodapé. A foto continua visível à
   * direita, onde só o cartão passa por cima.
   */
  loginVeil: [
    `radial-gradient(135% 155% at -12% 48%, rgba(2,29,21,0.97) 0%, rgba(2,29,21,0.94) 40%, rgba(2,29,21,0.55) 56%, rgba(2,29,21,0) 66%)`,
    `linear-gradient(96deg, rgba(1,24,18,0.96) 0%, rgba(2,29,21,0.86) 26%, rgba(3,37,27,0.46) 46%, rgba(5,45,33,0.14) 62%, rgba(5,45,33,0.04) 100%)`,
    `linear-gradient(180deg, rgba(2,29,21,0.16) 0%, rgba(2,29,21,0) 30%, rgba(2,29,21,0.26) 100%)`,
  ].join(', '),
  /** Fundo da tela de acesso quando não há fotografia (fallback sólido no Android). */
  hero: `radial-gradient(1100px 620px at 12% -10%, ${colors.brand[600]} 0%, transparent 62%), radial-gradient(760px 520px at 96% 8%, rgba(199,244,100,0.16) 0%, transparent 60%), linear-gradient(160deg, ${colors.brand[800]} 0%, ${colors.brand[900]} 48%, #05120E 100%)`,
  /** Acento lima, usado em detalhes finos. */
  accent: `linear-gradient(90deg, ${colors.accent} 0%, ${colors.accentDeep} 100%)`,
  /** Cabeçalho de tabela. */
  tableHead: `linear-gradient(180deg, ${colors.surfaceAlt} 0%, #F1F5F3 100%)`,
  /** Barra de gráfico — realça o topo da barra. */
  bar: (color: string) => `linear-gradient(90deg, ${color} 0%, ${color}D9 100%)`,
} as const;

/** Aplica um degradê na Web; no Android devolve a cor sólida equivalente. */
export function gradient(css: string, fallback?: string): WebStyle {
  if (!isWeb) return fallback ? { backgroundColor: fallback } : {};
  return { backgroundImage: css };
}

/** Transição suave. Ignorada fora da Web. */
export function transition(props = 'background-color, border-color, box-shadow, transform, color', ms = 160): WebStyle {
  if (!isWeb) return {};
  return {
    transitionProperty: props,
    transitionDuration: `${ms}ms`,
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  };
}

/** Anel de foco/realce ao redor de um campo ou item selecionado. */
export function ring(color: string = colors.brand[500], width = 3, alpha = '2E'): WebStyle {
  if (!isWeb) return {};
  return { boxShadow: `0 0 0 ${width}px ${color}${alpha}` };
}

/** Deslocamento vertical no hover — só faz sentido com ponteiro. */
export function lift(px = 1): WebStyle {
  if (!isWeb) return {};
  return { transform: `translateY(-${px}px)` };
}

/** Texto em caixa alta com espaçamento — rótulos de seção e de coluna. */
export const eyebrow = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
};
