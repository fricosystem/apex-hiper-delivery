import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { Fonts, type ThemeColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label';

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: keyof ThemeColors;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText style={[styles.base, styles[variant], { color: theme[color] }, style]} {...rest} />
  );
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3 },
});
