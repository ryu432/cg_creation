import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useTasks } from '../TaskStore';
import { syncConfigured } from './config';
import { noticeChanges, syncOnce } from './engine';
import { emptyMeta, SyncData, SyncMeta } from './records';
import { getSupabase, supabaseTransport } from './supabase';

const META_KEY = 'plano.sync.v1';
/** スマホのアプリで、Google のログインから戻ってくる先 */
export const AUTH_CALLBACK_URL = 'plano://auth-callback';
/** 開いているあいだ、この間隔でサーバーの変更を見に行く */
const SYNC_INTERVAL_MS = 60 * 1000;

export type SyncStatus = 'off' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error';

type SyncContextValue = {
  /** ログインと同期が使えるか（Supabase の設定があるか） */
  available: boolean;
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: Date | null;
  signIn: () => Promise<void>;
  /** keepLocal = false なら、この端末のデータも消す */
  signOut: (keepLocal: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

// Google から戻ってきた code を、1回だけログインに使う（アプリと画面の両方が受け取ることがあるため）
const usedCodes = new Set<string>();
export async function completeSignIn(code: string) {
  const supabase = getSupabase();
  if (!supabase || usedCodes.has(code)) return;
  usedCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) console.warn('ログインに失敗しました', error.message);
}

function isNetworkError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return /network|fetch|failed to fetch|timeout|offline/i.test(message);
}

// ログインの状態を持ち、ログインしているあいだはタスクなどをサーバーとそろえる
export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useTasks();
  const { tasks, projects, routines, planSettings, plan, loaded, applyRemoteChanges, clearAll } = store;
  const available = syncConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(available ? 'signedOut' : 'off');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const meta = useRef<SyncMeta>(emptyMeta());
  const running = useRef(false);
  // サーバーから届いた変更を当てはめて、まだ画面のデータに反映されていない時刻（0 なら反映済み）。
  // 反映前に比べると、古い中身を「手元の変更」と見間違えるので、そのあいだは待つ
  const appliedAt = useRef(0);

  const data: SyncData = useMemo(
    () => ({ tasks, projects, routines, planSettings, plan }),
    [tasks, projects, routines, planSettings, plan],
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const userId = session?.user.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const saveMeta = (next: SyncMeta) => {
    meta.current = next;
    AsyncStorage.setItem(META_KEY, JSON.stringify(next)).catch((e) => console.warn('同期の記録の保存に失敗しました', e));
  };

  // ログインの状態を見張る
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!available) return;
    AsyncStorage.getItem(META_KEY)
      .then((json) => {
        if (json) meta.current = { ...emptyMeta(), ...JSON.parse(json) };
      })
      .catch(() => {})
      .finally(() => setMetaLoaded(true));
  }, [available]);

  const ready = available && loaded && metaLoaded && userId !== null;

  // 画面のデータが新しくなったら、届いた変更は反映済み
  useEffect(() => {
    appliedAt.current = 0;
  }, [data]);
  const busy = () => running.current || (appliedAt.current !== 0 && Date.now() - appliedAt.current < 1500);
  const onChanges = useCallback(
    (changes: Parameters<typeof applyRemoteChanges>[0]) => {
      appliedAt.current = Date.now();
      applyRemoteChanges(changes);
    },
    [applyRemoteChanges],
  );

  const syncNow = useCallback(async () => {
    const supabase = getSupabase();
    const uid = userIdRef.current;
    if (!supabase || !uid) return;
    // 同期中・反映待ちのときは、少しあとでもう一度
    if (busy()) {
      setTimeout(() => syncRef.current(), 1000);
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const result = await syncOnce({
        meta: meta.current,
        userId: uid,
        data: dataRef.current,
        transport: supabaseTransport(supabase),
        now: () => new Date().toISOString(),
        onChanges,
      });
      saveMeta(result.meta);
      setStatus('synced');
      setLastSyncedAt(new Date());
    } catch (e) {
      console.warn('同期に失敗しました', e);
      setStatus(isNetworkError(e) ? 'offline' : 'error');
    } finally {
      running.current = false;
    }
  }, [onChanges]);
  const syncRef = useRef(syncNow);
  syncRef.current = syncNow;

  // データが変わったら、変わったことに気づいた時刻を記録し、少し待ってから送る
  useEffect(() => {
    if (!ready) return;
    let notice: ReturnType<typeof setTimeout>;
    const noticeLater = () => {
      notice = setTimeout(() => {
        if (busy()) return noticeLater();
        const uid = userIdRef.current;
        if (!uid) return;
        const base = meta.current.userId === uid ? meta.current : emptyMeta(uid);
        saveMeta(noticeChanges(base, dataRef.current, new Date().toISOString()));
      }, 500);
    };
    noticeLater();
    const sync = setTimeout(syncNow, 3000);
    return () => {
      clearTimeout(notice);
      clearTimeout(sync);
    };
  }, [ready, data, syncNow]);

  // ログインしたとき・定期的に・アプリに戻ってきたときに同期する
  useEffect(() => {
    if (!ready) {
      if (available && userId === null) setStatus('signedOut');
      return;
    }
    syncNow();
    const timer = setInterval(syncNow, SYNC_INTERVAL_MS);
    const subs: (() => void)[] = [];
    if (Platform.OS === 'web') {
      const onFocus = () => syncNow();
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onFocus);
      subs.push(() => {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('online', onFocus);
      });
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') syncNow();
      });
      subs.push(() => sub.remove());
    }
    return () => {
      clearInterval(timer);
      subs.forEach((off) => off());
    };
  }, [ready, available, userId, syncNow]);

  const signIn = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (Platform.OS === 'web') {
      // Google のページへ移り、ログインしたらこのサイトに戻ってくる
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
      return;
    }
    const { data: oauth, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true },
    });
    if (error || !oauth.url) throw error ?? new Error('ログインを始められませんでした');
    const result = await WebBrowser.openAuthSessionAsync(oauth.url, AUTH_CALLBACK_URL);
    if (result.type !== 'success') return;
    const code = new URL(result.url).searchParams.get('code');
    if (code) await completeSignIn(code);
  }, []);

  const signOut = useCallback(
    async (keepLocal: boolean) => {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.auth.signOut({ scope: 'local' });
      saveMeta(emptyMeta());
      setLastSyncedAt(null);
      if (!keepLocal) clearAll();
    },
    [clearAll],
  );

  const deleteAccount = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc('delete_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
    saveMeta(emptyMeta());
    setLastSyncedAt(null);
  }, []);

  const value = useMemo(
    () => ({
      available,
      email: session?.user.email ?? null,
      status,
      lastSyncedAt,
      signIn,
      signOut,
      deleteAccount,
      syncNow,
    }),
    [available, session, status, lastSyncedAt, signIn, signOut, deleteAccount, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync は SyncProvider の中で使ってください');
  return value;
}
