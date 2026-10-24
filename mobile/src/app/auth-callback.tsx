import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { completeSignIn } from '@/lib/sync/SyncProvider';

// スマホのアプリで Google のログインから戻ってきたとき（plano://auth-callback?code=...）に開く画面。
// ログインを終えて、設定画面に戻す
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    if (code) completeSignIn(code);
  }, [code]);
  return <Redirect href="/settings" />;
}
