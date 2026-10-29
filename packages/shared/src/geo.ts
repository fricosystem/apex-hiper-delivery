/** Ponto no mapa em graus decimais. */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distância em linha reta entre dois pontos, em km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distância de rua estimada quando o roteador (OSRM) não responde: a linha
 * reta vezes um fator típico de malha urbana.
 */
export const ROAD_FACTOR = 1.3;

export function estimateRoadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_FACTOR * 100) / 100;
}
