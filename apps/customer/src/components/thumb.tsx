import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { data } from '@/data';
import { useTheme } from '@/theme/use-theme';

/**
 * Foto do produto ou logo da loja. Sem foto, mostra a inicial; no modo
 * demonstração as fotos são emojis ("emoji:🍔").
 */
export function Thumb({
  path,
  name,
  size = 72,
  radius = 12,
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: theme.surfaceAlt,
  };
  if (path?.startsWith('emoji:')) {
    return (
      <View style={[styles.center, box]}>
        <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{path.slice(6)}</Text>
      </View>
    );
  }
  if (path) {
    return (
      <Image
        source={{ uri: data().photoUrl(path) }}
        style={box}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[styles.center, box]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: theme.textMuted }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
