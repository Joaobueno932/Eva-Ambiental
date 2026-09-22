/**
 * Entrega de arquivos gerados pelo sistema (relatórios, modelos, fotos).
 *
 * No aplicativo o arquivo é gravado no cache e aberto na folha de
 * compartilhamento do sistema. No navegador (`fileSaver.web.ts`) ele vira um
 * download comum. Quem chama não precisa saber a diferença.
 *
 * Os módulos nativos são importados dinamicamente de propósito: o `expo-print`
 * e o `expo-file-system` executam código de inicialização no import e já
 * causaram travamento na abertura do APK Android.
 */
import { base64ToBytes, bytesToBase64 } from './base64';

export type SaveResult = 'saved' | 'unavailable';

/** Grava o conteúdo Base64 no cache e abre o compartilhamento do sistema. */
export async function saveBase64File(
  base64: string,
  fileName: string,
  mimeType: string,
  dialogTitle?: string
): Promise<SaveResult> {
  const [FileSystem, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);

  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: dialogTitle ?? fileName });
  return 'saved';
}

/** Mesma entrega, a partir de bytes brutos. */
export async function saveBytesFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  dialogTitle?: string
): Promise<SaveResult> {
  return saveBase64File(bytesToBase64(bytes), fileName, mimeType, dialogTitle);
}

/** Texto puro (CSV, por exemplo) — gravado como UTF-8. */
export async function saveTextFile(
  text: string,
  fileName: string,
  mimeType: string,
  dialogTitle?: string
): Promise<SaveResult> {
  const [FileSystem, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);

  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, text, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: dialogTitle ?? fileName });
  return 'saved';
}

/** Converte o HTML do relatório em PDF e abre o compartilhamento. */
export async function savePdfFromHtml(
  html: string,
  fileName: string,
  dialogTitle?: string
): Promise<SaveResult> {
  const [Print, Sharing] = await Promise.all([import('expo-print'), import('expo-sharing')]);
  const { uri } = await Print.printToFileAsync({ html });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: dialogTitle ?? fileName,
  });
  return 'saved';
}

/** Reexportado para que os chamadores não precisem importar de dois lugares. */
export { base64ToBytes, bytesToBase64 };
