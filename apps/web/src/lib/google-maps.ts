/**
 * Google Maps Platform en el checkout: autocompletado de la dirección (Places API New) y un
 * mapa con un pin que se puede mover. Solo se carga si hay clave (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
 * sin clave, el formulario es el de siempre (carga manual). DECISIONS 234.
 *
 * No se agrega @types/google.maps: se tipa solo lo que se usa.
 */

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
/** Map ID para el pin avanzado; "DEMO_MAP_ID" sirve mientras no haya uno propio. */
export const MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AddressComponent {
  longText: string | null;
  shortText: string | null;
  types: string[];
}

export interface PlacePredictionLike {
  placeId: string;
  mainText: { text: string } | null;
  secondaryText: { text: string } | null;
  toPlace: () => PlaceLike;
}

export interface PlaceLike {
  id: string;
  addressComponents?: AddressComponent[] | null;
  location?: { lat: () => number; lng: () => number } | null;
  fetchFields: (options: { fields: string[] }) => Promise<unknown>;
}

interface PlacesLibrary {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      sessionToken: object;
      includedRegionCodes: string[];
      language: string;
    }) => Promise<{ suggestions: { placePrediction: PlacePredictionLike | null }[] }>;
  };
}

export interface MapLike {
  setCenter: (position: LatLng) => void;
}

export interface MarkerLike {
  position: LatLng | { lat: () => number; lng: () => number } | null;
  addListener: (event: string, handler: () => void) => void;
}

interface MapsLibrary {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapLike;
}

interface MarkerLibrary {
  AdvancedMarkerElement: new (options: Record<string, unknown>) => MarkerLike;
}

interface GoogleMaps {
  importLibrary: (name: 'places' | 'maps' | 'marker') => Promise<unknown>;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
    __storynidoMapsReady?: () => void;
  }
}

let loading: Promise<GoogleMaps> | null = null;

/** Carga el script de Maps una sola vez (con `loading=async`, como pide Google). */
export function loadGoogleMaps(language: string): Promise<GoogleMaps> {
  if (!MAPS_API_KEY) return Promise.reject(new Error('Sin clave de Google Maps'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  loading ??= new Promise<GoogleMaps>((resolve, reject) => {
    window.__storynidoMapsReady = () => {
      const maps = window.google?.maps;
      if (maps) resolve(maps);
      else reject(new Error('Google Maps no cargó'));
    };
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: MAPS_API_KEY,
      v: 'weekly',
      loading: 'async',
      language,
      callback: '__storynidoMapsReady',
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('Google Maps no cargó'));
    };
    document.head.append(script);
  });
  return loading;
}

export async function placesLibrary(language: string): Promise<PlacesLibrary> {
  return (await (await loadGoogleMaps(language)).importLibrary('places')) as PlacesLibrary;
}

export async function mapLibraries(
  language: string,
): Promise<{ maps: MapsLibrary; marker: MarkerLibrary }> {
  const google = await loadGoogleMaps(language);
  const [maps, marker] = await Promise.all([
    google.importLibrary('maps'),
    google.importLibrary('marker'),
  ]);
  return { maps: maps as MapsLibrary, marker: marker as MarkerLibrary };
}

/** Lo que el autocompletado completa en el formulario. */
export interface ParsedAddress {
  line1: string;
  /** La sugerencia no trae número de puerta (pasa con avenidas y rutas): hay que pedirlo. */
  missingNumber: boolean;
  city: string;
  state: string | null;
  postalCode: string;
  country: string | null;
}

/** Países donde el número va antes de la calle ("350 5th Ave"). */
const NUMBER_FIRST = new Set(['US', 'CA', 'AU', 'GB', 'IE', 'NZ', 'PH']);
/** Países donde la imprenta pide el código del estado (TX, SP, RM), no el nombre. */
const STATE_CODE = new Set(['US', 'BR', 'CL']);

/** Pasa los componentes de Google a los campos de la dirección de StoryNido. */
export function parseAddressComponents(components: readonly AddressComponent[]): ParsedAddress {
  const find = (type: string) => components.find((component) => component.types.includes(type));
  const long = (type: string) => find(type)?.longText ?? '';
  const country = find('country')?.shortText ?? null;
  const route = long('route');
  const number = long('street_number');
  const line1 =
    route && number
      ? NUMBER_FIRST.has(country ?? '')
        ? `${number} ${route}`
        : `${route} ${number}`
      : route || long('premise') || long('point_of_interest');
  // Ciudad: localidad; si no hay (barrios de CABA, partidos del conurbano), la más chica que haya.
  const city =
    long('locality') ||
    long('postal_town') ||
    long('administrative_area_level_3') ||
    long('administrative_area_level_2') ||
    long('sublocality_level_1') ||
    long('sublocality');
  const stateComponent = find('administrative_area_level_1');
  const state =
    (STATE_CODE.has(country ?? '') ? stateComponent?.shortText : stateComponent?.longText) ?? null;
  const postal = long('postal_code');
  const suffix = long('postal_code_suffix');
  return {
    line1,
    missingNumber: Boolean(route) && !number,
    city,
    state,
    // Argentina: Google a veces da solo "C1425" y el sufijo aparte ("ABC"): se arma el CPA.
    postalCode:
      country === 'AR' && suffix && /^[A-Z]\d{4}$/.test(postal) ? postal + suffix : postal,
    country,
  };
}

/** Distancia en metros entre dos puntos (para saber cuánto se movió el pin). */
export function metersBetween(a: LatLng, b: LatLng): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
