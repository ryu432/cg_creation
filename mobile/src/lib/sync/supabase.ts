import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, syncConfigured } from './config';
import { RecordKind, recordKey, RemoteRow } from './records';
import type { Transport } from './engine';

let client: SupabaseClient | null = null;

/** Supabase の接続（設定がなければ null） */
export function getSupabase(): SupabaseClient | null {
  if (!syncConfigured()) return null;
  if (client) return client;
  const web = Platform.OS === 'web';
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // ログイン状態の保存先（Web はブラウザの localStorage）
      storage: web ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web は Google から戻ってきたときの URL（?code=...）でログインを終える
      detectSessionInUrl: web,
      flowType: 'pkce',
      ...(web ? {} : { lock: processLock }),
    },
  });
  if (!web) {
    // アプリを開いているあいだだけ、ログインの期限を自動で延ばす
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

const COLUMNS = 'kind,id,data,deleted,updated_at,server_updated_at';
const PAGE = 500;

/** 同期の手順（engine.ts）が使う、サーバーとのやりとり */
export function supabaseTransport(supabase: SupabaseClient): Transport {
  return {
    async pull(since) {
      const rows: RemoteRow[] = [];
      let after = since;
      for (;;) {
        let query = supabase.from('records').select(COLUMNS).order('server_updated_at').limit(PAGE);
        if (after) query = query.gt('server_updated_at', after);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data as RemoteRow[]));
        if (data.length < PAGE) return rows;
        after = (data[data.length - 1] as RemoteRow).server_updated_at ?? after;
      }
    },
    async push(rows) {
      const accepted = new Set<string>();
      for (let i = 0; i < rows.length; i += 200) {
        // 古い変更はサーバーが受け入れない（返ってこない）
        const { data, error } = await supabase
          .from('records')
          .upsert(rows.slice(i, i + 200), { onConflict: 'user_id,kind,id' })
          .select('kind,id');
        if (error) throw error;
        for (const row of data as { kind: RecordKind; id: string }[]) accepted.add(recordKey(row.kind, row.id));
      }
      return accepted;
    },
    async fetch(keys) {
      const wanted = new Set(keys.map((k) => recordKey(k.kind, k.id)));
      const ids = [...new Set(keys.map((k) => k.id))];
      const rows: RemoteRow[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('records').select(COLUMNS).in('id', ids.slice(i, i + 100));
        if (error) throw error;
        rows.push(...(data as RemoteRow[]).filter((r) => wanted.has(recordKey(r.kind, r.id))));
      }
      return rows;
    },
  };
}
