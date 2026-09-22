/**
 * Seleção e leitura da planilha usada na importação.
 *
 * Separado de `imports.ts` porque é a única parte do fluxo que depende da
 * plataforma: a versão web (`spreadsheetFile.web.ts`) usa um input de arquivo
 * e o fetch do navegador, já que `expo-file-system` não existe lá.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface PickedSpreadsheet {
  uri: string;
  name: string;
}

/** Abre o seletor de arquivo e retorna URI + nome. Retorna null se cancelado. */
export async function pickXlsxFile(): Promise<PickedSpreadsheet | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: XLSX_MIME,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name ?? 'arquivo.xlsx' };
}

/** Lê o arquivo escolhido como Base64 (formato que o SheetJS consome). */
export async function readFileBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
