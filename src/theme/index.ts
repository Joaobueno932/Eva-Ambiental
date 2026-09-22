export { colors } from './colors';
export { elevation, raised, gradient, gradients, transition, ring, lift, eyebrow } from './effects';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Raios.
 *
 * Cantos maiores que antes: com 4px o cartão parecia um campo de formulário
 * ampliado. A escala cresce junto com a superfície — botão menor que cartão,
 * cartão menor que diálogo.
 */
export const radius = { xs: 6, sm: 8, md: 10, lg: 14, xl: 18, xxl: 24, full: 999 } as const;
export const layout = { desktop: 900, wide: 1280, content: 1440, sidebar: 264, touchTarget: 44 } as const;

/**
 * Tipografia.
 *
 * Números grandes usam `letterSpacing` negativo e peso alto: é o que faz um
 * indicador parecer um indicador, e não um parágrafo em corpo maior.
 */
export const typography = {
  display: { fontSize: 42, fontWeight: '700' as const, letterSpacing: -1.4 },
  metric: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySm: { fontSize: 13.5, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

/** Mantido para telas que ainda espalham `...shadow.card`. */
export const shadow = {
  card: {
    shadowColor: '#0A1F19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
};
