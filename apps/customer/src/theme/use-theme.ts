import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from './tokens';

export function useTheme(): ThemeColors & { dark: boolean } {
  const dark = useColorScheme() === 'dark';
  return { ...(dark ? Colors.dark : Colors.light), dark };
}
