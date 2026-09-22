/**
 * Versão web da seleção/leitura da planilha de importação.
 *
 * Um `<input type="file">` cobre o caso sem depender do expo-document-picker,
 * e o arquivo escolhido fica acessível por um object URL que o `fetch` lê.
 */
import { bytesToBase64 } from '@/utils/base64';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface PickedSpreadsheet {
  uri: string;
  name: string;
}

export async function pickXlsxFile(): Promise<PickedSpreadsheet | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Alguns sistemas não associam o MIME ao .xlsx; a extensão cobre a falha.
    input.accept = `${XLSX_MIME},.xlsx`;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: PickedSpreadsheet | null) => {
      if (settled) return;
      settled = true;
      if (input.parentNode) document.body.removeChild(input);
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      finish(file ? { uri: URL.createObjectURL(file), name: file.name } : null);
    };
    // Sem o evento "cancel" a Promise ficaria pendente se o usuário desistisse.
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

export async function readFileBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error('Não foi possível ler a planilha selecionada.');
  const base64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
  // O object URL não serve para mais nada depois da leitura.
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
  return base64;
}
