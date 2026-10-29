import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { setDialogListener, type DialogRequest } from '@/lib/confirm';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Button, Text } from './ui';

/** Mostra os pedidos de confirm() e notify(); fica uma vez na raiz do app. */
export function DialogHost() {
  const theme = useTheme();
  const [request, setRequest] = useState<DialogRequest | null>(null);

  useEffect(() => {
    setDialogListener(setRequest);
    return () => setDialogListener(null);
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        onPress={() => close(false)}
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.surface }]}
          accessibilityRole="alert"
        >
          <Text variant="subheading">{request?.title}</Text>
          {request?.message ? <Text color="textSecondary">{request.message}</Text> : null}
          <View style={styles.actions}>
            {request?.cancel ? (
              <Button
                variant="secondary"
                title="Cancelar"
                onPress={() => close(false)}
                style={styles.flex}
              />
            ) : null}
            <Button title={request?.ok ?? 'OK'} onPress={() => close(true)} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  flex: { flex: 1 },
});
