import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { DialogHost } from '@/components/DialogHost';
import { useTheme } from '@/constants/theme';
import { requestPersistentStorage } from '@/lib/pwa';
import { SyncProvider } from '@/lib/sync/SyncProvider';
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

// 初めて開いたとき（チュートリアルを見ていなければ）チュートリアルを出す
function OnboardingGate() {
  const { onboarded, loaded } = useTasks();
  const shown = useRef(false);

  useEffect(() => {
    if (!loaded || onboarded || shown.current) return;
    shown.current = true;
    router.push('/tutorial');
  }, [loaded, onboarded]);

  return null;
}

// Web 版をパソコンの広い画面で開いたときは、スマホくらいの幅で中央に表示する
function WebFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (Platform.OS !== 'web') return children;
  return (
    <View style={[styles.webOuter, { backgroundColor: theme.surface }]}>
      <View style={[styles.webInner, { backgroundColor: theme.background, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  // Web 版のデータを消されにくくする
  useEffect(requestPersistentStorage, []);

  return (
    <TaskStoreProvider>
      <SyncProvider>
        <WebFrame>
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
            <Stack.Screen name="tutorial" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          </Stack>
        </WebFrame>
        <DialogHost />
        {/* 通知が使える環境だけ（Web・Expo Go では使わない） */}
        {notificationsSupported() && <NotificationEffects />}
        <OnboardingGate />
        <StatusBar style="auto" />
      </SyncProvider>
    </TaskStoreProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    alignItems: 'center',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
