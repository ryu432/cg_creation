import { useColorScheme } from 'react-native';

// 朝焼けオレンジを基調にした配色（ライト / ダーク）
export const colors = {
  light: {
    background: '#FFF8F2',
    surface: '#FFFFFF',
    border: '#F0E4DA',
    text: '#3A2E28',
    subText: '#8A7A70',
    primary: '#F28C4B',
    primarySoft: '#FDE7D8',
    onPrimary: '#FFFFFF',
    danger: '#D9534F',
  },
  dark: {
    background: '#1E1A17',
    surface: '#2A2420',
    border: '#3A322C',
    text: '#F5EDE6',
    subText: '#A89B91',
    primary: '#F5A06A',
    primarySoft: '#4A3426',
    onPrimary: '#1E1A17',
    danger: '#E57373',
  },
};

export type Theme = (typeof colors)['light'];

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
