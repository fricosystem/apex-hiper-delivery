import { estimateRoadKm, type LatLng } from '@hiper/shared';
import { env } from '@/lib/env';

export interface Route {
  distanceKm: number;
  /** Pontos [lng, lat] da rota, para desenhar no mapa. */
  coordinates: Array<[number, number]>;
  /** false quando o roteador não respondeu e a rota é uma estimativa em linha reta. */
  routed: boolean;
}

/** Rota de carro entre a loja e o cliente pelo OSRM, com estimativa se falhar. */
export async function route(from: LatLng, to: LatLng): Promise<Route> {
  try {
    const url = `${env.osrmUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const body = (await res.json()) as {
        routes?: Array<{ distance: number; geometry: { coordinates: Array<[number, number]> } }>;
      };
      const r = body.routes?.[0];
      if (r) {
        return {
          distanceKm: Math.round(r.distance / 10) / 100,
          coordinates: r.geometry.coordinates,
          routed: true,
        };
      }
    }
  } catch {
    // Cai na estimativa abaixo.
  }
  return {
    distanceKm: estimateRoadKm(from, to),
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    routed: false,
  };
}

/** Ponto a uma fração (0 a 1) do caminho, para simular o entregador. */
export function pointAlong(coords: Array<[number, number]>, fraction: number): LatLng {
  if (coords.length === 1 || fraction <= 0) return { lng: coords[0]![0], lat: coords[0]![1] };
  const seg = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const lengths = coords.slice(1).map((c, i) => seg(coords[i]!, c));
  const total = lengths.reduce((s, l) => s + l, 0);
  let target = Math.min(1, fraction) * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (target <= l || i === lengths.length - 1) {
      const t = l === 0 ? 0 : Math.min(1, target / l);
      const a = coords[i]!;
      const b = coords[i + 1]!;
      return { lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t };
    }
    target -= l;
  }
  const last = coords[coords.length - 1]!;
  return { lng: last[0], lat: last[1] };
}
