import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

// 朝のプラン・夜の振り返りを知らせる、毎日のローカル通知（サーバーは使わない）。
// expo-notifications は環境（Expo Go など）によって起動を妨げることがあるので、
// アプリの起動時には読み込まず、通知を使うときに初めて読み込む

export type ReminderTime = { enabled: boolean; hour: number; minute: number };

export type ReminderSettings = {
  morning: ReminderTime;
  evening: ReminderTime;
};

export const defaultReminderSettings: ReminderSettings = {
  morning: { enabled: false, hour: 7, minute: 30 },
  evening: { enabled: false, hour: 21, minute: 0 },
};

/**
 * この環境で通知が使えるか。Expo Go（Android）では通知の部品を読み込むとアプリが落ちることがあるので使わない。
 * Plano 専用のアプリ（開発用ビルド・ストア版）なら使える
 */
export function notificationsSupported(): boolean {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export function hasEnabledReminder(settings: ReminderSettings): boolean {
  return settings.morning.enabled || settings.evening.enabled;
}

const CHANNEL_ID = 'reminders';

const REMINDERS = {
  morning: { title: 'おはようございます☀️', body: '今日のプランを作りましょう', url: '/plan' },
  evening: { title: '今日もおつかれさまでした🌙', body: 'やり残したタスクを振り返りましょう', url: '/review' },
} as const;

export function formatTime({ hour, minute }: { hour: number; minute: number }): string {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

let modulePromise: Promise<typeof NotificationsModule> | null = null;

// 初めて呼ばれたときに読み込み、アプリを開いているときに届いた通知も表示するよう設定する
function loadNotifications(): Promise<typeof NotificationsModule> {
  modulePromise ??= import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return Notifications;
  });
  return modulePromise;
}

/** 通知の許可を確認し、まだなら求める。許可されたら true */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const Notifications = await loadNotifications();
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
  if (!notificationsSupported()) return;
  const Notifications = await loadNotifications();
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

function urlFromNotification(response: NotificationsModule.NotificationResponse): string | null {
  const url = response.notification.request.content.data?.url;
  return url === '/plan' || url === '/review' ? url : null;
}

/**
 * 通知をタップしたときに onOpen（/plan または /review）を呼ぶ。
 * 通知から起動した場合と、開いている間にタップした場合の両方。戻り値で受け取りをやめる
 */
export function listenToNotificationTaps(onOpen: (url: string) => void): () => void {
  if (!notificationsSupported()) return () => {};
  let subscription: { remove: () => void } | null = null;
  let stopped = false;

  const handle = (Notifications: typeof NotificationsModule, response: NotificationsModule.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = urlFromNotification(response);
    if (url) onOpen(url);
  };

  loadNotifications()
    .then(async (Notifications) => {
      if (stopped) return;
      subscription = Notifications.addNotificationResponseReceivedListener((r) => handle(Notifications, r));
      const last = await Notifications.getLastNotificationResponseAsync();
      handle(Notifications, last);
      // 同じ通知でもう一度開かないように消しておく
      await Notifications.clearLastNotificationResponseAsync();
    })
    .catch((e) => console.warn('通知の受け取りを設定できませんでした', e));

  return () => {
    stopped = true;
    subscription?.remove();
  };
}
