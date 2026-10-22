import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

// 朝焼けオレンジを基調にした配色（ライト / ダーク）
const colors = {
  light: {
    background: '#FFF8F2',
    text: '#3A2E28',
    subText: '#8A7A70',
    primary: '#F28C4B',
  },
  dark: {
    background: '#1E1A17',
    text: '#F5EDE6',
    subText: '#A89B91',
    primary: '#F5A06A',
  },
};

export default function App() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = colors[scheme];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.primary }]}>Hello Plano</Text>
      <Text style={[styles.subtitle, { color: theme.subText }]}>
        今日の段取りを、いっしょに。
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
  },
});
