import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/constants/theme';
import { applyReminders, hasEnabledReminder, listenToNotificationTaps } from '@/lib/notifications';
import { TaskStoreProvider, useTasks } from '@/lib/TaskStore';

// 画面の表示中にエラーが起きたら、止まらずにエラー内容と「再試行」ボタンを出す
export { ErrorBoundary } from 'expo-router';

// 通知の設定が変わったら登録し直し、通知をタップしたら対応する画面を開く。
// 通知をオンにしていなければ、通知の部品は読み込まない（失敗してもアプリは止めない）
function NotificationEffects() {
  const { reminders, loaded } = useTasks();
  const enabled = hasEnabledReminder(reminders);
  const firstApply = useRef(true);

  useEffect(() => {
    if (!loaded) return;
    // 起動直後で通知が全部オフなら何もしない。設定を変えたときは、オフにした分を取り消すため必ず登録し直す
    const skip = firstApply.current && !enabled;
    firstApply.current = false;
    if (skip) return;
    applyReminders(reminders).catch((e) => console.warn('通知の登録に失敗しました', e));
  }, [reminders, loaded, enabled]);

  useEffect(() => {
    if (!loaded || !enabled) return;
    return listenToNotificationTaps((url) => router.push(url as '/plan' | '/review'));
  }, [loaded, enabled]);

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
