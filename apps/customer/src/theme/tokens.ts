import { Platform } from 'react-native';

/** Cores do app em tema claro e escuro. A cor da marca é a mesma nos dois. */
export const Colors = {
  light: {
    brand: '#E8442E',
    brandPressed: '#C93622',
    onBrand: '#FFFFFF',
    brandSoft: '#FDECE9',
    text: '#1B1B1F',
    textSecondary: '#5F6168',
    textMuted: '#8B8D94',
    background: '#F6F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F0F3',
    border: '#E3E4E8',
    success: '#1F8A4C',
    successSoft: '#E3F4EA',
    warning: '#B76E00',
    warningSoft: '#FFF2DC',
    danger: '#C6282B',
    dangerSoft: '#FCE8E8',
    overlay: 'rgba(0,0,0,0.45)',
  },
  dark: {
    brand: '#FF5A43',
    brandPressed: '#E8442E',
    onBrand: '#FFFFFF',
    brandSoft: '#3A1D18',
    text: '#F3F3F5',
    textSecondary: '#B4B6BD',
    textMuted: '#80838B',
    background: '#0E0E10',
    surface: '#18181B',
    surfaceAlt: '#232327',
    border: '#2E2F34',
    success: '#4CC27E',
    successSoft: '#13301F',
    warning: '#F0A43A',
    warningSoft: '#33240C',
    danger: '#FF6B6B',
    dangerSoft: '#3A1616',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Largura máxima do conteúdo no navegador, para não esticar em tela grande. */
export const MaxContentWidth = 720;

export const Fonts = Platform.select({
  web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});
