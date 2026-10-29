import { Tabs } from 'expo-router/js-tabs';
import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/use-theme';

const tab = (name: IconName, active: IconName) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <Icon name={focused ? active : name} size={22} color={focused ? 'brand' : 'textMuted'} />
    );
  };

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: theme.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', headerShown: false, tabBarIcon: tab('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{ title: 'Pedidos', tabBarIcon: tab('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="conta"
        options={{ title: 'Conta', tabBarIcon: tab('person-outline', 'person') }}
      />
    </Tabs>
  );
}
