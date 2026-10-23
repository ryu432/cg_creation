import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/constants/theme';
import { applyReminders, urlFromNotification } from '@/lib/notifications';
import { TaskStoreProvider, useTasks } from '@/lib/TaskStore';

// 画面の表示中にエラーが起きたら、止まらずにエラー内容と「再試行」ボタンを出す
export { ErrorBoundary } from 'expo-router';

// 通知の設定が変わったら登録し直し、通知をタップしたら対応する画面を開く。
// 通知まわりは Expo Go など環境によって使えない機能があるので、失敗してもアプリは止めない
function NotificationEffects() {
  const { reminders, loaded } = useTasks();

  useEffect(() => {
    if (!loaded) return;
    applyReminders(reminders).catch((e) => console.warn('通知の登録に失敗しました', e));
  }, [reminders, loaded]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const url = urlFromNotification(response);
      if (url) router.push(url);
    };

    // アプリが閉じていたときに通知から起動した場合
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        open(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch((e) => console.warn('通知の確認に失敗しました', e));

    // アプリを開いている間・バックグラウンドにある間にタップされた場合
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(open);
    } catch (e) {
      console.warn('通知の受け取りを設定できませんでした', e);
    }
    return () => subscription?.remove();
  }, []);

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
