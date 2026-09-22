import { Unit } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime } from './format';

/**
 * Exportação da lista de unidades.
 *
 * Mesmas convenções das demais listas: CSV separado por ponto e vírgula (o
 * Excel em português abre sem assistente) e XLSX com filtro pronto. Sai o que
 * está na tela — já filtrado e ordenado.
 *
 * O nome do cliente e a data da última pesagem vêm prontos da tela: são dados
 * de outras tabelas, e recalculá-los aqui significaria consultar o banco de
 * novo para obter o que já está na mão.
 */
export interface UnitExportRow {
  unit: Unit;
  client: string;
  last: string | null;
}

const HEADERS = [
  'Unidade', 'Código', 'Cliente', 'Tipo', 'Cidade', 'UF', 'CEP', 'Logradouro', 'Bairro',
  'Endereço completo', 'Responsável', 'Telefone', 'Situação', 'Última pesagem',
];

const WIDTHS = [28, 12, 28, 18, 18, 6, 12, 30, 20, 40, 22, 16, 10, 18];

function rows(items: UnitExportRow[]): string[][] {
  return items.map(({ unit: u, client, last }) => [
    u.name,
    u.code ?? '',
    client,
    u.type ?? '',
    u.city ?? '',
    u.state ?? '',
    u.postal_code ?? '',
    u.street ?? '',
    u.neighborhood ?? '',
    // O endereço em texto livre pode ter quebras de linha; numa célula elas
    // viram linhas extras no CSV e quebram a planilha.
    (u.address ?? '').replace(/\s*\n\s*/g, ' '),
    u.contact_name ?? '',
    u.phone ?? '',
    u.active ? 'Ativa' : 'Inativa',
    last ? formatDateTime(last) : 'Nenhuma',
  ]);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportUnitsCsv(items: UnitExportRow[]): Promise<void> {
  const csv = [HEADERS, ...rows(items)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-unidades-${stamp()}.csv`, 'text/csv', 'Unidades — Eva Ambiental');
}

export async function exportUnitsXlsx(items: UnitExportRow[]): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(items)]);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:N${items.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Unidades');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-unidades-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Unidades — Eva Ambiental'
  );
}
