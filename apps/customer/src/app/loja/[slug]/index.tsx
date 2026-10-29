import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CartBar } from '@/components/cart-bar';
import { ProductRow } from '@/components/product-row';
import { Thumb } from '@/components/thumb';
import { Badge, Chip, EmptyState, Icon, Input, Loading, Text } from '@/components/ui';
import { data, type CatalogEntry, type CategoryEntry, type Storefront } from '@/data';
import { brl } from '@/lib/format';
import { SEGMENT_SHORT, storeStatus } from '@/lib/store-status';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Vitrine da loja: categorias, busca e catálogo paginado ("carregar mais").
 * Nada aqui escuta em tempo real; o catálogo é lido em páginas de 24 itens.
 */
export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const [store, setStore] = useState<Storefront | null | undefined>(undefined);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CatalogEntry[]>([]);
  const [next, setNext] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    data()
      .getStore(slug)
      .then(async (s) => {
        setStore(s);
        if (s) setCategories(await data().listCategories(s.tenantId));
      })
      .catch(() => setStore(null));
  }, [slug]);

  const load = useCallback(
    async (after: unknown | null) => {
      if (!store) return;
      const id = ++request.current;
      setLoading(true);
      try {
        const page = await data().listCatalog(store.tenantId, {
          categoryId: category,
          search,
          after,
        });
        if (id !== request.current) return;
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setNext(page.next);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [store, category, search],
  );

  // Busca com pequena espera para não consultar a cada letra.
  useEffect(() => {
    const t = setTimeout(() => void load(null), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  if (store === undefined) return <Loading label="Abrindo a loja" />;
  if (store === null) {
    return (
      <EmptyState
        icon="storefront-outline"
        title="Loja não encontrada"
        message="Confira o link que a loja te mandou."
      />
    );
  }

  const status = storeStatus(store);
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const header = (
    <View style={styles.inner}>
      <View style={styles.hero}>
        <Thumb path={store.logoPath} name={store.tradeName} size={72} radius={36} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">{store.tradeName}</Text>
          <Text variant="caption" color="textSecondary">
            {SEGMENT_SHORT[store.segment]}
            {store.address ? ` · ${store.address.district}, ${store.address.city}` : ''}
          </Text>
          <Badge label={status.label} tone={status.open ? 'success' : 'warning'} />
        </View>
      </View>
      <View style={[styles.facts, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Fact icon="time-outline" label="Entrega" value={status.eta ?? '—'} />
        <Fact
          icon="bicycle-outline"
          label="Taxa"
          value={
            status.feeFromCents === null
              ? '—'
              : status.feeFromCents === 0
                ? 'Grátis'
                : `a partir de ${brl(status.feeFromCents)}`
          }
        />
        <Fact
          icon="cart-outline"
          label="Pedido mínimo"
          value={store.delivery ? brl(store.delivery.minOrderCents) : '—'}
        />
      </View>
      {store.delivery?.freeShippingAboveCents ? (
        <Text variant="caption" color="success" style={{ marginBottom: Spacing.sm }}>
          Entrega grátis acima de {brl(store.delivery.freeShippingAboveCents)}
        </Text>
      ) : null}
      {!status.open ? (
        <View style={[styles.closed, { backgroundColor: theme.warningSoft }]}>
          <Icon name="moon-outline" color="warning" />
          <Text variant="caption" color="warning" style={{ flex: 1 }}>
            A loja está fechada. Você pode ver o cardápio e montar o carrinho, mas só consegue pedir
            quando ela abrir.
          </Text>
        </View>
      ) : null}
      <View style={styles.searchRow}>
        <Input
          placeholder={`Buscar em ${store.tradeName}`}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Buscar produto"
        />
      </View>
      {categories.length > 0 && !search ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="Tudo" selected={category === null} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: store.tradeName,
          // Aberta direto pelo link da loja: sem tela anterior, o botão leva ao início.
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Início"
                  onPress={() => router.replace('/')}
                  style={{ paddingRight: Spacing.md }}
                >
                  <Icon name="home-outline" size={22} />
                </Pressable>
              ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const prev = items[index - 1];
          const showTitle =
            !category && !search && item.categoryId !== prev?.categoryId && item.categoryId;
          return (
            <View style={styles.inner}>
              {showTitle ? (
                <Text variant="subheading" style={styles.catTitle}>
                  {names.get(item.categoryId!) ?? 'Outros'}
                </Text>
              ) : null}
              <ProductRow
                item={item}
                onPress={() =>
                  router.push({
                    pathname: '/loja/[slug]/produto/[productId]',
                    params: { slug: store.slug, productId: item.id },
                  })
                }
              />
            </View>
          );
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (next && !loading) void load(next);
        }}
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState
              icon="search-outline"
              title={search ? 'Nada encontrado' : 'Nenhum produto nesta categoria'}
            />
          )
        }
        ListFooterComponent={loading ? <Loading /> : <View style={{ height: 110 }} />}
      />
      <CartBar tenantId={store.tenantId} />
    </View>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: 'time-outline' | 'bicycle-outline' | 'cart-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color="textSecondary" />
      <Text variant="label" color="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="caption" style={{ fontWeight: '600', textAlign: 'center' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  facts: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  fact: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  closed: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  searchRow: { flexDirection: 'row', marginVertical: Spacing.sm },
  chips: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  catTitle: { marginTop: Spacing.xl, marginBottom: Spacing.xs },
});
