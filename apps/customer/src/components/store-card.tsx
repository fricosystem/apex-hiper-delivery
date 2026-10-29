import { StyleSheet, View } from 'react-native';
import type { Storefront } from '@/data';
import { brl } from '@/lib/format';
import { SEGMENT_SHORT, storeStatus } from '@/lib/store-status';
import { Spacing } from '@/theme/tokens';
import { Badge, Card, Icon, Text } from './ui';
import { Thumb } from './thumb';

export function StoreCard({ store, onPress }: { store: Storefront; onPress: () => void }) {
  const status = storeStatus(store);
  return (
    <Card onPress={onPress} accessibilityLabel={`${store.tradeName}, ${status.label}`}>
      <View style={styles.row}>
        <Thumb path={store.logoPath} name={store.tradeName} size={60} radius={30} />
        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={1}>
            {store.tradeName}
          </Text>
          <Text variant="caption" color="textSecondary">
            {SEGMENT_SHORT[store.segment] ?? 'Loja'}
            {store.address?.district ? ` · ${store.address.district}` : ''}
          </Text>
          <View style={styles.meta}>
            {status.eta ? (
              <View style={styles.metaItem}>
                <Icon name="time-outline" size={14} color="textSecondary" />
                <Text variant="caption" color="textSecondary">
                  {status.eta}
                </Text>
              </View>
            ) : null}
            {status.feeFromCents !== null ? (
              <View style={styles.metaItem}>
                <Icon name="bicycle-outline" size={14} color="textSecondary" />
                <Text variant="caption" color="textSecondary">
                  {status.feeFromCents === 0
                    ? 'Entrega grátis'
                    : `a partir de ${brl(status.feeFromCents)}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Badge
          label={status.open ? 'Aberto' : 'Fechado'}
          tone={status.open ? 'success' : 'neutral'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
