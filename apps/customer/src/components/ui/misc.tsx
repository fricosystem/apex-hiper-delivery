import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
        <Icon name={icon} size={30} color="textSecondary" />
      </View>
      <Text variant="subheading" style={styles.center}>
        {title}
      </Text>
      {message ? (
        <Text color="textSecondary" style={styles.center}>
          {message}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.loading} accessibilityLabel={label ?? 'Carregando'}>
      <ActivityIndicator color={theme.brand} />
      {label ? <Text color="textSecondary">{label}</Text> : null}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="subheading">{children}</Text>
      {action}
    </View>
  );
}

/** Linha de lista com ícone, título, detalhe e seta. */
export function ListRow({
  icon,
  title,
  detail,
  onPress,
  trailing,
  danger,
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress && { backgroundColor: theme.surfaceAlt },
      ]}
    >
      {icon ? <Icon name={icon} color={danger ? 'danger' : 'textSecondary'} /> : null}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={18} color="textMuted" /> : null)}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const theme = useTheme();
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return (
    <View style={[styles.stepper, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuir"
        disabled={value <= min}
        onPress={() => onChange(round(Math.max(min, value - step)))}
        style={styles.stepBtn}
      >
        <Icon
          name={min === 0 && value - step <= 0 ? 'trash-outline' : 'remove'}
          color={value <= min ? 'textMuted' : 'brand'}
        />
      </Pressable>
      <Text variant="bodyStrong" style={styles.stepValue}>
        {format(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aumentar"
        disabled={value >= max}
        onPress={() => onChange(round(Math.min(max, value + step)))}
        style={styles.stepBtn}
      >
        <Icon name="add" color={value >= max ? 'textMuted' : 'brand'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  center: { textAlign: 'center' },
  loading: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
  rowText: { flex: 1, gap: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 36, textAlign: 'center' },
});
