import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Divider, Icon, Input, Screen, Text } from '@/components/ui';
import { data } from '@/data';
import { notify } from '@/lib/confirm';
import { Spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const demo = data().kind === 'demo';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(demo ? 'ana.souza@exemplo.com' : '');
  const [password, setPassword] = useState(demo ? 'demo123' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    if (next) router.replace(next as Href);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(() =>
      mode === 'signin'
        ? data().signIn(email.trim(), password)
        : data().signUp(name.trim(), email.trim(), password),
    );

  return (
    <Screen>
      <Text variant="title">{mode === 'signin' ? 'Entrar' : 'Criar conta'}</Text>
      <Text color="textSecondary" style={{ marginBottom: Spacing.xl }}>
        Uma conta para pedir em todas as lojas do Hiper Delivery.
      </Text>
      <View style={styles.form}>
        {mode === 'signup' ? (
          <View style={styles.row}>
            <Input
              label="Seu nome"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        </View>
        <View style={styles.row}>
          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            hint={mode === 'signup' ? 'Pelo menos 6 caracteres' : undefined}
            onSubmitEditing={submit}
          />
        </View>
        {error ? <Text color="danger">{error}</Text> : null}
        <Button
          size="lg"
          title={mode === 'signin' ? 'Entrar' : 'Criar conta'}
          loading={busy}
          disabled={!email || password.length < 6 || (mode === 'signup' && !name.trim())}
          onPress={submit}
        />
        {mode === 'signin' ? (
          <Button
            variant="ghost"
            title="Esqueci a senha"
            onPress={async () => {
              if (!email.includes('@')) return setError('Digite seu e-mail acima.');
              await data()
                .sendPasswordReset(email.trim())
                .catch(() => {});
              notify(
                'Enviamos um link',
                `Se houver uma conta com ${email.trim()}, você recebe o link para criar uma senha nova.`,
              );
            }}
          />
        ) : null}
      </View>

      <Divider />
      <View style={styles.form}>
        <Button
          variant="secondary"
          title="Continuar com Google"
          icon={<Icon name="logo-google" size={18} />}
          onPress={() => run(() => data().signInWithGoogle())}
          disabled={busy}
        />
        {Platform.OS === 'ios' ? (
          <Button
            variant="secondary"
            title="Continuar com Apple"
            icon={<Icon name="logo-apple" size={18} />}
            disabled
          />
        ) : null}
      </View>

      <Button
        variant="ghost"
        title={mode === 'signin' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
        onPress={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
        style={{ marginTop: Spacing.lg }}
      />
      {demo ? (
        <Text variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
          Demonstração: qualquer e-mail e senha com 6 caracteres entram.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  row: { flexDirection: 'row' },
});
