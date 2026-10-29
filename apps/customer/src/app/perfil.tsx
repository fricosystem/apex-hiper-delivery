import { userProfileInputSchema } from '@hiper/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Screen } from '@/components/ui';
import { data } from '@/data';
import { formatPhone } from '@/lib/format';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? user?.displayName ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile, user]);

  const save = async () => {
    if (!user) return;
    const parsed = userProfileInputSchema.safeParse({
      displayName: name,
      phone: phone || null,
      marketingOptIn: profile?.marketingOptIn ?? false,
    });
    if (!parsed.success) return setError('Confira o nome e o telefone (com DDD).');
    setBusy(true);
    try {
      await data().saveProfile(user.uid, parsed.data);
      await refreshProfile();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button size="lg" title="Salvar" loading={busy} onPress={save} />}>
      <View style={styles.form}>
        <View style={styles.row}>
          <Input label="Nome" value={name} onChangeText={setName} />
        </View>
        <View style={styles.row}>
          <Input
            label="Celular com DDD"
            value={formatPhone(phone)}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 11))}
            keyboardType="phone-pad"
            error={error}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg },
  row: { flexDirection: 'row' },
});
