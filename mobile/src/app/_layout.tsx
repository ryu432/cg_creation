import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { useTheme } from '@/constants/theme';
import { applyReminders, hasEnabledReminder, listenToNotificationTaps, notificationsSupported } from '@/lib/notifications';
import { TaskStoreProvider, useTasks } from '@/lib/TaskStore';

// 画面の表示中にエラーが起きたら、止まらずにエラー内容と「再試行」ボタンを出す
export { ErrorBoundary } from 'expo-router';

// 通知の設定が変わったら登録し直し、通知をタップしたら対応する画面を開く。
// 通知をオンにしていなければ、通知の部品は読み込まない（失敗してもアプリは止めない）
function NotificationEffects() {
  const { reminders, loaded } = useTasks();
  const enabled = hasEnabledReminder(reminders);
  // 前回登録したときに通知がオンだったか（起動直後は「オフだった」とみなす）
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    // 通知がずっとオフなら何もしない（時刻だけ変えたときも）。オフにしたときは取り消すために登録し直す
    const shouldApply = enabled || wasEnabled.current;
    wasEnabled.current = enabled;
    if (!shouldApply) return;
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
        <Stack.Screen name="task/new" options={{ title: 'タスクの追加', presentation: 'modal' }} />
        <Stack.Screen name="task/[id]" options={{ title: 'タスクの編集', presentation: 'modal' }} />
        <Stack.Screen name="project/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan" options={{ title: '今日のプラン', presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ title: '振り返り', presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ title: 'データを読み込む', presentation: 'modal' }} />
      </Stack>
      {/* 通知が使える環境だけ（Web・Expo Go では使わない） */}
      {notificationsSupported() && <NotificationEffects />}
      <StatusBar style="auto" />
    </TaskStoreProvider>
  );
}
