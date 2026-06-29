/**
 * Gerador de planilhas modelo (.xlsx) para download dentro do app.
 * As colunas devem corresponder EXATAMENTE ao que o importador espera (imports.ts).
 */
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

async function shareXlsx(wb: XLSX.WorkBook, fileName: string, dialogTitle: string): Promise<void> {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle,
    });
  }
}

/**
 * Modelo de pesagens.
 * Colunas (posição importa): Data | Cliente | Unidade/Localidade | Destinatário
 *   | Tipo de Resíduo | Tipo de Tratamento | Peso (kg) | Observações
 * - Cliente, Unidade e Destinatário devem já existir no sistema (bloqueantes).
 * - Tipo de Resíduo e Tipo de Tratamento são criados automaticamente se ausentes.
 * - Peso usa vírgula ou ponto como separador decimal.
 * - Destinatário e Observações são opcionais (podem ficar em branco).
 */
export async function downloadWeighingsTemplate(): Promise<void> {
  const headers = [
    'Data',
    'Cliente',
    'Unidade/Localidade',
    'Destinatário',
    'Tipo de Resíduo',
    'Tipo de Tratamento',
    'Peso (kg)',
    'Observações',
  ];
  const rows = [
    ['28/06/2026', 'Cliente Demonstração S/A', 'Unidade Campo Grande', 'Cooperativa Recicla', 'Cartonagem', 'Reciclagem', '7,50', 'Coleta semanal'],
    ['29/06/2026', 'Cliente Demonstração S/A', 'Unidade Campo Grande', '', 'Plástico', 'Aterro', '12,30', ''],
    ['30/06/2026', 'Empresa Exemplo Ltda', 'Galpão Leste', 'Aterro Sanitário Regional', 'Resíduo Orgânico', 'Compostagem', '50,00', 'Geração semanal'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 20) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pesagens');
  await shareXlsx(wb, 'modelo-pesagens.xlsx', 'Modelo de Importação de Pesagens');
}

/**
 * Modelo de clientes com unidades/localidades.
 * Colunas (posição importa): Cliente | CNPJ/CPF | Unidade/Localidade | Endereço | Cidade | Estado
 * - Clientes e unidades já existentes são ignorados (sem duplicatas).
 * - Estado é concatenado ao endereço da unidade ao salvar.
 * - CNPJ/CPF é usado como chave de deduplicação (prioritário sobre nome).
 * - Uma linha por unidade; repita o cliente nas linhas com mesma unidade.
 */
export async function downloadClientsTemplate(): Promise<void> {
  const headers = ['Cliente', 'CNPJ/CPF', 'Unidade/Localidade', 'Endereço', 'Cidade', 'Estado'];
  const rows = [
    ['Empresa ABC Ltda', '12.345.678/0001-90', 'Unidade Paulista', 'Av. Paulista, 1000', 'São Paulo', 'SP'],
    ['Empresa ABC Ltda', '12.345.678/0001-90', 'Unidade Centro', 'Rua Direita, 500', 'São Paulo', 'SP'],
    ['Outra Empresa SA', '98.765.432/0001-10', 'Galpão Principal', 'Rodovia BR-101, Km 20', 'Campinas', 'SP'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 22) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes e Unidades');
  await shareXlsx(wb, 'modelo-clientes-unidades.xlsx', 'Modelo de Clientes e Unidades');
}

/**
 * Modelo de destinatários.
 * Colunas (posição importa): Nome/Razão Social | CNPJ/CPF
 * - Destinatários já existentes são ignorados (sem duplicatas).
 * - CNPJ/CPF é usado como chave de deduplicação (prioritário sobre nome).
 */
export async function downloadRecipientsTemplate(): Promise<void> {
  const headers = ['Nome/Razão Social', 'CNPJ/CPF'];
  const rows = [
    ['Cooperativa Recicla SP', '98.765.432/0001-10'],
    ['Aterro Sanitário Regional', '11.222.333/0001-44'],
    ['Empresa de Reciclagem do Vale', '55.666.777/0001-88'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 28) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Destinatários');
  await shareXlsx(wb, 'modelo-destinatarios.xlsx', 'Modelo de Destinatários');
}
