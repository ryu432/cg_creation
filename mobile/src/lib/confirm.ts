import { Alert, Platform } from 'react-native';

export type DialogButton<T> = { label: string; value: T; style?: 'cancel' | 'default' | 'destructive' };
export type DialogRequest = { title: string; message: string; buttons: DialogButton<unknown>[] };
type DialogPresenter = (request: DialogRequest) => Promise<unknown>;

// Web では Alert がボタンを出せないので、アプリ内のダイアログ（DialogHost）で出す
let webPresenter: DialogPresenter | null = null;

/** DialogHost が表示されている間、Web のダイアログを受け持つ */
export function setWebDialogPresenter(presenter: DialogPresenter | null) {
  webPresenter = presenter;
}

/**
 * ボタンを並べたダイアログを出し、押されたボタンの value を返す（閉じたら null）。
 * スマホは Alert、Web はアプリ内のダイアログ
 */
function showDialog<T>(title: string, message: string, buttons: DialogButton<T>[]): Promise<T | null> {
  if (Platform.OS === 'web') {
    if (webPresenter) return webPresenter({ title, message, buttons }) as Promise<T | null>;
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      buttons.map((b) => ({ text: b.label, style: b.style ?? 'default', onPress: () => resolve(b.value) })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** お知らせ（OK だけ） */
export async function notify(title: string, message: string): Promise<void> {
  await showDialog(title, message, [{ label: 'OK', value: true }]);
}

/** 確認ダイアログ。OK なら true */
export async function confirm(title: string, message: string, okLabel: string, destructive = false): Promise<boolean> {
  const result = await showDialog(title, message, [
    { label: 'キャンセル', value: false, style: 'cancel' },
    { label: okLabel, value: true, style: destructive ? 'destructive' : 'default' },
  ]);
  return result === true;
}

/** いくつかの選択肢から選ぶダイアログ（キャンセルなら null） */
export function choose<T extends string>(
  title: string,
  message: string,
  options: { label: string; value: T; destructive?: boolean }[],
): Promise<T | null> {
  return showDialog<T | null>(title, message, [
    { label: 'キャンセル', value: null, style: 'cancel' },
    ...options.map((o) => ({ label: o.label, value: o.value, style: o.destructive ? ('destructive' as const) : ('default' as const) })),
  ]);
}
