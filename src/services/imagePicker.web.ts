/**
 * Seleção de imagem no navegador.
 *
 * `ImagePicker.launchCameraAsync` não existe na web, então a captura usa um
 * `<input type="file" capture="environment">`: no celular o navegador abre a
 * câmera traseira direto; no computador, que não tem `capture`, abre o seletor
 * de arquivos (ver `cameraIsDirect`).
 *
 * A imagem escolhida é reduzida e recomprimida em JPEG antes de subir — uma
 * foto de celular moderna passa de 5 MB, e o app nativo já fazia essa
 * compressão via `quality: 0.6`.
 */
export type PickStatus = 'ok' | 'canceled' | 'denied';

export interface PickResult {
  status: PickStatus;
  uri?: string;
}

const QUALITY = 0.6;
/** Maior dimensão aceita. Preserva legibilidade da evidência sem inflar o upload. */
const MAX_DIMENSION = 1600;

/** Abre o seletor de arquivos e devolve o arquivo escolhido (ou null). */
function openFileDialog(useCamera: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      if (input.parentNode) document.body.removeChild(input);
      resolve(file);
    };

    input.onchange = () => finish(input.files?.[0] ?? null);
    // "cancel" só existe nos navegadores recentes; sem ele a Promise ficaria
    // pendente para sempre se o usuário fechasse o diálogo.
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

/** Redimensiona e recomprime como JPEG, devolvendo um object URL. */
async function toCompressedJpegUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    // Sem canvas disponível, sobe o arquivo original em vez de falhar.
    return URL.createObjectURL(file);
  }
  // Fundo branco: PNG com transparência viraria preto ao converter para JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  );
  return URL.createObjectURL(blob ?? file);
}

async function pick(useCamera: boolean): Promise<PickResult> {
  const file = await openFileDialog(useCamera);
  if (!file) return { status: 'canceled' };
  return { status: 'ok', uri: await toCompressedJpegUrl(file) };
}

export async function pickFromCamera(): Promise<PickResult> {
  return pick(true);
}

export async function pickFromLibrary(): Promise<PickResult> {
  return pick(false);
}

/**
 * Só o celular abre a câmera direto pelo atributo `capture`. No computador o
 * botão cai no seletor de arquivos — a tela usa isso para ajustar o rótulo.
 */
export const cameraIsDirect =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
