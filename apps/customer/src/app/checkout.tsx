import {
  deliveryFeeCents,
  PAYMENT_METHOD_LABELS,
  type Fulfillment,
  type PaymentMethod,
} from '@hiper/shared';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DeliveryMap } from '@/components/map/delivery-map';
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  Input,
  Loading,
  Screen,
  SectionTitle,
  Text,
  type IconName,
} from '@/components/ui';
import { data, DataError, type AddressEntry, type Storefront } from '@/data';
import { notify } from '@/lib/confirm';
import { brl, formatPhone, newRequestId } from '@/lib/format';
import { route as fetchRoute, type Route } from '@/services/routing';
import { useAuth } from '@/state/auth';
import { useCart } from '@/state/cart';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function CheckoutScreen() {
  const cart = useCart();
  const theme = useTheme();
  const { user, profile } = useAuth();
  const [store, setStore] = useState<Storefront | null>(null);
  const [addresses, setAddresses] = useState<AddressEntry[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [routeInfo, setRouteInfo] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card_on_delivery');
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mesmo id em novas tentativas: o servidor não duplica o pedido.
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (cart.store) void data().getStore(cart.store.slug).then(setStore);
  }, [cart.store]);
  useEffect(() => {
    if (profile?.phone && !phone) setPhone(profile.phone);
  }, [profile, phone]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void data()
        .listAddresses(user.uid)
        .then((list) => {
          setAddresses(list);
          setAddressId((cur) =>
            cur && list.some((a) => a.id === cur) ? cur : (list[list.length - 1]?.id ?? null),
          );
        });
    }, [user]),
  );

  const address = addresses?.find((a) => a.id === addressId) ?? null;
  const storeLocation = store?.address?.location ?? null;

  useEffect(() => {
    setRouteInfo(null);
    if (fulfillment !== 'delivery' || !address || !storeLocation) return;
    let cancelled = false;
    setRouting(true);
    void fetchRoute(storeLocation, address.location).then((r) => {
      if (!cancelled) {
        setRouteInfo(r);
        setRouting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fulfillment, address, storeLocation]);

  const fee = useMemo(() => {
    if (fulfillment === 'pickup') return 0;
    if (!store?.delivery) return null;
    if (store.delivery.mode === 'district') {
      return address
        ? deliveryFeeCents(store.delivery, { district: address.district }, cart.subtotalCents)
        : null;
    }
    return routeInfo
      ? deliveryFeeCents(store.delivery, { distanceKm: routeInfo.distanceKm }, cart.subtotalCents)
      : null;
  }, [fulfillment, store, address, routeInfo, cart.subtotalCents]);

  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const total = serverTotal ?? (fee === null ? null : cart.subtotalCents + fee);
  const outOfArea =
    fulfillment === 'delivery' &&
    !!address &&
    !routing &&
    fee === null &&
    (!!routeInfo || store?.delivery?.mode === 'district');
  const phoneDigits = phone.replace(/\D/g, '');
  const changeCents = changeFor
    ? Math.round(Number(changeFor.replace(/\./g, '').replace(',', '.')) * 100)
    : null;

  if (!cart.store || cart.lines.length === 0) return <Redirect href="/carrinho" />;
  if (!store || addresses === null) return <Loading label="Preparando o pedido" />;

  const canSubmit =
    total !== null &&
    phoneDigits.length >= 10 &&
    (fulfillment === 'pickup' || (!!address && !outOfArea)) &&
    (method !== 'cash' ||
      changeCents === null ||
      (Number.isFinite(changeCents) && changeCents >= total));

  const submit = async () => {
    if (total === null) return;
    setSending(true);
    setError(null);
    try {
      const result = await data().createOrder({
        tenantId: store.tenantId,
        lines: cart.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          options: l.selections,
          notes: l.notes,
        })),
        fulfillment,
        address:
          fulfillment === 'delivery' && address
            ? {
                cep: address.cep,
                street: address.street,
                number: address.number,
                complement: address.complement,
                district: address.district,
                city: address.city,
                state: address.state,
                location: address.location,
                reference: address.reference,
              }
            : null,
        payment: { method, changeForCents: method === 'cash' ? changeCents : null },
        customerPhone: phoneDigits,
        notes: notes.trim(),
        expectedTotalCents: total,
        clientRequestId: requestId.current,
      });
      cart.clear();
      router.replace({
        pathname: '/pedido/[tenantId]/[orderId]',
        params: { tenantId: store.tenantId, orderId: result.orderId },
      });
    } catch (e) {
      const err = e as DataError;
      if (err.code === 'functions/aborted' && err.details && typeof err.details === 'object') {
        // O servidor calculou outro total (preço ou frete mudou): mostra e pede nova confirmação.
        setServerTotal((err.details as { totalCents: number }).totalCents);
        notify('Os valores mudaram', 'Atualizamos o total do pedido. Confira e confirme de novo.');
      } else {
        setError(err.message);
      }
    } finally {
      setSending(false);
    }
  };

  const markers = [
    ...(storeLocation ? [{ id: 'store', kind: 'store' as const, at: storeLocation }] : []),
    ...(address ? [{ id: 'home', kind: 'home' as const, at: address.location }] : []),
  ];

  return (
    <Screen
      footer={
        <View style={{ gap: Spacing.sm }}>
          {error ? (
            <Text variant="caption" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
          <Button
            size="lg"
            title="Fazer pedido"
            trailing={total !== null ? brl(total) : undefined}
            disabled={!canSubmit}
            loading={sending}
            onPress={submit}
          />
        </View>
      }
    >
      {store.delivery?.pickupEnabled ? (
        <View style={styles.segment}>
          <Segment
            label="Entrega"
            icon="bicycle-outline"
            active={fulfillment === 'delivery'}
            onPress={() => {
              setFulfillment('delivery');
              setServerTotal(null);
            }}
          />
          <Segment
            label="Retirar na loja"
            icon="storefront-outline"
            active={fulfillment === 'pickup'}
            onPress={() => {
              setFulfillment('pickup');
              setServerTotal(null);
            }}
          />
        </View>
      ) : null}

      {fulfillment === 'delivery' ? (
        <>
          <SectionTitle
            action={
              <Button
                variant="ghost"
                title="Novo"
                onPress={() => router.push({ pathname: '/enderecos/novo', params: { back: '1' } })}
              />
            }
          >
            Entregar em
          </SectionTitle>
          {addresses.length === 0 ? (
            <Card
              onPress={() => router.push({ pathname: '/enderecos/novo', params: { back: '1' } })}
            >
              <View style={styles.inline}>
                <Icon name="add-circle-outline" color="brand" />
                <Text variant="bodyStrong" color="brand">
                  Adicionar endereço de entrega
                </Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {addresses.map((a) => (
                <Card
                  key={a.id}
                  onPress={() => {
                    setAddressId(a.id);
                    setServerTotal(null);
                  }}
                  style={
                    a.id === addressId ? { borderColor: theme.brand, borderWidth: 1.5 } : undefined
                  }
                >
                  <View style={styles.inline}>
                    <Icon
                      name={a.id === addressId ? 'radio-button-on' : 'radio-button-off'}
                      color={a.id === addressId ? 'brand' : 'textMuted'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{a.label}</Text>
                      <Text variant="caption" color="textSecondary">
                        {a.street}, {a.number}
                        {a.complement ? ` · ${a.complement}` : ''} · {a.district}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
          {address && storeLocation ? (
            <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
              <DeliveryMap markers={markers} route={routeInfo?.coordinates} height={200} />
              <View style={styles.inline}>
                {routing ? (
                  <Text variant="caption" color="textSecondary">
                    Calculando a rota…
                  </Text>
                ) : outOfArea ? (
                  <Badge label="Fora da área de entrega desta loja" tone="danger" />
                ) : routeInfo ? (
                  <Text variant="caption" color="textSecondary">
                    {routeInfo.distanceKm.toLocaleString('pt-BR')} km da loja
                    {routeInfo.routed ? '' : ' (estimado)'}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <Card style={{ marginTop: Spacing.lg }}>
          <Text variant="bodyStrong">Retirar em {store.tradeName}</Text>
          {store.address ? (
            <Text variant="caption" color="textSecondary">
              {store.address.street}, {store.address.number} · {store.address.district}
            </Text>
          ) : null}
        </Card>
      )}

      <SectionTitle>Seu telefone</SectionTitle>
      <View style={styles.inline}>
        <Input
          value={formatPhone(phone)}
          onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 11))}
          placeholder="(11) 91234-5678"
          keyboardType="phone-pad"
          hint="A loja e o entregador usam para falar com você sobre o pedido."
        />
      </View>

      <SectionTitle>Pagamento</SectionTitle>
      <View style={{ gap: Spacing.sm }}>
        <PayOption
          icon="qr-code-outline"
          label={PAYMENT_METHOD_LABELS.pix}
          detail="Em breve, com confirmação automática"
          disabled
          active={false}
          onPress={() => {}}
        />
        <PayOption
          icon="card-outline"
          label={PAYMENT_METHOD_LABELS.card_on_delivery}
          detail="Crédito ou débito na maquininha do entregador"
          active={method === 'card_on_delivery'}
          onPress={() => setMethod('card_on_delivery')}
        />
        <PayOption
          icon="cash-outline"
          label={PAYMENT_METHOD_LABELS.cash}
          active={method === 'cash'}
          onPress={() => setMethod('cash')}
        />
        {method === 'cash' ? (
          <View style={styles.inline}>
            <Input
              label="Troco para quanto? (opcional)"
              value={changeFor}
              onChangeText={setChangeFor}
              placeholder="Ex.: 100,00"
              keyboardType="decimal-pad"
              error={
                changeCents !== null && total !== null && changeCents < total
                  ? 'O troco precisa ser maior que o total'
                  : null
              }
            />
          </View>
        ) : null}
      </View>

      <SectionTitle>Observações para a loja</SectionTitle>
      <View style={styles.inline}>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex.: interfone com defeito, ligar ao chegar"
          maxLength={300}
          multiline
        />
      </View>

      <SectionTitle>Resumo</SectionTitle>
      <Card>
        {cart.lines.map((l) => (
          <View key={l.key} style={styles.sumRow}>
            <Text style={{ flex: 1 }} numberOfLines={1}>
              {l.saleUnit === 'un' ? `${l.quantity}x ` : ''}
              {l.name}
            </Text>
            <Text>{brl(Math.round(l.unitPriceCents * l.quantity))}</Text>
          </View>
        ))}
        <Divider />
        <View style={styles.sumRow}>
          <Text color="textSecondary">Subtotal</Text>
          <Text>{brl(cart.subtotalCents)}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text color="textSecondary">Entrega</Text>
          <Text color={fee === 0 ? 'success' : 'text'}>
            {fee === null ? '—' : fee === 0 ? 'Grátis' : brl(fee)}
          </Text>
        </View>
        <Divider />
        <View style={styles.sumRow}>
          <Text variant="subheading">Total</Text>
          <Text variant="subheading">{total === null ? '—' : brl(total)}</Text>
        </View>
      </Card>
    </Screen>
  );
}

function Segment({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segBtn, { backgroundColor: active ? theme.surface : 'transparent' }]}
    >
      <Icon name={icon} size={18} color={active ? 'text' : 'textSecondary'} />
      <Text variant="bodyStrong" color={active ? 'text' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function PayOption({
  icon,
  label,
  detail,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.pay,
        { borderColor: active ? theme.brand : theme.border, backgroundColor: theme.surface },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Icon name={icon} color={active ? 'brand' : 'textSecondary'} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? (
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon
        name={active ? 'radio-button-on' : 'radio-button-off'}
        color={active ? 'brand' : 'textMuted'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    gap: 4,
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 3,
  },
});
