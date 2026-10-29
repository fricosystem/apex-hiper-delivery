import { StyleSheet, View } from 'react-native';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const colors = {
    neutral: { bg: theme.surfaceAlt, fg: 'textSecondary' as const },
    success: { bg: theme.successSoft, fg: 'success' as const },
    warning: { bg: theme.warningSoft, fg: 'warning' as const },
    danger: { bg: theme.dangerSoft, fg: 'danger' as const },
    brand: { bg: theme.brandSoft, fg: 'brand' as const },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text variant="label" color={colors.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
});
