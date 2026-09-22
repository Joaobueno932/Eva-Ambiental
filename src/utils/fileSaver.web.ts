/**
 * Versão web da entrega de arquivos: em vez da folha de compartilhamento do
 * sistema, o navegador baixa o arquivo.
 *
 * O download é feito com um link temporário (`<a download>`) apontando para um
 * object URL. É o caminho que funciona igual em Chrome, Firefox e Safari — sem
 * depender da File System Access API, que o Firefox e o Safari não têm.
 */
import { base64ToBytes, bytesToBase64 } from './base64';

export type SaveResult = 'saved' | 'unavailable';

/** Dispara o download de um Blob com o nome informado. */
function downloadBlob(blob: Blob, fileName: string): SaveResult {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Espera o navegador iniciar o download antes de liberar a memória.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}

export async function saveBase64File(
  base64: string,
  fileName: string,
  mimeType: string,
  _dialogTitle?: string
): Promise<SaveResult> {
  const bytes = base64ToBytes(base64);
  return downloadBlob(new Blob([bytes as unknown as BlobPart], { type: mimeType }), fileName);
}

export async function saveBytesFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  _dialogTitle?: string
): Promise<SaveResult> {
  return downloadBlob(new Blob([bytes as unknown as BlobPart], { type: mimeType }), fileName);
}

export async function saveTextFile(
  text: string,
  fileName: string,
  mimeType: string,
  _dialogTitle?: string
): Promise<SaveResult> {
  // BOM para o Excel abrir o CSV em UTF-8 e não quebrar os acentos.
  const needsBom = mimeType.startsWith('text/csv');
  const blob = new Blob([needsBom ? '\uFEFF' + text : text], { type: `${mimeType};charset=utf-8` });
  return downloadBlob(blob, fileName);
}

/**
 * PDF no navegador.
 *
 * Não existe equivalente ao `expo-print` do lado web: o caminho nativo é a
 * caixa de impressão, onde o usuário escolhe "Salvar como PDF". O relatório é
 * renderizado em um iframe oculto para que só ele seja impresso — a página do
 * sistema em volta fica de fora.
 */
export async function savePdfFromHtml(
  html: string,
  fileName: string,
  _dialogTitle?: string
): Promise<SaveResult> {
  return new Promise<SaveResult>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // Fora da tela em vez de display:none — o Safari não imprime iframe oculto.
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        resolve('unavailable');
        return;
      }
      // O nome sugerido na caixa de impressão vem do <title> do documento.
      try {
        win.document.title = fileName.replace(/\.pdf$/i, '');
      } catch {
        /* documento de outra origem não deve acontecer aqui — segue assim mesmo */
      }
      win.focus();
      win.print();
      // A impressão é modal e síncrona na maioria dos navegadores, mas o
      // Safari retorna antes; a folga evita remover o iframe cedo demais.
      setTimeout(cleanup, 60_000);
      resolve('saved');
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      resolve('unavailable');
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}

export { base64ToBytes, bytesToBase64 };
