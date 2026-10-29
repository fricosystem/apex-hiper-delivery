import {
  isOrderActive,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
} from '@hiper/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DeliveryMap } from '@/components/map/delivery-map';
import type { MapMarker } from '@/components/map/types';
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  Icon,
  Loading,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { data, type OrderEntry, type PositionEntry } from '@/data';
import { brl, formatDateTime, formatPhone, formatQuantity, formatTime } from '@/lib/format';
import { route as fetchRoute } from '@/services/routing';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const STATUS_HINT: Partial<Record<OrderStatus, string>> = {
  pending: 'A loja vai confirmar seu pedido em instantes.',
  accepted: 'A loja confirmou e já vai começar.',
  preparing: 'Seu pedido está sendo preparado.',
  ready: 'Pronto! Pode vir buscar na loja.',
  dispatched: 'O entregador está a caminho.',
  delivered: 'Pedido entregue. Bom apetite!',
  cancelled: 'Este pedido foi cancelado.',
  rejected: 'A loja não pôde aceitar este pedido.',
};

/**
 * Acompanhamento: escuta em tempo real um único documento (o pedido) só
 * enquanto ele está ativo e a tela aberta; a posição do entregador só durante
 * a entrega. Ao sair da tela ou o pedido terminar, as escutas são desligadas.
 */
