import { WasteType } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime } from './format';

/**
 * Exportação da lista de tipos de resíduos.
 *
 * Mesmas convenções das demais listas: CSV separado por ponto e vírgula (o
 * Excel em português abre sem assistente) e XLSX com filtro pronto. Sai o que
 * está na tela — já filtrado e ordenado.
 *
 * O tratamento, o destinatário e os números de uso vêm prontos da tela: são
 * dados de outras tabelas, e recalculá-los aqui significaria consultar o
 * banco de novo para obter o que já está na mão.
 */
export interface WasteExportRow {
  waste: WasteType;
  treatment: string;
  recipient: string;
  usage: { weighings: number; kg: number; last: string | null } | null;
}

const HEADERS = [
  'Resíduo', 'Código', 'Categoria', 'Classe (NBR 10004)', 'Perigoso', 'Potencial de desvio',
  'Destinação sugerida', 'Destinatário sugerido', 'Descrição', 'Situação',
  'Pesagens', 'Peso acumulado (kg)', 'Última pesagem',
];

const WIDTHS = [30, 12, 20, 18, 10, 18, 26, 26, 44, 10, 10, 20, 18];

/** Número no formato do Excel em português: vírgula decimal, sem milhar. */
const kg = (n: number) => n.toFixed(2).replace('.', ',');

function rows(items: WasteExportRow[]): string[][] {
  return items.map(({ waste: w, treatment, recipient, usage }) => [
    w.name,
    w.code ?? '',
    w.category ?? '',
    w.waste_class ?? '',
    w.is_hazardous ? 'Sim' : 'Não',
    w.is_divertible ? 'Sim' : 'Não',
    treatment,
    recipient,
    (w.description ?? '').replace(/\s*\n\s*/g, ' '),
    w.active ? 'Ativo' : 'Inativo',
    String(usage?.weighings ?? 0),
    kg(usage?.kg ?? 0),
    usage?.last ? formatDateTime(usage.last) : 'Nenhuma',
  ]);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportWasteTypesCsv(items: WasteExportRow[]): Promise<void> {
  const csv = [HEADERS, ...rows(items)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-residuos-${stamp()}.csv`, 'text/csv', 'Tipos de Resíduos — Eva Ambiental');
}

export async function exportWasteTypesXlsx(items: WasteExportRow[]): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(items)]);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:M${items.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Resíduos');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-residuos-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Tipos de Resíduos — Eva Ambiental'
  );
}
