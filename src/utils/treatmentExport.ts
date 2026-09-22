import { TreatmentType } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime, treatmentDiversionFactor } from './format';

/**
 * Exportação da lista de tipos de tratamento.
 *
 * Mesmas convenções das demais listas: CSV separado por ponto e vírgula (o
 * Excel em português abre sem assistente) e XLSX com filtro pronto. Sai o que
 * está na tela — já filtrado e ordenado.
 *
 * O peso e a contagem de pesagens vêm prontos da tela: são agregados de outra
 * tabela, e recalculá-los aqui significaria consultar o banco de novo.
 */
export interface TreatmentExportRow {
  treatment: TreatmentType;
  usage: { weighings: number; kg: number; last: string | null } | null;
}

const HEADERS = [
  'Tratamento', 'Categoria', 'Considera desvio', 'Fator de desvio (%)', 'Aplicação',
  'Descrição', 'Situação', 'Pesagens', 'Peso acumulado (kg)', 'Peso desviado (kg)',
  'Última pesagem', 'Última atualização',
];

const WIDTHS = [28, 24, 16, 18, 26, 44, 10, 10, 20, 20, 18, 18];

/** Número no formato do Excel em português: vírgula decimal, sem milhar. */
const kg = (n: number) => n.toFixed(2).replace('.', ',');

function rows(items: TreatmentExportRow[]): string[][] {
  return items.map(({ treatment: t, usage }) => {
    const factor = treatmentDiversionFactor(t);
    return [
      t.name,
      t.category ?? '',
      factor > 0 ? 'Sim' : 'Não',
      String(Math.round(factor * 100)),
      t.application ?? '',
      (t.description ?? '').replace(/\s*\n\s*/g, ' '),
      t.active ? 'Ativo' : 'Inativo',
      String(usage?.weighings ?? 0),
      kg(usage?.kg ?? 0),
      kg((usage?.kg ?? 0) * factor),
      usage?.last ? formatDateTime(usage.last) : 'Nenhuma',
      t.updated_at ? formatDateTime(t.updated_at) : '',
    ];
  });
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportTreatmentsCsv(items: TreatmentExportRow[]): Promise<void> {
  const csv = [HEADERS, ...rows(items)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-tratamentos-${stamp()}.csv`, 'text/csv', 'Tipos de Tratamento — Eva Ambiental');
}

export async function exportTreatmentsXlsx(items: TreatmentExportRow[]): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(items)]);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:L${items.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Tratamentos');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-tratamentos-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Tipos de Tratamento — Eva Ambiental'
  );
}
