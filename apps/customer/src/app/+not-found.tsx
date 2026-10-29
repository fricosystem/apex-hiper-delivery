import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        icon="compass-outline"
        title="Página não encontrada"
        action={<Button title="Voltar ao início" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
