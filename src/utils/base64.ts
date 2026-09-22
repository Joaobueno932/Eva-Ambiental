// Codificação/decodificação Base64 pura em JS — funciona no React Native/Expo
// sem depender de Buffer ou atob/btoa (indisponíveis no runtime do RN).

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Tabela reversa para decodificação (char code -> valor 0..63).
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS.charCodeAt(i)] = i;

/** Converte bytes em uma string Base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < len ? CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < len ? CHARS[b2 & 0x3f] : '=';
  }
  return out;
}

/** Converte uma string Base64 em bytes. Ignora quebras de linha e espaços. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, ''); // remove padding e ruído
  const len = clean.length;
  // Cada grupo de 4 chars → 3 bytes; um grupo final de 3 → 2 bytes; de 2 → 1 byte.
  const rem = len % 4;
  const byteLength = Math.floor(len / 4) * 3 + (rem === 3 ? 2 : rem === 2 ? 1 : 0);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e0 = LOOKUP[clean.charCodeAt(i)];
    const e1 = LOOKUP[clean.charCodeAt(i + 1)];
    const e2 = LOOKUP[clean.charCodeAt(i + 2)];
    const e3 = LOOKUP[clean.charCodeAt(i + 3)];

    if (p < byteLength) bytes[p++] = (e0 << 2) | (e1 >> 4);
    if (p < byteLength) bytes[p++] = ((e1 & 0x0f) << 4) | (e2 >> 2);
    if (p < byteLength) bytes[p++] = ((e2 & 0x03) << 6) | e3;
  }
  return bytes;
}
