import { isOrderActive, ORDER_STATUS_LABELS } from '@hiper/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartBar } from '@/components/cart-bar';
import { StoreCard } from '@/components/store-card';
import { Badge, Card, EmptyState, Icon, Input, Loading, Text } from '@/components/ui';
import { data, type OrderEntry, type Storefront } from '@/data';
import { useAuth } from '@/state/auth';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Tira o endereço da loja de um link colado (loja.hiperdelivery.com.br/slug). */
function slugFrom(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const last = trimmed.split('/').filter(Boolean).pop() ?? '';
  return last.replace(/[^a-z0-9-]/g, '');
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [stores, setStores] = useState<Storefront[]>([]);
  const [next, setNext] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<OrderEntry | null>(null);

  const load = useCallback(async (after: unknown | null) => {
    setLoading(true);
    setError(null);
    try {
      const page = await data().listStores(after);
      setStores((prev) => (after ? [...prev, ...page.items] : page.items));
      setNext(page.next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  // Pedido em andamento: uma leitura da primeira página do histórico ao voltar para a tela.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setActive(null);
        return;
      }
      data()
        .listMyOrders(user.uid)
        .then((p) => setActive(p.items.find((o) => isOrderActive(o.status)) ?? null))
        .catch(() => setActive(null));
    }, [user]),
  );

  const term = filter.trim().toLowerCase();
  const visible = term
    ? stores.filter(
        (s) => s.tradeName.toLowerCase().includes(term) || s.slug.includes(slugFrom(term)),
      )
    : stores;

  const header = (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={[styles.logo, { backgroundColor: theme.brand }]}>
          <Icon name="flash" size={18} color="onBrand" />
        </View>
        <Text variant="heading">Hiper Delivery</Text>
      </View>
      <Text variant="title">
        {user?.displayName
          ? `Olá, ${user.displayName.split(' ')[0]}!`
          : 'Peça das lojas do seu bairro'}
      </Text>
      <Text color="textSecondary">Compre direto da loja, sem taxa de marketplace.</Text>
      <View style={styles.search}>
        <Input
          placeholder="Buscar loja ou colar o link da loja"
          value={filter}
          onChangeText={setFilter}
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={() => {
            const slug = slugFrom(filter);
            if (slug && !visible.length)
              router.push({ pathname: '/loja/[slug]', params: { slug } });
          }}
          accessibilityLabel="Buscar loja"
        />
      </View>
      {active ? (
        <Card
          onPress={() =>
            router.push({
              pathname: '/pedido/[tenantId]/[orderId]',
              params: { tenantId: active.tenantId, orderId: active.id },
            })
          }
          style={{ backgroundColor: theme.brandSoft, borderColor: theme.brandSoft }}
          accessibilityLabel="Acompanhar pedido em andamento"
        >
          <View style={styles.activeRow}>
            <Icon name="bicycle" size={26} color="brand" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">
                Pedido #{active.number} · {active.storeName}
              </Text>
              <Text variant="caption" color="textSecondary">
                {ORDER_STATUS_LABELS[active.status]}
              </Text>
            </View>
            <Text variant="bodyStrong" color="brand">
              Acompanhar
            </Text>
          </View>
        </Card>
      ) : null}
      <View style={styles.sectionRow}>
        <Text variant="subheading">Lojas</Text>
        {data().kind === 'demo' ? <Badge label="Demonstração" tone="brand" /> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.background }]}>
      <FlatList
        data={visible}
        keyExtractor={(s) => s.slug}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        renderItem={({ item }) => (
          <View style={styles.inner}>
            <StoreCard
              store={item}
              onPress={() => router.push({ pathname: '/loja/[slug]', params: { slug: item.slug } })}
            />
          </View>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (next && !loading && !term) void load(next);
        }}
        ListFooterComponent={
          loading ? (
            <Loading />
          ) : next && !term ? (
            <Pressable onPress={() => load(next)} style={styles.more}>
              <Text color="brand" variant="bodyStrong">
                Carregar mais lojas
              </Text>
            </Pressable>
          ) : (
            <View style={{ height: 96 }} />
          )
        }
        ListEmptyComponent={
          loading ? undefined : error ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Não deu para carregar as lojas"
              message={error}
            />
          ) : (
            <EmptyState
              icon="storefront-outline"
              title={term ? 'Nenhuma loja encontrada' : 'Nenhuma loja por aqui ainda'}
              message={term ? 'Confira o nome ou cole o link que a loja te mandou.' : undefined}
            />
          )
        }
      />
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: Spacing.lg },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  logo: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', marginVertical: Spacing.sm },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  more: { padding: Spacing.lg, alignItems: 'center' },
});
