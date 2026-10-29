import type { LatLng } from '@hiper/shared';

export type MarkerKind = 'store' | 'home' | 'courier';

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  at: LatLng;
}

export interface DeliveryMapProps {
  markers: MapMarker[];
  /** Pontos [lng, lat] da rota da loja ao cliente. */
  route?: Array<[number, number]> | null;
  height?: number;
}

export interface PinPickerProps {
  value: LatLng;
  onChange: (value: LatLng) => void;
  height?: number;
}

export const MARKER_EMOJI: Record<MarkerKind, string> = {
  store: '🏪',
  home: '🏠',
  courier: '🛵',
};

/** Caixa [oeste, sul, leste, norte] que mostra todos os pontos com folga. */
export function boundsOf(points: LatLng[]): [number, number, number, number] {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const pad = 0.0015;
  return [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ];
}

/**
 * Estilo sem fontes externas, usado quando os tiles não carregam (sem rede ou
 * bloqueados): o mapa continua mostrando a rota e os marcadores sobre um fundo
 * liso.
 */
export function fallbackStyle(dark: boolean) {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: 'fundo',
        type: 'background' as const,
        paint: { 'background-color': dark ? '#26262B' : '#ECE8E1' },
      },
    ],
  };
}
