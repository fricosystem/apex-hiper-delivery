import { StyleSheet, Text, View } from 'react-native';
import { MARKER_EMOJI, type MarkerKind } from './types';

/** Marcador redondo com emoji, igual no celular e no navegador. */
export function MarkerBubble({ kind }: { kind: MarkerKind }) {
  return (
    <View style={[styles.bubble, kind === 'courier' && styles.courier]}>
      <Text style={styles.emoji}>{MARKER_EMOJI[kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1B1B1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courier: { borderColor: '#E8442E' },
  emoji: { fontSize: 18, lineHeight: 22 },
});
