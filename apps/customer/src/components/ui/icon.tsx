import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ThemeColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({
  name,
  size = 20,
  color = 'text',
}: {
  name: IconName;
  size?: number;
  color?: keyof ThemeColors;
}) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={theme[color]} />;
}
