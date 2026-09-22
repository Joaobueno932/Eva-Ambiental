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

  /**
   * Menu lateral.
   *
   * Cor chapada, sem degradê: o menu é uma superfície de navegação e um verde
   * que escurece até o quase-preto no rodapé afunda a mascote e faz o bloco
   * pesar mais que o conteúdo ao lado.
   *
   * `sidebarActive` marca o item aberto — um verde mais claro da própria
   * rampa, e não um véu lima translúcido, que sobre este fundo virava
   * amarelado.
   */
  sidebar: '#0C2822', sidebarActive: '#1D4338',
  sidebarAlt: green[800], onSidebar: '#DCE8E2', onSidebarMuted: '#8FA79C',
  /** Texto, ícone e rótulo de seção do menu — medidos no desenho de referência. */
  sidebarText: '#D3DFDC', sidebarIcon: '#C4CFCC', sidebarCaption: '#A4BDBA',
  /** Morros do rodapé: crista clara que se dissolve no fundo do menu. */
  sidebarHillNear: '#204236', sidebarHillFar: '#153529', sidebarLeaf: '#133428', sidebarLeafVein: '#1C4033',

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

  /**
   * Situação das pesagens nos gráficos.
   *
   * Separado das cores semânticas porque ali o pendente é âmbar (cor de
   * aviso, para pílulas e alertas) e aqui é um verde claro: empilhado sobre o
   * verde escuro das aprovadas, o âmbar quebra a leitura da coluna como uma
   * grandeza só. O anel de situação e as pílulas seguem usando o âmbar.
   */
  statusChart: {
    approved: '#144335',
    pending: '#A0CD68',
    rejected: '#DE1B21',
    canceled: slate[300],
  },

  /** Âmbar do anel de situação e dos selos de pendência. */
  pendingRing: '#E1AE4B',

  /**
   * Verde de chamada para ação — só o botão que inicia um registro.
   *
   * Mais escuro e mais verde que o lima do `accent`, que segue reservado a
   * realce e seleção. São dois verdes claros com papéis distintos: este
   * convida a agir, o outro marca o que está selecionado.
   */
  cta: '#9ED953', ctaDeep: '#8AC63F', onCta: green[900],

  /**
   * Perfis de acesso: cada um com sua cor, medidas na tela de Usuários.
   *
   * A cor separa os perfis numa lista longa mais rápido que a leitura do
   * rótulo — e o verde fica com o administrador, que é quem pode tudo.
   */
  roles: {
    admin: { bg: '#D6F5E8', fg: '#074922' },
    analyst: { bg: '#DCE9FD', fg: '#0340A4' },
    operator: { bg: '#FEF0DC', fg: '#8A4B10' },
    viewer: { bg: '#EFE7FE', fg: '#2D1CBB' },
  },

  /**
   * Avatares de pessoa: fundo pastel e iniciais no tom escuro do mesmo matiz,
   * medidos na tela de Usuários. Sete matizes bastam para que pessoas vizinhas
   * numa lista raramente repitam a cor.
   */
  avatars: [
    { bg: '#D4EEFE', fg: '#1E4E8C' },
    { bg: '#EEE2FD', fg: '#4B3A8F' },
    { bg: '#D9EFDC', fg: '#1E5E3A' },
    { bg: '#FEDCE3', fg: '#9B2C3F' },
    { bg: '#FEEED2', fg: '#8A4B10' },
    { bg: '#DBF0ED', fg: '#1D5E57' },
    { bg: '#E2D1FD', fg: '#4A2D9A' },
  ],

  /**
   * Formulários de registro (Nova pesagem), medidos no desenho de referência.
   *
   * Os cinzas de texto puxam para o azul, e não para o verde como o resto da
   * paleta: é o que o desenho usa em rótulos e descrições, e num formulário
   * longo esse cinza frio separa melhor o que é instrução do que é dado.
   */
  form: {
    label: '#1F2D3A',
    muted: '#5F6D7B',
    soft: '#8792A0',
    border: '#E1E6EA',
    fieldBg: '#FBFCFC',
    required: '#E42735',
    /** Selo claro dos títulos de seção e do resumo. */
    tile: '#E2F2E0',
    tileIcon: '#1B4D3A',
    /** Selo neutro das linhas do resumo. */
    rowTile: '#F3F6F5',
    divider: '#EDF0F2',
    /** Ação principal do formulário. */
    action: '#0E493B',
    actionHover: '#0B3B30',
    /** Etapas do stepper. */
    stepActive: '#08704A',
    stepRing: '#A9D3BF',
    stepIdle: '#E1E5E8',
    stepIdleText: '#3A4650',
    stepLine: '#E2E6EA',
    stepLineDone: '#40A043',
    /** Aviso informativo (cinza) e de garantia (verde). */
    infoBg: '#F7FAFC',
    infoBorder: '#E7ECF2',
    infoText: '#586576',
    safeBg: '#F2F9F3',
    safeBorder: '#E3F1E6',
    safeText: '#475D61',
  },
} as const;

export type ColorKey = keyof typeof colors;
