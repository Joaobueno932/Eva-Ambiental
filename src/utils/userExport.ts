import { Profile } from '@/types';
import { saveBase64File, saveTextFile } from './fileSaver';
import { formatDateTime, roleLabel } from './format';

/**
 * Exportação da lista de usuários.
 *
 * Mesmas convenções do relatório de pesagens: CSV separado por ponto e
 * vírgula (o Excel em português abre sem assistente de importação) e XLSX com
 * a planilha pronta para filtrar. Exporta o que está na tela — já filtrado e
 * ordenado —, porque é isso que quem clicou em "Exportar" está vendo.
 */
const HEADERS = ['Nome', 'E-mail', 'Perfil', 'Situação', 'Último acesso'];

function rows(users: Profile[]): string[][] {
  return users.map((u) => [
    u.full_name,
    u.email,
    roleLabel[u.role] ?? u.role,
    u.active ? 'Ativo' : 'Inativo',
    u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : '—',
  ]);
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportUsersCsv(users: Profile[]): Promise<void> {
  const csv = [HEADERS, ...rows(users)].map((r) => r.map(csvCell).join(';')).join('\n');
  await saveTextFile(csv, `eva-ambiental-usuarios-${stamp()}.csv`, 'text/csv', 'Usuários — Eva Ambiental');
}

export async function exportUsersXlsx(users: Profile[]): Promise<void> {
  const xl = await import('xlsx');
  const ws = xl.utils.aoa_to_sheet([HEADERS, ...rows(users)]);
  ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 16 }, { wch: 10 }, { wch: 18 }];
  ws['!autofilter'] = { ref: `A1:E${users.length + 1}` };
  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, ws, 'Usuários');
  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveBase64File(
    b64,
    `eva-ambiental-usuarios-${stamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Usuários — Eva Ambiental'
  );
}
