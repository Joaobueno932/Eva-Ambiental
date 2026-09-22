// Escritor de arquivos ZIP puro em JS (método "store", sem compressão) —
// compatível com Expo/React Native, sem dependências nativas. Fotos JPEG já são
// comprimidas, então o método "store" produz um .zip válido e leve.

import { bytesToBase64 } from './base64';

export interface ZipEntry {
  /** Nome do arquivo dentro do ZIP (ASCII). */
  name: string;
  /** Conteúdo do arquivo. */
  data: Uint8Array;
}

// Tabela CRC32 pré-computada (polinômio 0xEDB88320).
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** Concatena vários Uint8Array em um só. */
function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Monta o ZIP e retorna os bytes brutos. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = asciiBytes(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes) + nome + dados.
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // assinatura
    lv.setUint16(4, 20, true); // versão necessária
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // método (0 = store)
    lv.setUint16(10, 0, true); // hora
    lv.setUint16(12, 0x21, true); // data (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // tamanho comprimido
    lv.setUint32(22, size, true); // tamanho original
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra field
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    // Central directory header (46 bytes) + nome.
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); // assinatura
    cv.setUint16(4, 20, true); // versão criadora
    cv.setUint16(6, 20, true); // versão necessária
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // método
    cv.setUint16(12, 0, true); // hora
    cv.setUint16(14, 0x21, true); // data
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comentário
    cv.setUint16(34, 0, true); // disco inicial
    cv.setUint16(36, 0, true); // atributos internos
    cv.setUint32(38, 0, true); // atributos externos
    cv.setUint32(42, offset, true); // offset do local header
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + entry.data.length;
  }

  const centralBytes = concat(central);
  const centralOffset = offset;

  // End of central directory record (22 bytes).
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // disco atual
  ev.setUint16(6, 0, true); // disco do início do CD
  ev.setUint16(8, entries.length, true); // entradas neste disco
  ev.setUint16(10, entries.length, true); // total de entradas
  ev.setUint32(12, centralBytes.length, true); // tamanho do CD
  ev.setUint32(16, centralOffset, true); // offset do CD
  ev.setUint16(20, 0, true); // comentário

  return concat([...chunks, centralBytes, end]);
}

/** Monta o ZIP e retorna já em Base64 (para gravar com expo-file-system). */
export function buildZipBase64(entries: ZipEntry[]): string {
  return bytesToBase64(buildZip(entries));
}
