import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 朝のプラン・夜の振り返りを知らせる、毎日のローカル通知（サーバーは使わない）

export type ReminderTime = { enabled: boolean; hour: number; minute: number };

export type ReminderSettings = {
  morning: ReminderTime;
  evening: ReminderTime;
};

export const defaultReminderSettings: ReminderSettings = {
  morning: { enabled: false, hour: 7, minute: 30 },
  evening: { enabled: false, hour: 21, minute: 0 },
};

const CHANNEL_ID = 'reminders';

const REMINDERS = {
  morning: { title: 'おはようございます☀️', body: '今日のプランを作りましょう', url: '/plan' },
  evening: { title: '今日もおつかれさまでした🌙', body: 'やり残したタスクを振り返りましょう', url: '/review' },
} as const;

export function formatTime({ hour, minute }: { hour: number; minute: number }): string {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

// アプリを開いているときに届いた通知も表示する（使えない環境でもアプリは止めない）
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.warn('通知の表示設定に失敗しました', e);
}

/** 通知の許可を確認し、まだなら求める。許可されたら true */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (e) {
    console.warn('通知の許可を確認できませんでした', e);
    return false;
  }
}

/** 設定に合わせて、毎日の通知を登録し直す */
export async function applyReminders(settings: ReminderSettings): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'プランと振り返りのお知らせ',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  const enabled = (['morning', 'evening'] as const).filter((key) => settings[key].enabled);
  if (enabled.length === 0) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  for (const key of enabled) {
    const { hour, minute } = settings[key];
    const { title, body, url } = REMINDERS[key];
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
    });
  }
}

/** 通知をタップしたときに開く画面（/plan または /review） */
export function urlFromNotification(response: Notifications.NotificationResponse): string | null {
  const url = response.notification.request.content.data?.url;
  return url === '/plan' || url === '/review' ? url : null;
}
