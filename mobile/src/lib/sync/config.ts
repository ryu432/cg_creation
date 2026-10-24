// Supabase の接続先。どちらもアプリに入れて公開する前提の値（秘密の鍵ではない）。
// 安全は、データベース側の「本人のデータだけ」の設定（RLS）で守っている（supabase/migrations）。
// 空のあいだは、ログインと同期の機能を出さない
export const SUPABASE_URL = '';
export const SUPABASE_PUBLISHABLE_KEY = '';

export function syncConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';
}
