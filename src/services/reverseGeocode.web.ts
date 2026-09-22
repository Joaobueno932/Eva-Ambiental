/**
 * Conversão de coordenadas em endereço no navegador.
 *
 * O `Location.reverseGeocodeAsync` do expo-location não tem implementação web,
 * e o navegador sozinho só devolve latitude/longitude. Para que a evidência da
 * pesagem continue trazendo o endereço, a consulta vai para o Nominatim
 * (OpenStreetMap) — mesmo papel que o geocodificador do celular cumpre no app.
 *
 * ATENÇÃO — as coordenadas da pesagem saem para um serviço externo (OSM).
 * Se isso não for aceitável, basta trocar o corpo de `reverseGeocode` por
 * `return {}`: o fluxo continua funcionando, apenas sem endereço automático
 * (a tela oferece o preenchimento manual).
 */
import { LocationDetails } from '@/types';

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
/** O Nominatim é um serviço comunitário: sem timeout, a tela ficaria presa. */
const TIMEOUT_MS = 8000;

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Partial<LocationDetails>> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
    if (!res.ok) return {};
    const data = await res.json();
    const a = data?.address;
    if (!a) return {};

    return {
      placeName: a.amenity ?? a.building ?? a.shop ?? data.name ?? null,
      street: a.road ?? null,
      number: a.house_number ?? null,
      neighborhood: a.suburb ?? a.neighbourhood ?? a.city_district ?? null,
      postalCode: a.postcode ?? null,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      state: a.state ?? null,
      country: a.country ?? null,
      formattedAddress: data.display_name ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
