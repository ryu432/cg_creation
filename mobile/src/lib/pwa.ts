import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Web 版を「ホーム画面に追加」して、アプリのように使うための処理（スマホのアプリでは何もしない）

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type PlanoWindow = Window & { __planoInstallPrompt?: InstallPromptEvent | null };

const DISMISS_KEY = 'plano.installHintDismissed.v1';

/** ホーム画面から開いているか */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone・iPad か（iPad はパソコン版の表示を名乗るので、タッチできる Mac も含める） */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallState = {
  /** ホーム画面から開いている */
  standalone: boolean;
  /** iPhone・iPad（共有ボタンから自分で追加してもらう） */
  ios: boolean;
  /** ボタン1つで追加できる（Android の Chrome など） */
  canPrompt: boolean;
};

const nativeState: InstallState = { standalone: true, ios: false, canPrompt: false };

function readState(): InstallState {
  return {
    standalone: isStandalone(),
    ios: isIOS(),
    canPrompt: Boolean((window as PlanoWindow).__planoInstallPrompt),
  };
}

export function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>(() => (Platform.OS === 'web' ? readState() : nativeState));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setState(readState());
    window.addEventListener('plano-install-change', update);
    return () => window.removeEventListener('plano-install-change', update);
  }, []);
  return state;
}

/** 追加の確認を出す（出せなければ false） */
export async function promptInstall(): Promise<boolean> {
  const event = (window as PlanoWindow).__planoInstallPrompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  (window as PlanoWindow).__planoInstallPrompt = null;
  window.dispatchEvent(new Event('plano-install-change'));
  return outcome === 'accepted';
}

/** 「今日」画面の案内を閉じたか */
export function isInstallHintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissInstallHint() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true');
  } catch {
    // 保存できなくても、この画面では閉じる
  }
}

/**
 * ブラウザに「このサイトのデータは消さないで」と頼む（空き容量が減ったときなどに消されにくくなる）。
 * Firefox は許可の確認を出すので、Firefox では頼まない
 */
export function requestPersistentStorage() {
  if (Platform.OS !== 'web' || /Firefox/.test(navigator.userAgent)) return;
  navigator.storage?.persist?.().catch(() => {});
}
