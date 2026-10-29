import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogHost } from '@/components/dialog-host';
import { AuthProvider } from '@/state/auth';
import { CartProvider } from '@/state/cart';
import { useTheme } from '@/theme/use-theme';

export default function RootLayout() {
  const theme = useTheme();
  const navTheme = theme.dark ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={{
            ...navTheme,
            colors: {
              ...navTheme.colors,
              primary: theme.brand,
              background: theme.background,
              card: theme.surface,
              text: theme.text,
              border: theme.border,
            },
          }}
        >
          <AuthProvider>
            <CartProvider>
              <StatusBar style={theme.dark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerBackButtonDisplayMode: 'minimal',
                  headerShadowVisible: false,
                  headerTitleStyle: { fontWeight: '700' },
                  contentStyle: { backgroundColor: theme.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Início' }} />
                <Stack.Screen name="loja/[slug]/index" options={{ title: '' }} />
                <Stack.Screen
                  name="loja/[slug]/produto/[productId]"
                  options={{ presentation: 'modal', title: 'Produto' }}
                />
                <Stack.Screen name="carrinho" options={{ title: 'Carrinho' }} />
                <Stack.Screen name="checkout" options={{ title: 'Finalizar pedido' }} />
                <Stack.Screen
                  name="pedido/[tenantId]/[orderId]"
                  options={{ title: 'Acompanhar pedido' }}
                />
                <Stack.Screen name="enderecos/index" options={{ title: 'Endereços' }} />
                <Stack.Screen name="enderecos/novo" options={{ title: 'Novo endereço' }} />
                <Stack.Screen name="entrar" options={{ presentation: 'modal', title: 'Entrar' }} />
                <Stack.Screen name="perfil" options={{ title: 'Meus dados' }} />
              </Stack>
              <DialogHost />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