export default function OrderScreen() {
  const { tenantId, orderId } = useLocalSearchParams<{ tenantId: string; orderId: string }>();
  const theme = useTheme();
  const [order, setOrder] = useState<OrderEntry | null | undefined>(undefined);
  const [position, setPosition] = useState<PositionEntry | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<[number, number]> | null>(null);

  const active = order ? isOrderActive(order.status) : false;

  useEffect(() => {
    let stop: (() => void) | null = null;
    void data()
      .getOrder(tenantId, orderId)
      .then((first) => {
        setOrder(first);
        if (first && isOrderActive(first.status)) {
          stop = data().watchOrder(tenantId, orderId, (o) => {
            setOrder(o);
            if (o && !isOrderActive(o.status)) {
              stop?.();
              stop = null;
            }
          });
        }
      })
      .catch(() => setOrder(null));
    return () => stop?.();
  }, [tenantId, orderId]);

  const dispatched = order?.status === 'dispatched';
  useEffect(() => {
    if (!dispatched) return;
    return data().watchCourierPosition(tenantId, orderId, setPosition);
  }, [dispatched, tenantId, orderId]);

  const from = order?.storeLocation;
  const to = order?.address?.location;
  useEffect(() => {
    if (!from || !to || !active || order?.fulfillment !== 'delivery') return;
    void fetchRoute(from, to).then((r) => setRouteCoords(r.coordinates));
    // A rota não muda depois do pedido criado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng, active]);

  if (order === undefined) return <Loading label="Carregando o pedido" />;
  if (order === null) return <EmptyState icon="receipt-outline" title="Pedido não encontrado" />;

  const steps = ORDER_TIMELINE[order.fulfillment];
  const failed = order.status === 'cancelled' || order.status === 'rejected';
  const reached = new Map(order.history.map((h) => [h.status, h.atMs]));
  const currentIndex = steps.indexOf(order.status);
  const etaAt = order.etaMinutes ? order.createdAtMs + order.etaMinutes * 60_000 : null;

  const markers: MapMarker[] = [
    ...(order.storeLocation
      ? [{ id: 'store', kind: 'store' as const, at: order.storeLocation }]
      : []),
    ...(order.address ? [{ id: 'home', kind: 'home' as const, at: order.address.location }] : []),
    ...(dispatched && position ? [{ id: 'courier', kind: 'courier' as const, at: position }] : []),
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: `Pedido #${order.number}` }} />
      <Card
        style={{
          backgroundColor: failed ? theme.dangerSoft : active ? theme.brandSoft : theme.successSoft,
          borderColor: 'transparent',
        }}
      >
        <Text variant="label" color="textSecondary">
          {order.storeName.toUpperCase()}
        </Text>
        <Text variant="heading" style={{ marginTop: 2 }}>
          {ORDER_STATUS_LABELS[order.status]}
        </Text>
        <Text color="textSecondary">{STATUS_HINT[order.status]}</Text>
        {active && etaAt ? (
          <View style={styles.eta}>
            <Icon name="time-outline" size={18} color="text" />
            <Text variant="bodyStrong">
              Previsão: {order.fulfillment === 'delivery' ? 'chega' : 'pronto'} até{' '}
              {formatTime(etaAt)}
            </Text>
          </View>
        ) : null}
      </Card>

      {order.fulfillment === 'delivery' && markers.length > 0 && active ? (
        <View style={{ marginTop: Spacing.lg }}>
          <DeliveryMap markers={markers} route={routeCoords} height={240} />
        </View>
      ) : null}

      {order.courier && active ? (
        <Card style={{ marginTop: Spacing.lg }}>
          <View style={styles.inline}>
            <Text style={{ fontSize: 28 }}>🛵</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{order.courier.name}</Text>
              <Text variant="caption" color="textSecondary">
                {order.courier.vehicle ?? 'Entregador'}
                {order.courier.phone ? ` · ${formatPhone(order.courier.phone)}` : ''}
              </Text>
            </View>
            {position ? <Badge label="Ao vivo" tone="success" /> : null}
          </View>
        </Card>
      ) : null}

      {!failed ? (
        <>
          <SectionTitle>Andamento</SectionTitle>
          <Card>
            {steps.map((s, i) => {
              const done = i <= currentIndex;
              const at = reached.get(s);
              return (
                <View key={s} style={styles.step}>
                  <View style={styles.rail}>
                    <View
                      style={[styles.dot, { backgroundColor: done ? theme.brand : theme.border }]}
                    >
                      {done ? <Icon name="checkmark" size={12} color="onBrand" /> : null}
                    </View>
                    {i < steps.length - 1 ? (
                      <View
                        style={[
                          styles.line,
                          { backgroundColor: i < currentIndex ? theme.brand : theme.border },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.stepText}>
                    <Text
                      variant={i === currentIndex ? 'bodyStrong' : 'body'}
                      color={done ? 'text' : 'textMuted'}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </Text>
                    {at ? (
                      <Text variant="caption" color="textMuted">
                        {formatTime(at)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>Itens</SectionTitle>
      <Card>
        {order.lines.map((l, i) => (
          <View key={`${l.productId}-${i}`} style={styles.itemRow}>
            <Text style={{ minWidth: 44 }} color="textSecondary">
              {l.saleUnit === 'un'
                ? `${l.quantity}x`
                : formatQuantity(l.quantity, l.saleUnit as 'kg')}
            </Text>
            <View style={{ flex: 1 }}>
              <Text>{l.name}</Text>
              {l.options.length ? (
                <Text variant="caption" color="textSecondary">
                  {l.options.map((o) => o.name).join(', ')}
                </Text>
              ) : null}
              {l.notes ? (
                <Text variant="caption" color="textMuted">
                  Obs.: {l.notes}
                </Text>
              ) : null}
            </View>
            <Text>{brl(l.totalCents)}</Text>
          </View>
        ))}
        <Divider />
        <Row label="Subtotal" value={brl(order.subtotalCents)} />
        <Row
          label="Entrega"
          value={order.deliveryFeeCents === 0 ? 'Grátis' : brl(order.deliveryFeeCents)}
        />
        <Row label="Total" value={brl(order.totalCents)} strong />
      </Card>

      <SectionTitle>Detalhes</SectionTitle>
      <Card>
        <Row label="Feito em" value={formatDateTime(order.createdAtMs)} />
        <Row
          label="Pagamento"
          value={`${PAYMENT_METHOD_LABELS[order.payment.method]}${order.payment.changeForCents ? ` (troco para ${brl(order.payment.changeForCents)})` : ''}`}
        />
        {order.address ? (
          <Row
            label="Endereço"
            value={`${order.address.street}, ${order.address.number}${order.address.complement ? `, ${order.address.complement}` : ''} · ${order.address.district}`}
          />
        ) : (
          <Row label="Retirada" value="Na loja" />
        )}
        {order.notes ? <Row label="Observações" value={order.notes} /> : null}
      </Card>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'subheading' : 'body'} color={strong ? 'text' : 'textSecondary'}>
        {label}
      </Text>
      <Text variant={strong ? 'subheading' : 'body'} style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  step: { flexDirection: 'row', gap: Spacing.md },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 18 },
  stepText: {
    flex: 1,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: 3,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
