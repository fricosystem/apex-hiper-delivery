import {
  describeLineProblem,
  priceLine,
  type OptionGroup,
  type OptionSelection,
} from '@hiper/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Thumb } from '@/components/thumb';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Input,
  Loading,
  Screen,
  Stepper,
  Text,
} from '@/components/ui';
import { data, type CatalogEntry, type Storefront } from '@/data';
import { confirm } from '@/lib/confirm';
import { brl, formatQuantity, unitSuffix } from '@/lib/format';
import { useCart } from '@/state/cart';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ProductScreen() {
  const { slug, productId } = useLocalSearchParams<{ slug: string; productId: string }>();
  const cart = useCart();
  const [store, setStore] = useState<Storefront | null>(null);
  const [item, setItem] = useState<CatalogEntry | null | undefined>(undefined);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await data().getStore(slug);
      setStore(s);
      if (!s) return setItem(null);
      const found = (await data().getCatalogItems(s.tenantId, [productId])).get(productId) ?? null;
      setItem(found);
      if (found && (found.saleUnit === 'kg' || found.saleUnit === 'l')) setQuantity(0.5);
    })().catch(() => setItem(null));
  }, [slug, productId]);

  const selections: OptionSelection[] = useMemo(
    () => Object.entries(chosen).map(([groupId, optionIds]) => ({ groupId, optionIds })),
    [chosen],
  );
  const priced = useMemo(
    () => (item ? priceLine(item, quantity, selections) : null),
    [item, quantity, selections],
  );

  if (item === undefined) return <Loading />;
  if (!item || !store)
    return <EmptyState icon="alert-circle-outline" title="Produto não encontrado" />;

  const weighed = item.saleUnit === 'kg' || item.saleUnit === 'l';
  const toggle = (group: OptionGroup, optionId: string) =>
    setChosen((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max === 1)
        return {
          ...prev,
          [group.id]: current[0] === optionId && group.min === 0 ? [] : [optionId],
        };
      if (current.includes(optionId))
        return { ...prev, [group.id]: current.filter((o) => o !== optionId) };
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });

  const add = async () => {
    setTouched(true);
    if (!priced?.ok) return;
    if (!cart.canAddFrom(store.tenantId)) {
      const ok = await confirm(
        'Começar um carrinho novo?',
        `Seu carrinho tem itens de ${cart.store?.name}. Para pedir em ${store.tradeName}, os itens atuais saem do carrinho.`,
        'Limpar e adicionar',
      );
      if (!ok) return;
    }
    cart.add(
      { tenantId: store.tenantId, slug: store.slug, name: store.tradeName },
      {
        productId: item.id,
        name: item.name,
        photo: item.photos[0] ?? null,
        saleUnit: item.saleUnit,
        quantity,
        selections: selections.filter((s) => s.optionIds.length > 0),
        options: priced.options,
        unitPriceCents: priced.unitPriceCents,
        notes: notes.trim(),
      },
    );
    router.back();
  };

  const firstProblem = priced && !priced.ok ? priced.problems[0] : undefined;
  const problemGroup = firstProblem && 'groupId' in firstProblem ? firstProblem.groupId : null;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Stepper
            value={quantity}
            onChange={setQuantity}
            min={weighed ? 0.25 : 1}
            max={item.maxPerOrder ?? 99}
            step={weighed ? 0.25 : 1}
            format={(v) => (weighed ? formatQuantity(v, item.saleUnit) : String(v))}
          />
          <Button
            title={item.available ? 'Adicionar' : 'Esgotado'}
            trailing={priced?.ok ? brl(priced.totalCents) : undefined}
            disabled={!item.available}
            onPress={add}
            style={{ flex: 1 }}
            size="lg"
          />
        </View>
      }
    >
      <Stack.Screen options={{ title: item.name }} />
      <View style={styles.photo}>
        <Thumb path={item.photos[0]} name={item.name} size={180} radius={24} />
      </View>
      <Text variant="heading">{item.name}</Text>
      {item.description ? (
        <Text color="textSecondary" style={{ marginTop: 4 }}>
          {item.description}
        </Text>
      ) : null}
      <View style={styles.price}>
        <Text variant="subheading">
          {brl(
            priced?.ok
              ? priced.unitPriceCents
              : item.promo
                ? item.promo.priceCents
                : item.salePriceCents,
          )}
          {unitSuffix(item.saleUnit)}
        </Text>
        {item.ageRestricted ? (
          <Badge label="Proibido para menores de 18 anos" tone="warning" />
        ) : null}
      </View>
      {weighed ? (
        <Text variant="caption" color="textSecondary">
          Vendido por peso. O valor final é ajustado na pesagem e pode variar um pouco.
        </Text>
      ) : null}

      {item.optionGroups.map((group) => {
        const picked = chosen[group.id] ?? [];
        const invalid = touched && problemGroup === group.id;
        return (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{group.name}</Text>
                <Text variant="caption" color={invalid ? 'danger' : 'textSecondary'}>
                  {invalid && firstProblem
                    ? describeLineProblem(firstProblem)
                    : group.max === 1
                      ? 'Escolha 1'
                      : `Escolha até ${group.max}${group.min > 0 ? ` (mínimo ${group.min})` : ''}`}
                </Text>
              </View>
              {group.min > 0 ? (
                <Badge
                  label="Obrigatório"
                  tone={picked.length >= group.min ? 'success' : 'neutral'}
                />
              ) : null}
            </View>
            {group.options.map((o) => (
              <OptionRow
                key={o.id}
                name={o.name}
                price={o.priceDeltaCents}
                selected={picked.includes(o.id)}
                radio={group.max === 1}
                disabled={!o.available}
                onPress={() => toggle(group, o.id)}
              />
            ))}
          </View>
        );
      })}

      <View style={styles.group}>
        <Input
          label="Alguma observação?"
          placeholder="Ex.: sem cebola, ponto da carne"
          value={notes}
          onChangeText={setNotes}
          maxLength={140}
          multiline
        />
      </View>
    </Screen>
  );
}

function OptionRow({
  name,
  price,
  selected,
  radio,
  disabled,
  onPress,
}: {
  name: string;
  price: number;
  selected: boolean;
  radio: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const icon = radio
    ? selected
      ? 'radio-button-on'
      : 'radio-button-off'
    : selected
      ? 'checkbox'
      : 'square-outline';
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? theme.brand : theme.border,
          backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
        },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Icon name={icon} color={selected ? 'brand' : 'textMuted'} />
      <Text style={{ flex: 1 }}>{name}</Text>
      <Text variant="caption" color="textSecondary">
        {disabled ? 'Esgotado' : price > 0 ? `+ ${brl(price)}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', marginBottom: Spacing.lg },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
    flexWrap: 'wrap',
  },
  group: { marginTop: Spacing.xl, gap: Spacing.sm },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
