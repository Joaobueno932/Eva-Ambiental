import * as Location from 'expo-location';
import { LocationColumns, LocationDetails } from '@/types';

/** Solicita permissão de localização (foreground). */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/** Captura latitude/longitude atuais. Retorna null em caso de falha. */
export async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Reverse geocoding: transforma coordenadas em campos de endereço. */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<Partial<LocationDetails>> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const a = results?.[0];
    if (!a) return {};

    const details: Partial<LocationDetails> = {
      placeName: a.name ?? null,
      street: a.street ?? a.name ?? null,
      number: a.streetNumber ?? null,
      neighborhood: a.district ?? a.subregion ?? null,
      postalCode: a.postalCode ?? null,
      city: a.city ?? a.subregion ?? null,
      state: a.region ?? null,
      country: a.country ?? null,
    };
    // Usa o formattedAddress nativo se vier; senão monta com o helper.
    details.formattedAddress = (a as any).formattedAddress ?? formatAddress(details);
    // Se não houver nome de local explícito, tenta o melhor campo disponível.
    if (!details.placeName) {
      details.placeName = a.street ?? a.district ?? a.subregion ?? a.region ?? null;
    }
    return details;
  } catch {
    return {};
  }
}

/** Monta um endereço formatado a partir dos campos disponíveis. */
export function formatAddress(d: Partial<LocationDetails>): string | null {
  const line1Parts: string[] = [];
  if (d.street) line1Parts.push(d.number ? `${d.street}, nº ${d.number}` : d.street);
  if (d.neighborhood) line1Parts.push(d.neighborhood);
  const line1 = line1Parts.join(' - ');

  const cityState = [d.city, d.state].filter(Boolean).join(' - ');
  const parts = [line1, cityState, d.postalCode].filter((p) => p && p.length > 0);
  const result = parts.join(', ');
  return result.length > 0 ? result : null;
}

export interface CaptureResult {
  /** permissão concedida pelo usuário */
  permissionGranted: boolean;
  /** localização capturada (com ao menos lat/lng) ou null */
  location: LocationDetails | null;
  /** true se o endereço (reverse geocode) foi resolvido */
  addressResolved: boolean;
}

export type CapturePhase = 'coords' | 'address';

/**
 * Fluxo completo: permissão → coordenadas → reverse geocode.
 * Não trava o app: cada etapa falha graciosamente.
 */
export async function captureLocationDetails(
  onPhase?: (phase: CapturePhase) => void
): Promise<CaptureResult> {
  const permissionGranted = await requestLocationPermission();
  if (!permissionGranted) {
    return { permissionGranted: false, location: null, addressResolved: false };
  }

  onPhase?.('coords');
  const coords = await getCurrentCoordinates();
  if (!coords) {
    return { permissionGranted: true, location: null, addressResolved: false };
  }

  const capturedAt = new Date().toISOString();

  onPhase?.('address');
  const address = await reverseGeocodeLocation(coords.latitude, coords.longitude);
  const addressResolved = !!(address.formattedAddress || address.placeName || address.city);

  return {
    permissionGranted: true,
    location: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      capturedAt,
      ...address,
    },
    addressResolved,
  };
}

/** Converte LocationDetails nas colunas persistidas no banco (sem lat/lng). */
export function locationToColumns(loc?: Partial<LocationDetails> | null): LocationColumns {
  return {
    location_place_name: loc?.placeName ?? null,
    location_street: loc?.street ?? null,
    location_number: loc?.number ?? null,
    location_neighborhood: loc?.neighborhood ?? null,
    location_postal_code: loc?.postalCode ?? null,
    location_city: loc?.city ?? null,
    location_state: loc?.state ?? null,
    location_country: loc?.country ?? null,
    location_formatted_address: loc?.formattedAddress ?? null,
  };
}

/** Resumo curto do local para exibir na UI. */
export function shortLocationSummary(loc?: Partial<LocationDetails> | null): string | null {
  if (!loc) return null;
  if (loc.formattedAddress) return loc.formattedAddress;
  const parts = [loc.street ?? loc.placeName, loc.neighborhood, [loc.city, loc.state].filter(Boolean).join(' - ')]
    .filter(Boolean);
  const s = parts.join(' - ');
  return s.length > 0 ? s : null;
}
