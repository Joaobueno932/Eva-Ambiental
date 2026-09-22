import { Client } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime, formatDocument } from './format';

/**
 * Exportação da lista de clientes.
 *
 * Mesmas convenções do relatório de pesagens e da lista de usuários: CSV
 * separado por ponto e vírgula (o Excel em português abre sem assistente) e
 * XLSX com filtro pronto. Sai o que está na tela — já filtrado e ordenado —,
 * porque é isso que quem clicou em "Exportar" está vendo.
 */
const HEADERS = [
  'Razão social', 'Nome fantasia', 'CNPJ', 'Segmento', 'Cidade', 'UF',
  'Responsável', 'Cargo', 'E-mail', 'Telefone', 'Unidades', 'Situação', 'Última atualização',
];

const WIDTHS = [30, 24, 20, 18, 18, 6, 22, 18, 28, 16, 10, 10, 18];

function rows(clients: Client[], unitCount: (id: string) => number): string[][] {
  return clients.map((c) => [
    c.name,
    c.trade_name ?? '',
    formatDocument(c.document),
    c.segment ?? '',
    c.city ?? '',
    c.state ?? '',
    c.contact_name ?? '',
    c.contact_role ?? '',
    c.email ?? '',
    c.phone ?? '',
    String(unitCount(c.id)),
    c.active ? 'Ativo' : 'Inativo',
    c.updated_at ? formatDateTime(c.updated_at) : '',
  ]);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportClientsCsv(clients: Client[], unitCount: (id: string) => number): Promise<void> {
  const csv = [HEADERS, ...rows(clients, unitCount)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-clientes-${stamp()}.csv`, 'text/csv', 'Clientes — Eva Ambiental');
}

export async function exportClientsXlsx(clients: Client[], unitCount: (id: string) => number): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(clients, unitCount)]);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:M${clients.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Clientes');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-clientes-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Clientes — Eva Ambiental'
  );
}
