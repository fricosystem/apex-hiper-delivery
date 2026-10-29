import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/use-theme';
import { MarkerBubble } from './marker';
import { boundsOf, fallbackStyle, type DeliveryMapProps, type PinPickerProps } from './types';

/** Estilo do mapa com troca para o fundo liso se os tiles não carregarem. */
function useMapStyle() {
  const { dark } = useTheme();
  const [style, setStyle] = useState<string | ReturnType<typeof fallbackStyle>>(env.mapStyleUrl);
  return { mapStyle: style, onDidFailLoadingMap: () => setStyle(fallbackStyle(dark)) };
}

/** Mapa (MapLibre nativo, tiles do OpenStreetMap) com loja, cliente, entregador e rota. */
export function DeliveryMap({ markers, route, height = 260 }: DeliveryMapProps) {
  const style = useMapStyle();
  const points = markers.map((m) => m.at);
  return (
    <View style={[styles.wrap, { height }]}>
      <Map style={StyleSheet.absoluteFill} {...style} compass={false} logo={false}>
        {points.length > 0 ? (
          <Camera
            bounds={boundsOf(points)}
            padding={{ top: 40, bottom: 40, left: 40, right: 40 }}
            duration={600}
          />
        ) : null}
        {route && route.length > 1 ? (
          <GeoJSONSource
            id="route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route },
            }}
          >
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#E8442E', 'line-width': 4, 'line-opacity': 0.85 }}
            />
          </GeoJSONSource>
        ) : null}
        {markers.map((m) => (
          <ViewAnnotation key={m.id} id={m.id} lngLat={[m.at.lng, m.at.lat]}>
            <MarkerBubble kind={m.kind} />
          </ViewAnnotation>
        ))}
      </Map>
    </View>
  );
}

/** Mapa para o cliente ajustar o ponto de entrega tocando no lugar certo. */
export function PinPicker({ value, onChange, height = 220 }: PinPickerProps) {
  const style = useMapStyle();
  return (
    <View style={[styles.wrap, { height }]}>
      <Map
        style={StyleSheet.absoluteFill}
        {...style}
        compass={false}
        logo={false}
        onPress={(e) => {
          const [lng, lat] = e.nativeEvent.lngLat;
          onChange({ lat, lng });
        }}
      >
        <Camera initialViewState={{ center: [value.lng, value.lat], zoom: 16 }} />
        <ViewAnnotation id="pin" lngLat={[value.lng, value.lat]} anchor="bottom">
          <MarkerBubble kind="home" />
        </ViewAnnotation>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden' },
});
