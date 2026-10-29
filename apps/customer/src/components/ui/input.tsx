import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Fonts, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export type InputProps = TextInputProps & { label?: string; error?: string | null; hint?: string };

export function Input({ label, error, hint, style, ...rest }: InputProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
            outlineColor: theme.brand,
          },
          style,
        ]}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, flex: 1 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontFamily: Fonts,
  },
});
