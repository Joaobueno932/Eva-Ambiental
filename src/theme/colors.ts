/**
 * Paleta de cores inspirada na personagem Eva — sustentabilidade e meio ambiente.
 */
export const colors = {
  green: '#63B32E',
  greenDark: '#4D8E26',
  greenLight: '#A7D86E',
  greenBg: '#EEF8E7',
  white: '#FFFFFF',
  gray: '#F4F4F4',
  grayMedium: '#E5E7EB',
  grayText: '#6B7280',
  text: '#1F2937',

  // Status
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',

  // Charts (variações de verde + apoio)
  chart: ['#63B32E', '#4D8E26', '#A7D86E', '#2563EB', '#D97706', '#16A34A', '#DC2626', '#7C3AED', '#0891B2', '#CA8A04'],
} as const;

export type ColorKey = keyof typeof colors;
