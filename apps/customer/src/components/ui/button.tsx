import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Texto à direita (ex.: total do carrinho). */
  trailing?: ReactNode;
  icon?: ReactNode;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  trailing,
  icon,
  size = 'md',
  style,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: {
      bg: theme.brand,
      pressed: theme.brandPressed,
      fg: 'onBrand' as const,
      border: theme.brand,
    },
    secondary: {
      bg: theme.surface,
      pressed: theme.surfaceAlt,
      fg: 'text' as const,
      border: theme.border,
    },
    ghost: {
      bg: 'transparent',
      pressed: theme.surfaceAlt,
      fg: 'brand' as const,
      border: 'transparent',
    },
    danger: {
      bg: theme.surface,
      pressed: theme.dangerSoft,
      fg: 'danger' as const,
      border: theme.border,
    },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border },
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme[palette.fg]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="bodyStrong" color={palette.fg} style={trailing ? styles.grow : undefined}>
            {title}
          </Text>
          {trailing ? (
            <Text variant="bodyStrong" color={palette.fg}>
              {trailing}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: { minHeight: 54, borderRadius: Radius.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  disabled: { opacity: 0.5 },
});
