import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/constants/theme';

export default function TabLayout() {
  const theme = useTheme();
  const tabIcon =
    (name: keyof typeof Ionicons.glyphMap) =>
    ({ focused, size }: { focused: boolean; size: number }) => (
      <Ionicons name={name} size={size} color={focused ? theme.primary : theme.subText} />
    );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subText,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: tabIcon('sunny-outline'),
        }}
      />
      <Tabs.Screen
        name="all"
        options={{
          title: 'すべて',
          tabBarIcon: tabIcon('list-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: tabIcon('settings-outline'),
        }}
      />
    </Tabs>
  );
}
