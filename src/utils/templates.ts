/**
 * Gerador de planilhas modelo (.xlsx) para download dentro do app.
 * As colunas devem corresponder EXATAMENTE ao que o importador espera (imports.ts).
 *
 * IMPORTANTE: xlsx é importado dinamicamente dentro de cada função para evitar que
 * o módulo execute código de inicialização durante a inicialização do app Android.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

async function shareFile(b64: string, fileName: string, dialogTitle: string): Promise<void> {
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
 */
export async function downloadWeighingsTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = [
    'Data',
    'Cliente',
    'Unidade/Localidade',
    'Destinatário',
    'Tipo de Resíduo',
    'Tipo de Tratamento',
    'Peso (kg)',
    'Qtd de Pessoas',
    'Poderia desviar do aterro?',
    'Observações',
  ];
  const rows = [
    ['28/06/2026', 'Cliente Demonstração S/A', 'Unidade Campo Grande', 'Cooperativa Recicla', 'Cartonagem', 'Reciclagem', '7,50', '50', '', 'Coleta semanal'],
    ['29/06/2026', 'Cliente Demonstração S/A', 'Unidade Campo Grande', 'Aterro Sanitário Regional', 'Plástico', 'Aterro', '12,30', '', 'Sim', ''],
    ['30/06/2026', 'Empresa Exemplo Ltda', 'Galpão Leste', 'Aterro Sanitário Regional', 'Resíduo Orgânico', 'Compostagem', '50,00', '120', 'Não', 'Geração semanal'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 20) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pesagens');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await shareFile(b64, 'modelo-pesagens.xlsx', 'Modelo de Importação de Pesagens');
}

/**
 * Modelo de clientes com unidades/localidades.
 * Colunas (posição importa): Cliente | CNPJ/CPF | Unidade/Localidade | Rua/Logradouro | Bairro | Cidade | Estado | CEP
 */
export async function downloadClientsTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = ['Cliente', 'CNPJ/CPF', 'Unidade/Localidade', 'Rua / Logradouro', 'Bairro', 'Cidade', 'Estado', 'CEP'];
  const rows = [
    ['Empresa ABC Ltda', '12.345.678/0001-90', 'Unidade Paulista', 'Av. Paulista, 1000', 'Bela Vista', 'São Paulo', 'SP', '01310-100'],
    ['Empresa ABC Ltda', '12.345.678/0001-90', 'Unidade Centro', 'Rua Direita, 500', 'Centro', 'São Paulo', 'SP', '01003-001'],
    ['Outra Empresa SA', '98.765.432/0001-10', 'Galpão Principal', 'Rodovia BR-101, Km 20', 'Distrito Industrial', 'Campinas', 'SP', '13080-000'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 22) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes e Unidades');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await shareFile(b64, 'modelo-clientes-unidades.xlsx', 'Modelo de Clientes e Unidades');
}

/**
 * Modelo de destinatários.
 * Colunas (posição importa): Nome/Razão Social | CNPJ/CPF
 */
export async function downloadRecipientsTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = ['Nome/Razão Social', 'CNPJ/CPF', 'É aterro?'];
  const rows = [
    ['Cooperativa Recicla SP', '98.765.432/0001-10', 'Não'],
    ['Aterro Sanitário Regional', '11.222.333/0001-44', 'Sim'],
    ['Empresa de Reciclagem do Vale', '55.666.777/0001-88', 'Não'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 28) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Destinatários');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await shareFile(b64, 'modelo-destinatarios.xlsx', 'Modelo de Destinatários');
}
