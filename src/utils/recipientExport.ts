import { Recipient } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime, formatDocument } from './format';

/**
 * Exportação da lista de destinatários.
 *
 * Mesmas convenções das demais listas: CSV separado por ponto e vírgula (o
 * Excel em português abre sem assistente) e XLSX com filtro pronto. Sai o que
 * está na tela — já filtrado e ordenado.
 *
 * Os números de uso vêm prontos da tela: são agregados de outra tabela, e
 * recalculá-los aqui significaria consultar o banco de novo.
 */
export interface RecipientExportRow {
  recipient: Recipient;
  usage: { weighings: number; kg: number; last: string | null; month: number } | null;
}

const HEADERS = [
  'Destinatário', 'Tipo', 'CNPJ', 'Responsável', 'E-mail', 'Telefone',
  'Cidade', 'UF', 'CEP', 'Logradouro', 'Bairro', 'Site',
  'Licença ambiental', 'Situação', 'Disposição final',
  'Pesagens', 'Peso recebido (kg)', 'Pesagens no mês', 'Última pesagem',
];

const WIDTHS = [30, 20, 20, 22, 28, 16, 18, 6, 12, 30, 18, 26, 20, 12, 16, 10, 20, 16, 18];

/** Número no formato do Excel em português: vírgula decimal, sem milhar. */
const kg = (n: number) => n.toFixed(2).replace('.', ',');

const STATUS_TEXT: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  inactive: 'Inativo',
};

function rows(items: RecipientExportRow[]): string[][] {
  return items.map(({ recipient: r, usage }) => [
    r.name,
    r.type ?? '',
    formatDocument(r.document),
    r.contact_name ?? '',
    r.email ?? '',
    r.phone ?? '',
    r.city ?? '',
    r.state ?? '',
    r.postal_code ?? '',
    r.street ?? '',
    r.neighborhood ?? '',
    r.website ?? '',
    r.license_number ?? '',
    STATUS_TEXT[r.status ?? (r.active ? 'active' : 'inactive')] ?? '',
    r.is_landfill ? 'Sim' : 'Não',
    String(usage?.weighings ?? 0),
    kg(usage?.kg ?? 0),
    String(usage?.month ?? 0),
    usage?.last ? formatDateTime(usage.last) : 'Nenhuma',
  ]);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportRecipientsCsv(items: RecipientExportRow[]): Promise<void> {
  const csv = [HEADERS, ...rows(items)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-destinatarios-${stamp()}.csv`, 'text/csv', 'Destinatários — Eva Ambiental');
}

export async function exportRecipientsXlsx(items: RecipientExportRow[]): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(items)]);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:S${items.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Destinatários');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-destinatarios-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Destinatários — Eva Ambiental'
  );
}
