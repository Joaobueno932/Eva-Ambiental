/**
 * Seleção de imagem (câmera ou galeria) independente de plataforma.
 *
 * No aplicativo usa o expo-image-picker, que já pede as permissões do sistema
 * e comprime o JPEG. A versão web (`imagePicker.web.ts`) usa um input de
 * arquivo, porque `launchCameraAsync` não existe no navegador.
 */
import * as ImagePicker from 'expo-image-picker';

export type PickStatus = 'ok' | 'canceled' | 'denied';

export interface PickResult {
  status: PickStatus;
  uri?: string;
}

/** Qualidade do JPEG — mesmo valor nas duas plataformas. */
const QUALITY = 0.6;

export async function pickFromCamera(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  const result = await ImagePicker.launchCameraAsync({
    quality: QUALITY,
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets?.[0]) return { status: 'canceled' };
  return { status: 'ok', uri: result.assets[0].uri };
}

export async function pickFromLibrary(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: QUALITY,
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets?.[0]) return { status: 'canceled' };
  return { status: 'ok', uri: result.assets[0].uri };
}

/** No aplicativo a câmera é sempre o caminho direto de captura. */
export const cameraIsDirect = true;
