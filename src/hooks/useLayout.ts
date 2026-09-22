/**
 * Breakpoints da interface.
 *
 * O sistema roda em dois formatos: o aplicativo (e o navegador no celular),
 * onde vale o layout de coluna única pensado para o polegar, e o site em tela
 * grande, onde há espaço para menu lateral, grades e tabelas.
 *
 * `isDesktop` é a única chave que decide entre os dois — por isso mora aqui, e
 * não espalhada em cada tela.
 */
import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '@/theme';

/** Largura a partir da qual a interface assume o formato de site em tela grande. */
export const DESKTOP_BREAKPOINT = layout.desktop;

/** Largura a partir da qual cabe uma coluna a mais nas grades. */
export const WIDE_BREAKPOINT = layout.wide;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}

/** Número de colunas da grade de cartões, conforme o espaço disponível. */
export function useCardColumns(): number {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 1;
  if (width >= WIDE_BREAKPOINT) return 3;
  if (width >= DESKTOP_BREAKPOINT) return 2;
  return 1;
}
