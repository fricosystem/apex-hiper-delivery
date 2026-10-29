import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Tela com fundo do tema, área segura e largura máxima no navegador. */
export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['bottom'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Fica fixo embaixo (botão de continuar). */
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.inner, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
        >
          <View style={styles.inner}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
