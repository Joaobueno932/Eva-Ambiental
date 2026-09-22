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

export const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  analyst: 'Analista',
  operator: 'Operador',
  viewer: 'Visualizador',
};
