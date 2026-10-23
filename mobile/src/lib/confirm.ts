import { Alert, Platform } from 'react-native';

/**
 * 確認ダイアログ。OK なら true。
 * Web の Alert はボタンを出せないので、ブラウザの confirm を使う
 */
export function confirm(title: string, message: string, okLabel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n${message}`) ?? true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * いくつかの選択肢から選ぶダイアログ（キャンセルなら null）。
 * Web では選択肢ごとに confirm で順に聞く（テスト用）
 */
export function choose<T extends string>(
  title: string,
  message: string,
  options: { label: string; value: T; destructive?: boolean }[],
): Promise<T | null> {
  if (Platform.OS === 'web') {
    for (const option of options) {
      if (globalThis.confirm?.(`${title}\n${message}\n\n「${option.label}」にしますか？`)) return Promise.resolve(option.value);
    }
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(null) },
        ...options.map((o) => ({
          text: o.label,
          style: o.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => resolve(o.value),
        })),
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
