import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brl } from '@/lib/format';
import { useCart } from '@/state/cart';
import { MaxContentWidth, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon, Text } from './ui';

/** Barra flutuante com o carrinho, mostrada nas telas da loja. */
export function CartBar({ tenantId }: { tenantId?: string }) {
  const cart = useCart();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (cart.lines.length === 0 || (tenantId && cart.store?.tenantId !== tenantId)) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver carrinho, ${cart.count} itens, ${brl(cart.subtotalCents)}`}
        onPress={() => router.push('/carrinho')}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: pressed ? theme.brandPressed : theme.brand },
        ]}
      >
        <View style={styles.count}>
          <Icon name="bag-handle" size={18} color="onBrand" />
          <Text variant="bodyStrong" color="onBrand">
            {cart.count}
          </Text>
        </View>
        <Text variant="bodyStrong" color="onBrand" style={styles.label}>
          Ver carrinho
        </Text>
        <Text variant="bodyStrong" color="onBrand">
          {brl(cart.subtotalCents)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    minHeight: 54,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { flex: 1, textAlign: 'center' },
});
