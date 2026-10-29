import { effectivePriceCents } from '@hiper/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CatalogEntry } from '@/data';
import { brl, unitSuffix } from '@/lib/format';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Badge, Text } from './ui';
import { Thumb } from './thumb';

export function ProductRow({ item, onPress }: { item: CatalogEntry; onPress: () => void }) {
  const theme = useTheme();
  const price = effectivePriceCents(item);
  const onPromo = price < item.salePriceCents;
  const fromPrice = item.optionGroups.some(
    (g) => g.min > 0 && g.options.some((o) => o.priceDeltaCents > 0),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${brl(price)}${item.available ? '' : ', esgotado'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.surfaceAlt },
      ]}
    >
      <View style={[styles.body, !item.available && styles.dim]}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {item.name}
        </Text>
        {item.description ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          {fromPrice ? (
            <Text variant="caption" color="textSecondary">
              a partir de
            </Text>
          ) : null}
          <Text variant="bodyStrong" color={onPromo ? 'success' : 'text'}>
            {brl(price)}
            {unitSuffix(item.saleUnit)}
          </Text>
          {onPromo ? (
            <Text variant="caption" color="textMuted" style={styles.strike}>
              {brl(item.salePriceCents)}
            </Text>
          ) : null}
        </View>
        {!item.available ? (
          <Badge label="Esgotado" />
        ) : item.ageRestricted ? (
          <Badge label="+18" tone="warning" />
        ) : null}
      </View>
      <View style={!item.available && styles.dim}>
        <Thumb path={item.photos[0]} name={item.name} size={84} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  strike: { textDecorationLine: 'line-through' },
  dim: { opacity: 0.5 },
});
