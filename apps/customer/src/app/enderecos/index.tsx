import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Divider, EmptyState, ListRow, Loading, Screen } from '@/components/ui';
import { data, type AddressEntry } from '@/data';
import { confirm } from '@/lib/confirm';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/theme/tokens';

export default function AddressesScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<AddressEntry[] | null>(null);

  const load = useCallback(() => {
    if (user) void data().listAddresses(user.uid).then(setList);
  }, [user]);
  useFocusEffect(load);

  if (!user || list === null) return <Loading />;

  return (
    <Screen
      footer={
        <Button
          size="lg"
          title="Adicionar endereço"
          onPress={() => router.push('/enderecos/novo')}
        />
      }
    >
      {list.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="Nenhum endereço salvo"
          message="Salve onde você recebe os pedidos para pedir mais rápido."
        />
      ) : (
        <Card>
          {list.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={a.label.toLowerCase().includes('trab') ? 'briefcase-outline' : 'home-outline'}
                title={a.label}
                detail={`${a.street}, ${a.number}${a.complement ? `, ${a.complement}` : ''} · ${a.district}, ${a.city}`}
                onPress={() => router.push({ pathname: '/enderecos/novo', params: { id: a.id } })}
              />
            </View>
          ))}
        </Card>
      )}
      {list.length > 0 ? (
        <View style={{ marginTop: Spacing.lg }}>
          {list.map((a) => (
            <Button
              key={a.id}
              variant="danger"
              title={`Remover "${a.label}"`}
              style={{ marginBottom: Spacing.sm }}
              onPress={async () => {
                if (await confirm('Remover endereço?', `${a.street}, ${a.number}`, 'Remover')) {
                  await data().deleteAddress(user.uid, a.id);
                  load();
                }
              }}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
