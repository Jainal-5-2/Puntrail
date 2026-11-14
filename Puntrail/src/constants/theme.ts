import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#57606A',
    background: '#FFFFFF',
    backgroundElement: '#F6F8FA',
    backgroundSelected: '#EAEEF2',
    border: '#D0D7DE',
    primary: '#0969DA',
    primaryText: '#FFFFFF',
    danger: '#CF222E',
    success: '#1A7F37',
    warning: '#9A6700',
  },
  dark: {
    text: '#E6EDF3',
    textSecondary: '#8B949E',
    background: '#0D1117',
    backgroundElement: '#161B22',
    backgroundSelected: '#21262D',
    border: '#30363D',
    primary: '#2F81F7',
    primaryText: '#FFFFFF',
    danger: '#F85149',
    success: '#3FB950',
    warning: '#D29922',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    rounded: '"SF Pro Rounded", "Hiragino Maru Gothic ProN", Meiryo, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
} as const;

export const MaxContentWidth = 800;