import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/constants/theme';
import { TaskStoreProvider } from '@/lib/TaskStore';

export default function RootLayout() {
  const theme = useTheme();

  return (
    <TaskStoreProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ title: 'タスクの編集', presentation: 'modal' }} />
        <Stack.Screen name="project/edit" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </TaskStoreProvider>
  );
}
