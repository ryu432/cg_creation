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
