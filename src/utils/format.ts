import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export const formatDate = (iso?: string | null) =>
  iso ? dayjs(iso).format('DD/MM/YYYY') : '-';

export const formatTime = (iso?: string | null) =>
  iso ? dayjs(iso).format('HH:mm') : '-';

export const formatDateTime = (iso?: string | null) =>
  iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '-';

export const formatWeight = (kg?: number | null) => {
  const v = Number(kg ?? 0);
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
};

/**
 * Peso na unidade que cabe no número: toneladas a partir de mil quilos.
 *
 * "3.482.000,00 kg" obriga quem lê a contar casas para entender a grandeza;
 * "3.482 t" diz na hora. Abaixo de uma tonelada o quilo continua sendo a
 * unidade certa, com uma casa decimal para não arredondar 0,4 kg para zero.
 */
export const formatWeightShort = (kg?: number | null) => {
  const v = Number(kg ?? 0);
  if (Math.abs(v) >= 1000) {
    return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 100000 ? 0 : 1 })} t`;
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
};

export const formatNumber = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('pt-BR');

export const formatPercent = (p?: number | null) =>
  `${Number(p ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/**
 * Normaliza texto para comparação robusta: remove acentos, coloca em minúsculas,
 * remove espaços das pontas e colapsa espaços internos.
 */
export const normalizeText = (s?: string | null): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Tratamentos que contam como resíduo desviado do aterro (nomes normalizados).
 * Serve como fallback caso o campo `counts_as_diversion` não esteja configurado.
 */
const DIVERSION_TREATMENT_NAMES = new Set([
  normalizeText('Reciclável'),
  normalizeText('Reciclável (Latinhas)'),
  normalizeText('Reaproveitamento'),
  normalizeText('Logística Reversa'),
]);

/**
 * Determina se um tratamento conta como desvio de aterro.
 * Fonte primária: flag `counts_as_diversion`. Fallback: nome normalizado entre
 * os quatro tratamentos desviáveis (Reciclável, Reciclável (Latinhas),
 * Reaproveitamento, Logística Reversa) — evitando comparação frágil de textos.
 */
export const treatmentCountsAsDiversion = (
  t?: { name?: string | null; counts_as_diversion?: boolean | null } | null
): boolean => {
  if (!t) return false;
  if (t.counts_as_diversion === true) return true;
  return DIVERSION_TREATMENT_NAMES.has(normalizeText(t.name));
};

/**
 * Quanto do peso deste tratamento conta como desvio de aterro: 0 a 1.
 *
 * O `diversion_factor` (migração 0011) permite desvio parcial — um
 * coprocessamento que aproveita metade da carga conta 0,5. Sem o campo, a
 * resposta é a de sempre: 1 quando o tratamento considera desvio, 0 quando
 * não considera. Por isso um banco sem a migração, ou um cadastro em que
 * ninguém mexeu no fator, dá exatamente os mesmos números de antes.
 */
export const treatmentDiversionFactor = (
  t?: { name?: string | null; counts_as_diversion?: boolean | null; diversion_factor?: number | null } | null
): number => {
  if (!t) return 0;
  if (typeof t.diversion_factor === 'number') {
    return Math.min(100, Math.max(0, t.diversion_factor)) / 100;
  }
  return treatmentCountsAsDiversion(t) ? 1 : 0;
};

export interface DiversionClass {
  label: string;
  color: string;
}

/** Classifica a Taxa de Desvio de Aterro conforme as faixas do app. */
export function classifyDiversion(rate: number): DiversionClass {
  if (rate >= 80) return { label: 'Bom Desempenho', color: '#16A34A' };
  if (rate >= 50) return { label: 'Desempenho Moderado', color: '#D97706' };
  return { label: 'Baixo Desempenho', color: '#DC2626' };
}

export const approvalLabel: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

/**
 * Situação como a interface a nomeia.
 *
 * "Pendente" diz que algo falta, mas não o quê; na tela o mesmo status também
 * aparece no anel de situação e no cartão de indicador, e nos três lugares
 * precisa ser a mesma palavra — "Aguardando validação".
 *
 * Separado de `approvalLabel`, que continua alimentando os relatórios
 * exportados: mudar o texto lá alteraria planilhas e PDFs já entregues.
 */
export const approvalBadgeLabel: Record<string, string> = {
  ...approvalLabel,
  pending: 'Aguardando validação',
};

export const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  analyst: 'Analista',
  operator: 'Operador',
  viewer: 'Visualizador',
};

/**
 * Variação de um indicador, com sinal explícito.
 *
 * O sinal é sempre impresso, inclusive no positivo: "12%" sozinho se lê como
 * o valor do indicador, enquanto "+12%" só pode ser uma variação.
 *
 * `points` distingue as duas grandezas que aparecem no painel: contagem e
 * massa variam em porcentagem, uma taxa varia em pontos percentuais.
 */
export const formatDelta = (value: number, kind: 'percent' | 'points' = 'percent') => {
  const digits = kind === 'points' ? 1 : 0;
  const magnitude = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${magnitude}${kind === 'points' ? ' p.p.' : '%'}`;
};

/**
 * Código da pesagem como "000028".
 *
 * Cai no início do UUID enquanto a migração 0006 não tiver sido aplicada —
 * sem isso a coluna "#" ficaria vazia num banco que ainda não tem a
 * sequência, e um identificador em branco é pior que um identificador feio.
 */
export const formatWeighingCode = (weighing: { seq?: number | null; id: string }) =>
  weighing.seq != null
    ? String(weighing.seq).padStart(6, '0')
    : weighing.id.slice(0, 8);

/**
 * Data longa por extenso, ex.: "Segunda-feira, 21 de setembro de 2026".
 *
 * O dayjs devolve o dia da semana em minúsculas; em português ele abre a
 * frase, então recebe maiúscula aqui em vez de um `textTransform` que também
 * capitalizaria "De Setembro".
 */
export const formatLongDate = (iso?: string | null) => {
  const text = dayjs(iso ?? undefined).format('dddd, D [de] MMMM [de] YYYY');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Data de acesso em linguagem de quem confere a lista.
 *
 * "Hoje, 14:32" responde na hora o que "21/09/2026 14:32" obriga a comparar
 * com o calendário. A partir de anteontem a data cheia volta, porque aí o dia
 * da semana já não ajuda.
 */
export const formatAccess = (iso?: string | null) => {
  if (!iso) return null;
  const d = dayjs(iso);
  if (!d.isValid()) return null;
  const today = dayjs().startOf('day');
  if (d.isAfter(today)) return `Hoje, ${d.format('HH:mm')}`;
  if (d.isAfter(today.subtract(1, 'day'))) return `Ontem, ${d.format('HH:mm')}`;
  return d.format('DD/MM/YYYY, HH:mm');
};

/** Minutos desde o último acesso — `null` quando nunca houve. */
export const minutesSince = (iso?: string | null) => {
  if (!iso) return null;
  const d = dayjs(iso);
  return d.isValid() ? dayjs().diff(d, 'minute') : null;
};

/**
 * CNPJ ou CPF com a pontuação de sempre.
 *
 * O campo aceita o documento digitado de qualquer forma; a lista precisa dele
 * numa forma só, senão duas linhas iguais parecem diferentes. Documento com
 * outra quantidade de dígitos volta como foi digitado — melhor mostrar o que
 * está gravado do que aplicar uma máscara que não serve.
 */
export const formatDocument = (value?: string | null) => {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value?.trim() || '';
};

/**
 * Data de atividade: o dia quando é recente, a data quando não é.
 *
 * "Hoje, 14:32" responde na hora; de anteontem em diante a hora já não
 * importa para quem confere a lista, e a data limpa lê melhor numa coluna.
 */
export const formatDayOrDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = dayjs(iso);
  if (!d.isValid()) return null;
  const today = dayjs().startOf('day');
  if (d.isAfter(today)) return `Hoje, ${d.format('HH:mm')}`;
  if (d.isAfter(today.subtract(1, 'day'))) return `Ontem, ${d.format('HH:mm')}`;
  return d.format('DD/MM/YYYY');
};

/**
 * CPF com pontuação enquanto se digita.
 *
 * A máscara acompanha o que já foi escrito em vez de exigir o número
 * completo: quem digita "123" vê "123", e não "123.___.___-__".
 */
export const maskCpf = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

/**
 * O CPF é válido?
 *
 * Confere os dois dígitos verificadores, e não só a quantidade de números:
 * "111.111.111-11" tem onze dígitos e passa na conta, mas não é CPF de
 * ninguém — sequências repetidas são recusadas à parte.
 */
export const isValidCpf = (value?: string | null): boolean => {
  const d = (value ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};

/** Data com barras enquanto se digita: "12051990" → "12/05/1990". */
export const maskDate = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/**
 * "12/05/1990" → "1990-05-12", ou `null` quando a data não existe.
 *
 * Confere o calendário de verdade: 31/02 tem oito dígitos e encaixa na
 * máscara, mas não é um dia. O ano precisa de quatro casas para "90" não
 * virar o ano 90.
 *
 * A conferência é o ida-e-volta pelo `Date` e não o modo estrito do dayjs,
 * que depende de um plugin não instalado — sem ele o dayjs aceitaria
 * "1990-02-31" e devolveria 3 de março, uma data que ninguém digitou.
 */
export const parseBrDate = (value: string): string | null => {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m.map(Number) as unknown as [number, number, number, number];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** "1990-05-12" → "12/05/1990". Vazio quando não há data. */
export const formatBrDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY') : '';
};
