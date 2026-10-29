import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/use-theme';
import {
  boundsOf,
  fallbackStyle,
  MARKER_EMOJI,
  type DeliveryMapProps,
  type MarkerKind,
  type PinPickerProps,
} from './types';

/** Mapa no navegador com maplibre-gl, mesma aparência do app nativo. */

function markerElement(kind: MarkerKind): HTMLElement {
  const el = document.createElement('div');
  el.textContent = MARKER_EMOJI[kind];
  Object.assign(el.style, {
    width: '36px',
    height: '36px',
    borderRadius: '18px',
    background: '#fff',
    border: `2px solid ${kind === 'courier' ? '#E8442E' : '#1B1B1F'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
  });
  return el;
}

function useMap(
  container: React.RefObject<HTMLDivElement | null>,
  options: Partial<maplibregl.MapOptions>,
): React.RefObject<MLMap | null> {
  const map = useRef<MLMap | null>(null);
  const { dark } = useTheme();
  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: env.mapStyleUrl,
      attributionControl: { compact: true },
      ...options,
    });
    map.current = m;
    // Sem tiles (rede bloqueada): troca para o fundo liso e mantém rota e marcadores.
    let fellBack = false;
    m.on('error', () => {
      if (fellBack || m.isStyleLoaded()) return;
      fellBack = true;
      m.setStyle(fallbackStyle(dark));
    });
    return () => {
      m.remove();
      map.current = null;
    };
    // O mapa é criado uma vez; mudanças de dados atualizam fontes e marcadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return map;
}

export function DeliveryMap({ markers, route, height = 260 }: DeliveryMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const first = markers[0]?.at ?? { lat: -23.5617, lng: -46.6883 };
  const map = useMap(container, { center: [first.lng, first.lat], zoom: 13 });
  const placed = useRef(new Map<string, Marker>());
  const fitted = useRef('');

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const mk of markers) {
      seen.add(mk.id);
      const existing = placed.current.get(mk.id);
      if (existing) existing.setLngLat([mk.at.lng, mk.at.lat]);
      else {
        const marker = new maplibregl.Marker({ element: markerElement(mk.kind) })
          .setLngLat([mk.at.lng, mk.at.lat])
          .addTo(m);
        placed.current.set(mk.id, marker);
      }
    }
    for (const [id, marker] of placed.current) {
      if (!seen.has(id)) {
        marker.remove();
        placed.current.delete(id);
      }
    }
    // Reenquadra só quando entram ou saem pontos, não a cada passo do entregador.
    const key = markers.map((mk) => mk.id).join(',');
    if (key !== fitted.current && markers.length > 0) {
      fitted.current = key;
      const [w, s, e, n] = boundsOf(markers.map((mk) => mk.at));
      m.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, duration: 600, maxZoom: 16 },
      );
    }
  }, [markers, map]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const data: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route && route.length > 1 ? route : [] },
      };
      const source = m.getSource('route') as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        m.addSource('route', { type: 'geojson', data });
        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#E8442E', 'line-width': 4, 'line-opacity': 0.85 },
        });
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once('load', draw);
    // Ao trocar o estilo (fundo liso), a fonte da rota some e é desenhada de novo.
    const redraw = () => {
      if (!m.getSource('route')) draw();
    };
    m.on('styledata', redraw);
    return () => void m.off('styledata', redraw);
  }, [route, map]);

  return (
    <View style={[styles.wrap, { height }]}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}

export function PinPicker({ value, onChange, height = 220 }: PinPickerProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useMap(container, { center: [value.lng, value.lat], zoom: 16 });
  const marker = useRef<Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const mk = new maplibregl.Marker({
      element: markerElement('home'),
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([value.lng, value.lat])
      .addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLngLat();
      change.current({ lat: p.lat, lng: p.lng });
    });
    m.on('click', (e) => change.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    marker.current = mk;
    return () => void mk.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    marker.current?.setLngLat([value.lng, value.lat]);
    map.current?.easeTo({ center: [value.lng, value.lat], duration: 300 });
  }, [value.lat, value.lng, map]);

  return (
    <View style={[styles.wrap, { height }]}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
});
