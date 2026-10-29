import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Divider, ListRow, Loading, Screen, Text } from '@/components/ui';
import { data } from '@/data';
import { confirm, notify } from '@/lib/confirm';
import { formatPhone } from '@/lib/format';
import { useAuth } from '@/state/auth';
import { useCart } from '@/state/cart';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function AccountScreen() {
  const { user, profile } = useAuth();
  const cart = useCart();
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);

  if (user === undefined) return <Loading />;
  if (!user) {
    return (
      <Screen>
        <Card>
          <Text variant="heading">Sua conta</Text>
          <Text color="textSecondary" style={{ marginVertical: Spacing.sm }}>
            Entre para salvar endereços, acompanhar pedidos e ver seu histórico em todas as lojas.
          </Text>
          <Button title="Entrar ou criar conta" onPress={() => router.push('/entrar')} />
        </Card>
      </Screen>
    );
  }

  const remove = async () => {
    const ok = await confirm(
      'Excluir sua conta?',
      'Seus dados pessoais e endereços serão apagados. Os pedidos ficam com as lojas sem seu nome e telefone, por obrigação fiscal. Isso não pode ser desfeito.',
      'Excluir conta',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await data().deleteAccount();
      cart.clear();
      router.replace('/');
    } catch (e) {
      notify('Não foi possível excluir', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const name = profile?.displayName ?? user.displayName ?? 'Cliente';
  return (
    <Screen>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: theme.brandSoft }]}>
          <Text variant="heading" color="brand">
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{name}</Text>
          <Text variant="caption" color="textSecondary">
            {user.email}
            {profile?.phone ? ` · ${formatPhone(profile.phone)}` : ''}
          </Text>
        </View>
      </View>
      <Card>
        <ListRow
          icon="person-outline"
          title="Meus dados"
          detail="Nome e telefone"
          onPress={() => router.push('/perfil')}
        />
        <Divider />
        <ListRow
          icon="location-outline"
          title="Endereços"
          detail="Onde você recebe os pedidos"
          onPress={() => router.push('/enderecos')}
        />
        <Divider />
        <ListRow
          icon="receipt-outline"
          title="Pedidos"
          detail="Histórico em todas as lojas"
          onPress={() => router.push('/pedidos')}
        />
      </Card>
      <Card style={{ marginTop: Spacing.lg }}>
        <ListRow icon="log-out-outline" title="Sair" onPress={() => void data().signOut()} />
        <Divider />
        <ListRow
          icon="trash-outline"
          title={deleting ? 'Excluindo…' : 'Excluir minha conta'}
          danger
          onPress={deleting ? undefined : remove}
        />
      </Card>
      {data().kind === 'demo' ? (
        <Text variant="caption" color="textMuted" style={styles.note}>
          Modo demonstração: os dados ficam só nesta aba do navegador.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { textAlign: 'center', marginTop: Spacing.xl },
});
