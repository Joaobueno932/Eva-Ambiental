/**
 * Transferência binária (envio de fotos e download de anexos).
 *
 * No aplicativo o `FileSystem.uploadAsync` é mais confiável que `fetch` com
 * Blob — evita carregar a imagem inteira na memória do JS e não depende do
 * suporte a Blob do Hermes. No navegador (`binary.web.ts`) o `fetch` nativo
 * resolve, já que lá a origem da imagem é um `blob:`/`data:` URL.
 */
import { base64ToBytes } from './base64';

export interface UploadResult {
  status: number;
  body?: string;
}

/** Envia o arquivo apontado por `fileUri` como corpo binário da requisição. */
export async function uploadBinaryFromUri(
  url: string,
  fileUri: string,
  headers: Record<string, string>
): Promise<UploadResult> {
  const FileSystem = await import('expo-file-system/legacy');
  const result = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  return { status: result.status, body: result.body };
}

/** Baixa uma URL e devolve o conteúdo como bytes. */
export async function fetchBytes(url: string): Promise<Uint8Array> {
  const FileSystem = await import('expo-file-system/legacy');
  const dest = `${FileSystem.cacheDirectory}dl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const res = await FileSystem.downloadAsync(url, dest);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Falha no download (HTTP ${res.status}).`);
  }
  const b64 = await FileSystem.readAsStringAsync(res.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // Libera o arquivo temporário: sem isso o cache cresce a cada download.
  await FileSystem.deleteAsync(res.uri, { idempotent: true }).catch(() => {});
  return base64ToBytes(b64);
}
