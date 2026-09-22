/**
 * Identidade operacional compartilhada entre Web e Android.
 *
 * A paleta é construída em rampas, não em cores avulsas: cada família tem
 * tons claros para superfícies, médios para traços e escuros para texto. É o
 * que permite empilhar fundo, cartão, borda e realce sem que a tela vire um
 * mosaico de blocos chapados.
 */

/** Verde da marca, do quase-preto institucional ao véu de fundo. */
const green = {
  900: '#0A1F19',
  800: '#102A23',
  700: '#17372F',
  600: '#1E4A3E',
  500: '#2A6252',
  400: '#3F8069',
  300: '#6BA48D',
  200: '#A9CCBB',
  100: '#D7E8DF',
  50: '#EFF6F2',
} as const;

/** Neutros com um leve viés verde — cinza puro deixa a tela com ar de rascunho. */
const slate = {
  900: '#0F1A16',
  800: '#1C2A25',
  700: '#33443D',
  600: '#4A5C54',
  500: '#64756D',
  400: '#8A9791',
  300: '#B7C2BC',
  200: '#D6DEDA',
  100: '#E6ECE9',
  50: '#F2F5F4',
} as const;

export const colors = {
  // Marca
  green: green[700], greenDark: green[800], greenDarker: green[900], greenMid: green[500],
  greenLight: '#C7F464', greenBg: green[50], greenSoft: green[100], greenLine: green[200],
  brand: green,
  slate,

  // Acento lima — reservado a realces e seleção, nunca a grandes áreas.
  accent: '#C7F464', accentDeep: '#A8D93F', accentSoft: '#E8FAC0', onAccent: green[800],

  // Menu lateral
  sidebar: green[900], sidebarAlt: green[800], onSidebar: '#DCE8E2', onSidebarMuted: '#8FA79C',

  // Superfícies
  white: '#FFFFFF', pageBg: '#F4F7F5', surface: '#FFFFFF', surfaceAlt: '#F7F9F8',
  surfaceSunken: '#EEF2F0', overlay: 'rgba(10,31,25,0.55)',

  // Traços e texto
  border: '#E3E9E6', borderSoft: '#EDF1EF', borderStrong: '#CBD5D0',
  text: slate[900], textStrong: slate[900], textMuted: slate[500], textSoft: slate[400],

  // Compatibilidade com telas antigas
  gray: slate[50], grayMedium: '#D6DEDA', grayText: slate[500],

  // Semânticas — cada uma com fundo e traço próprios, para avisos legíveis.
  success: '#15734D', successBg: '#E9F5EF', successBorder: '#BEE0CE',
  warning: '#9A6100', warningBg: '#FDF4E3', warningBorder: '#EFD8AE',
  danger: '#B3261E', dangerBg: '#FCEDEB', dangerBorder: '#F1C8C4',
  info: '#1E6A9E', infoBg: '#EBF3F9', infoBorder: '#C4DCEE',

  /** Série de gráficos: matiz e luminosidade alternadas para leitura em sequência. */
  chart: ['#17372F', '#2F7D63', '#7FB894', '#2E6F9E', '#B5842F', '#6E8FB8', '#B3554A', '#7A6A9E', '#3E9690', '#94A85C'],
} as const;

export type ColorKey = keyof typeof colors;
