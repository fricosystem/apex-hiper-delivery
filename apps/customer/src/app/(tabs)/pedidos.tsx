import { isOrderActive, ORDER_STATUS_LABELS, type OrderStatus } from '@hiper/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Thumb } from '@/components/thumb';
import { Badge, Button, Card, EmptyState, Loading, Text } from '@/components/ui';
import { data, type OrderEntry } from '@/data';
import { brl, formatDateTime } from '@/lib/format';
import { useAuth } from '@/state/auth';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const TONE: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'brand' | 'neutral'> = {
  pending: 'warning',
  accepted: 'brand',
  preparing: 'brand',
  ready: 'brand',
  dispatched: 'brand',
  delivered: 'success',
  cancelled: 'danger',
  rejected: 'danger',
};

/** Histórico em todas as lojas, paginado de 15 em 15, sem tempo real. */
export default function OrdersScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const [orders, setOrders] = useState<OrderEntry[] | null>(null);
  const [next, setNext] = useState<unknown | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void data()
        .listMyOrders(user.uid)
        .then((p) => {
          setOrders(p.items);
          setNext(p.next);
        })
        .catch(() => setOrders([]));
    }, [user]),
  );

  if (user === undefined) return <Loading />;
  if (!user) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="Entre para ver seus pedidos"
        message="Seu histórico de todas as lojas fica guardado na sua conta."
        action={<Button title="Entrar" onPress={() => router.push('/entrar')} />}
      />
    );
  }
  if (orders === null) return <Loading />;

  const more = async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    const p = await data().listMyOrders(user.uid, next);
    setOrders((prev) => [...(prev ?? []), ...p.items]);
    setNext(p.next);
    setLoadingMore(false);
  };

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(o) => `${o.tenantId}/${o.id}`}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      onEndReached={more}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <View style={styles.inner}>
          <Card
            onPress={() =>
              router.push({
                pathname: '/pedido/[tenantId]/[orderId]',
                params: { tenantId: item.tenantId, orderId: item.id },
              })
            }
          >
            <View style={styles.row}>
              <Thumb path={item.lines[0]?.photo} name={item.storeName} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.storeName}</Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.lines.map((l) => l.name).join(', ')}
                </Text>
                <Text variant="caption" color="textMuted">
                  #{item.number} · {formatDateTime(item.createdAtMs)} · {brl(item.totalCents)}
                </Text>
              </View>
              <Badge
                label={
                  isOrderActive(item.status)
                    ? ORDER_STATUS_LABELS[item.status]
                    : item.status === 'delivered'
                      ? 'Entregue'
                      : ORDER_STATUS_LABELS[item.status]
                }
                tone={TONE[item.status]}
              />
            </View>
          </Card>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="Nenhum pedido ainda"
          message="Quando você pedir, ele aparece aqui."
          action={<Button title="Ver lojas" onPress={() => router.push('/')} />}
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <Loading />
        ) : next ? (
          <Pressable onPress={more} style={styles.more}>
            <Text color="brand" variant="bodyStrong">
              Carregar pedidos anteriores
            </Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  more: { padding: Spacing.lg, alignItems: 'center' },
});
