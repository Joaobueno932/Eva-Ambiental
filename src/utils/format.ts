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
