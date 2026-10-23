import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/constants/theme';
import { applyReminders, urlFromNotification } from '@/lib/notifications';
import { TaskStoreProvider, useTasks } from '@/lib/TaskStore';

// 通知の設定が変わったら登録し直し、通知をタップしたら対応する画面を開く
function NotificationEffects() {
  const { reminders, loaded } = useTasks();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!loaded) return;
    applyReminders(reminders).catch((e) => console.warn('通知の登録に失敗しました', e));
  }, [reminders, loaded]);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = urlFromNotification(lastResponse);
    if (url) router.push(url);
    // 同じ通知でもう一度開かないように消しておく
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [lastResponse]);

  return null;
}

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
        <Stack.Screen name="plan" options={{ title: '今日のプラン', presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ title: '振り返り', presentation: 'modal' }} />
      </Stack>
      {/* 通知はスマホだけ（Web では使えない API がある） */}
      {Platform.OS !== 'web' && <NotificationEffects />}
      <StatusBar style="auto" />
    </TaskStoreProvider>
  );
}
