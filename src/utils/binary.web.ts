/**
 * Versão web da transferência binária.
 *
 * No navegador a imagem escolhida pelo usuário chega como `blob:` ou `data:`
 * URL, então basta buscá-la e reenviar o Blob no corpo da requisição.
 */
export interface UploadResult {
  status: number;
  body?: string;
}

export async function uploadBinaryFromUri(
  url: string,
  fileUri: string,
  headers: Record<string, string>
): Promise<UploadResult> {
  const fileRes = await fetch(fileUri);
  if (!fileRes.ok) throw new Error('Não foi possível ler a imagem selecionada.');
  const blob = await fileRes.blob();

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: blob,
  });

  // O corpo só interessa quando deu errado — é o que a mensagem de erro mostra.
  const body = res.ok ? undefined : await res.text().catch(() => undefined);
  return { status: res.status, body };
}

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha no download (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
