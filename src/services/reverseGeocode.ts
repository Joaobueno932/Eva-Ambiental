/**
 * Conversão de coordenadas em endereço.
 *
 * No aplicativo quem resolve é o geocodificador do próprio sistema operacional,
 * via expo-location. No navegador esse módulo não existe — a versão
 * `reverseGeocode.web.ts` usa um serviço externo.
 */
import * as Location from 'expo-location';
import { LocationDetails } from '@/types';

export interface RawAddress {
  placeName?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
}

/** Retorna o endereço das coordenadas, ou {} quando não for possível. */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Partial<LocationDetails>> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const a = results?.[0];
  if (!a) return {};

  return {
    placeName: a.name ?? null,
    street: a.street ?? a.name ?? null,
    number: a.streetNumber ?? null,
    neighborhood: a.district ?? a.subregion ?? null,
    postalCode: a.postalCode ?? null,
    city: a.city ?? a.subregion ?? null,
    state: a.region ?? null,
    country: a.country ?? null,
    formattedAddress: (a as any).formattedAddress ?? null,
  };
}
