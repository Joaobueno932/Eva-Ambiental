import { supabase, PHOTO_BUCKET } from '@/lib/supabase';
import { ImageSource, LocationColumns, WeighingPhoto } from '@/types';
import { uploadBinaryFromUri, fetchBytes } from '@/utils/binary';
import { saveBytesFile } from '@/utils/fileSaver';
import { buildZip, ZipEntry } from '@/utils/zip';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface PhotoMeta extends LocationColumns {
  imageSource: ImageSource;
  gpsLat?: number | null;
  gpsLng?: number | null;
  manualLocation?: string | null;
  capturedAt?: string | null;
}

/**
 * Faz upload binário direto da imagem para o Supabase Storage.
 * Caminho: weighing-photos/{weighing_id}/{timestamp}.jpg
 *
 * O envio em si é delegado a `@/utils/binary`, que usa o FileSystem no
 * aplicativo e o fetch com Blob no navegador. Em ambos os casos a imagem já
 * chega aqui como JPEG comprimido, vinda do seletor de imagens.
 */
export async function uploadWeighingPhoto(weighingId: string, fileUri: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');

  const fileName = `${Date.now()}.jpg`;
  const path = `${weighingId}/${fileName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`;

  const result = await uploadBinaryFromUri(uploadUrl, fileUri, {
    Authorization: `Bearer ${accessToken}`,
    apikey: ANON_KEY,
    'Content-Type': 'image/jpeg',
    'x-upsert': 'true',
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Falha ao enviar a foto (HTTP ${result.status}). ${result.body ?? ''}`);
  }

  return path;
}

/** Registra a foto na tabela weighing_photos. */
export async function insertPhotoRecord(weighingId: string, storagePath: string, meta: PhotoMeta) {
  const { error } = await supabase.from('weighing_photos').insert({
    weighing_id: weighingId,
    storage_path: storagePath,
    image_source: meta.imageSource,
    gps_lat: meta.gpsLat ?? null,
    gps_lng: meta.gpsLng ?? null,
    manual_location: meta.manualLocation ?? null,
    captured_at: meta.capturedAt ?? null,
    location_place_name: meta.location_place_name ?? null,
    location_street: meta.location_street ?? null,
    location_number: meta.location_number ?? null,
    location_neighborhood: meta.location_neighborhood ?? null,
    location_postal_code: meta.location_postal_code ?? null,
    location_city: meta.location_city ?? null,
    location_state: meta.location_state ?? null,
    location_country: meta.location_country ?? null,
    location_formatted_address: meta.location_formatted_address ?? null,
  });
  if (error) throw error;
}

/** Lista fotos de uma pesagem já com URLs assinadas (bucket privado). */
export async function listWeighingPhotos(weighingId: string): Promise<WeighingPhoto[]> {
  const { data, error } = await supabase
    .from('weighing_photos')
    .select('*')
    .eq('weighing_id', weighingId)
    .order('created_at');
  if (error) throw error;

  const photos = (data ?? []) as WeighingPhoto[];
  await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(p.storage_path, 60 * 60); // 1h
      p.public_url = signed?.signedUrl ?? null;
    })
  );
  return photos;
}

export type PhotoDownloadResult = 'shared' | 'empty' | 'unavailable';

/**
 * Entrega as fotos de uma pesagem ao usuário.
 * - 1 foto  → o arquivo direto.
 * - N fotos → um ZIP com nomes organizados (pesagem_<id>_foto_01.jpg).
 *
 * No aplicativo abre o compartilhamento do sistema; no navegador baixa o
 * arquivo. Regera URLs assinadas frescas a partir dos storage_path para evitar
 * links expirados. O bucket é privado — o acesso continua regido pelas RLS.
 */
export async function downloadWeighingPhotos(weighingId: string): Promise<PhotoDownloadResult> {
  const { data, error } = await supabase
    .from('weighing_photos')
    .select('storage_path')
    .eq('weighing_id', weighingId)
    .order('created_at');
  if (error) throw error;

  const rows = (data ?? []) as { storage_path: string }[];
  if (rows.length === 0) return 'empty';

  const shortId = weighingId.slice(0, 8);
  const files: { name: string; bytes: Uint8Array }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(rows[i].storage_path, 60 * 10); // 10 min
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Não foi possível gerar o link da foto ${i + 1}.`);
    }

    const ext = rows[i].storage_path.split('.').pop()?.toLowerCase() || 'jpg';
    const name = `pesagem_${shortId}_foto_${String(i + 1).padStart(2, '0')}.${ext}`;
    files.push({ name, bytes: await fetchBytes(signed.signedUrl) });
  }

  // Uma única foto: entrega o arquivo direto, sem embrulhar em ZIP.
  if (files.length === 1) {
    const res = await saveBytesFile(files[0].bytes, files[0].name, 'image/jpeg', 'Foto da pesagem');
    return res === 'saved' ? 'shared' : 'unavailable';
  }

  const entries: ZipEntry[] = files.map((f) => ({ name: f.name, data: f.bytes }));
  const res = await saveBytesFile(
    buildZip(entries),
    `pesagem_${shortId}_fotos.zip`,
    'application/zip',
    'Fotos da pesagem'
  );
  return res === 'saved' ? 'shared' : 'unavailable';
}
