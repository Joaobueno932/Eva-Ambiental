// SDK 54: a API clássica (uploadAsync) vive em "expo-file-system/legacy".
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, PHOTO_BUCKET } from '@/lib/supabase';
import { ImageSource, WeighingPhoto } from '@/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface PhotoMeta {
  imageSource: ImageSource;
  gpsLat?: number | null;
  gpsLng?: number | null;
  manualLocation?: string | null;
  capturedAt?: string | null;
}

/**
 * Faz upload binário direto da imagem para o Supabase Storage usando
 * FileSystem.uploadAsync (mais confiável no React Native do que base64).
 * Caminho: weighing-photos/{weighing_id}/{timestamp}.jpg
 */
export async function uploadWeighingPhoto(weighingId: string, fileUri: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');

  const fileName = `${Date.now()}.jpg`;
  const path = `${weighingId}/${fileName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`;

  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
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
