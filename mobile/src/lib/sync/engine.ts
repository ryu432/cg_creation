// 1回分の同期の手順（サーバーの種類に依存しない。テストでは偽のサーバーを使う）。
//   1. 手元の変更を見つける
//   2. サーバーの変更を受け取り、手元に反映する（このアカウントで初めてなら、同じ記録はサーバーの中身を優先）
//   3. 手元の変更を送る。サーバーにもっと新しい変更があって受け入れられなかったものは、取り寄せて反映する

import {
  applyChanges,
  applyPull,
  buildPush,
  detectChanges,
  emptyMeta,
  markPushed,
  RecordKind,
  recordKey,
  RemoteChanges,
  RemoteRow,
  SyncData,
  SyncMeta,
  toRecords,
} from './records';

export type Transport = {
  /** since より後にサーバーに届いた行（since が null なら全部）。server_updated_at の古い順 */
  pull: (since: string | null) => Promise<RemoteRow[]>;
  /** 行を送り、受け入れられた行のキー（"task:<id>" など）を返す */
  push: (rows: (RemoteRow & { user_id: string })[]) => Promise<Set<string>>;
  /** 指定した記録の今のサーバーの行 */
  fetch: (keys: { kind: RecordKind; id: string }[]) => Promise<RemoteRow[]>;
};

/** 受け取りの重なり。サーバーへの書き込みが届いた順と時刻の順がずれても取りこぼさないように、少し前から受け取り直す */
const PULL_OVERLAP_MS = 2 * 60 * 1000;

function since(cursor: string | null): string | null {
  if (cursor === null) return null;
  const t = Date.parse(cursor);
  return Number.isNaN(t) ? null : new Date(t - PULL_OVERLAP_MS).toISOString();
}

export async function syncOnce(options: {
  meta: SyncMeta;
  userId: string;
  data: SyncData;
  transport: Transport;
  now: () => string;
  /** 受け取った変更を、画面のデータ（最新のもの）に当てはめる */
  onChanges: (changes: RemoteChanges) => void;
}): Promise<{ meta: SyncMeta; pushed: number; received: number }> {
  const { transport, userId, now, onChanges } = options;
  let meta = options.meta.userId === userId ? options.meta : emptyMeta(userId);
  const firstTime = meta.cursor === null && Object.keys(meta.synced).length === 0;
  let data = options.data;
  let received = 0;

  const receive = (rows: RemoteRow[], preferServer = false) => {
    const result = applyPull(meta, rows, { preferServer });
    meta = result.meta;
    if (result.changes.size > 0) {
      received += result.changes.size;
      data = applyChanges(data, result.changes);
      onChanges(result.changes);
    }
  };

  // 1・2
  meta = detectChanges(meta, toRecords(data), now());
  receive(await transport.pull(since(meta.cursor)), firstTime);

  // 3
  meta = detectChanges(meta, toRecords(data), now());
  const rows = buildPush(meta, toRecords(data), userId);
  if (rows.length > 0) {
    const accepted = await transport.push(rows);
    meta = markPushed(meta, rows, accepted);
    const rejected = rows.filter((r) => !accepted.has(recordKey(r.kind, r.id)));
    if (rejected.length > 0) {
      const latest = await transport.fetch(rejected.map((r) => ({ kind: r.kind, id: r.id })));
      // 受け取りの目印（cursor）は進めない（ここで取り寄せたのは一部だけなので）
      const cursor = meta.cursor;
      receive(latest, true);
      meta = { ...meta, cursor };
    }
  }
  return { meta, pushed: rows.length, received };
}

/** 手元の変更に気づいたら、その時刻を記録する（同期とは別に、データが変わるたびに呼ぶ。電波がなくても記録できる） */
export function noticeChanges(meta: SyncMeta, data: SyncData, now: string): SyncMeta {
  return detectChanges(meta, toRecords(data), now);
}
