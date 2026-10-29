import { describeLineProblem, priceLine } from '@hiper/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Thumb } from '@/components/thumb';
import { Button, Card, Divider, EmptyState, Screen, Stepper, Text } from '@/components/ui';
import { data, type Storefront } from '@/data';
import { brl, formatQuantity } from '@/lib/format';
import { storeStatus } from '@/lib/store-status';
import { lineTotalCents, useCart } from '@/state/cart';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/theme/tokens';

export default function CartScreen() {
  const cart = useCart();
  const { user } = useAuth();
  const [store, setStore] = useState<Storefront | null>(null);
  const [problems, setProblems] = useState<Map<string, string>>(new Map());

  // Confere preços e disponibilidade com o catálogo atual, numa leitura só.
  const tenantId = cart.store?.tenantId;
  const slug = cart.store?.slug;
  const ids = cart.lines.map((l) => l.productId).join(',');
  useEffect(() => {
    if (!tenantId || !slug) return;
    void (async () => {
      const [s, catalog] = await Promise.all([
        data().getStore(slug),
        data().getCatalogItems(tenantId, [...new Set(ids.split(','))]),
      ]);
      setStore(s);
      const prices = new Map<string, number>();
      const found = new Map<string, string>();
      for (const line of cart.lines) {
        const item = catalog.get(line.productId);
        if (!item) {
          found.set(line.key, 'Saiu do cardápio');
          continue;
        }
        const priced = priceLine(item, line.quantity, line.selections);
        if (priced.ok) prices.set(line.key, priced.unitPriceCents);
        else found.set(line.key, describeLineProblem(priced.problems[0]!));
      }
      cart.replacePrices(prices);
      setProblems(found);
    })().catch(() => {});
    // Só quando a loja ou os produtos mudam, não a cada quantidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, slug, ids]);

  if (cart.lines.length === 0 || !cart.store) {
    return (
      <Screen>
        <EmptyState
          icon="bag-outline"
          title="Seu carrinho está vazio"
          message="Escolha uma loja e adicione os produtos que quiser."
          action={<Button title="Ver lojas" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }

  const status = store ? storeStatus(store) : null;
  const minOrder = store?.delivery?.minOrderCents ?? 0;
  const belowMin = cart.subtotalCents < minOrder;
  const blocked = problems.size > 0 || belowMin || (status !== null && !status.open);
  const storeCart = cart.store;

  return (
    <Screen
      footer={
        <View style={{ gap: Spacing.sm }}>
          {belowMin ? (
            <Text variant="caption" color="warning" style={{ textAlign: 'center' }}>
              Faltam {brl(minOrder - cart.subtotalCents)} para o pedido mínimo de {brl(minOrder)}
            </Text>
          ) : status && !status.open ? (
            <Text variant="caption" color="warning" style={{ textAlign: 'center' }}>
              {storeCart.name}: {status.label}
            </Text>
          ) : null}
          <Button
            size="lg"
            title={user ? 'Continuar' : 'Entrar para continuar'}
            trailing={brl(cart.subtotalCents)}
            disabled={blocked}
            onPress={() =>
              router.push(
                user ? '/checkout' : { pathname: '/entrar', params: { next: '/checkout' } },
              )
            }
          />
        </View>
      }
    >
      <Card>
        <View style={styles.storeRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="textMuted">
              PEDIDO EM
            </Text>
            <Text variant="subheading">{storeCart.name}</Text>
          </View>
          <Button
            variant="ghost"
            title="Adicionar itens"
            onPress={() =>
              router.push({ pathname: '/loja/[slug]', params: { slug: storeCart.slug } })
            }
          />
        </View>
        <Divider />
        {cart.lines.map((line, i) => {
          const weighed = line.saleUnit === 'kg' || line.saleUnit === 'l';
          const problem = problems.get(line.key);
          return (
            <View key={line.key}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <Thumb path={line.photo} name={line.name} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{line.name}</Text>
                  {line.options.length > 0 ? (
                    <Text variant="caption" color="textSecondary">
                      {line.options.map((o) => o.name).join(', ')}
                    </Text>
                  ) : null}
                  {line.notes ? (
                    <Text variant="caption" color="textMuted">
                      Obs.: {line.notes}
                    </Text>
                  ) : null}
                  {problem ? (
                    <Text variant="caption" color="danger">
                      {problem}
                    </Text>
                  ) : null}
                  <Text variant="bodyStrong" style={{ marginTop: 4 }}>
                    {brl(lineTotalCents(line))}
                  </Text>
                </View>
                <Stepper
                  value={line.quantity}
                  min={0}
                  step={weighed ? 0.25 : 1}
                  onChange={(q) => cart.setQuantity(line.key, q)}
                  format={(v) => (weighed ? formatQuantity(v, line.saleUnit) : String(v))}
                />
              </View>
            </View>
          );
        })}
      </Card>
      <Card style={{ marginTop: Spacing.lg }}>
        <View style={styles.total}>
          <Text color="textSecondary">Subtotal</Text>
          <Text variant="bodyStrong">{brl(cart.subtotalCents)}</Text>
        </View>
        <Text variant="caption" color="textMuted" style={{ marginTop: Spacing.xs }}>
          A taxa de entrega é calculada no próximo passo, pelo seu endereço.
        </Text>
      </Card>
      <Button
        variant="danger"
        title="Esvaziar carrinho"
        onPress={cart.clear}
        style={{ marginTop: Spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  storeRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  total: { flexDirection: 'row', justifyContent: 'space-between' },
});
