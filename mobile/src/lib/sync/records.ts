// 同期の中心になる計算（画面やサーバーに依存しない部分。テストしやすいようにここにまとめる）。
//
// しくみ：
//   - タスク・プロジェクト・ルーティン・設定を「1件ずつの記録」として扱う（キーは "task:<id>" など）
//   - 最後にサーバーとそろえたときの中身（synced）を覚えておき、今の中身と比べて変わったものを「未送信」（pending）にする。
//     未送信には、変わったことに気づいた時刻を付ける（電波がなくても、編集した時刻に近い値になる）
//   - サーバーから届いた変更は、こちらにもっと新しい未送信の変更がなければ反映する
//   - 同じ記録を2つの端末で変えたときは、後から変更したほうが残る（サーバー側でも同じ決まりで守る）

import { DailyPlan } from '../plan';
import { Routine } from '../routines';
import { normalizeTask, Project, Task } from '../tasks';

export type RecordKind = 'task' | 'project' | 'routine' | 'setting';

/** 同期するデータ（通知の時刻・チュートリアルを見たかなどは端末ごとなので含めない） */
export type SyncData = {
  tasks: Task[];
  projects: Project[];
  routines: Routine[];
  planSettings: unknown;
  plan: DailyPlan | null;
};

/** サーバーの1行 */
export type RemoteRow = {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
  server_updated_at?: string;
};

export type SyncMeta = {
  /** どのアカウントとそろえた記録か（別のアカウントでログインしたら最初からやり直す） */
  userId: string | null;
  /** ここまでのサーバーの変更は受け取った（server_updated_at） */
  cursor: string | null;
  /** 最後にサーバーとそろえたときの中身（キー → 並びをそろえた JSON） */
  synced: Record<string, string>;
  /** まだサーバーに送っていない変更（キー → 変わったことに気づいた時刻と、そのときの中身。削除は json が null） */
  pending: Record<string, Pending>;
};

export type Pending = { at: string; json: string | null };

export const emptyMeta = (userId: string | null = null): SyncMeta => ({ userId, cursor: null, synced: {}, pending: {} });

/** キーの並びをそろえた JSON（サーバーから戻るとキーの順番が変わるので、そのまま比べると違うものに見える） */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export const recordKey = (kind: RecordKind, id: string) => `${kind}:${id}`;

function splitKey(key: string): { kind: RecordKind; id: string } {
  const i = key.indexOf(':');
  return { kind: key.slice(0, i) as RecordKind, id: key.slice(i + 1) };
}

/** 今のデータを、キー → 中身 の一覧にする */
export function toRecords(data: SyncData): Map<string, unknown> {
  const records = new Map<string, unknown>();
  for (const t of data.tasks) records.set(recordKey('task', t.id), t);
  for (const p of data.projects) records.set(recordKey('project', p.id), p);
  for (const r of data.routines) records.set(recordKey('routine', r.id), r);
  records.set(recordKey('setting', 'planSettings'), data.planSettings);
  records.set(recordKey('setting', 'plan'), { plan: data.plan });
  return records;
}

/** 今の中身と、最後にそろえた中身を比べて、未送信の変更を更新する */
export function detectChanges(meta: SyncMeta, records: Map<string, unknown>, now: string): SyncMeta {
  const pending = { ...meta.pending };
  const seen = new Set<string>();
  for (const [key, value] of records) {
    seen.add(key);
    const json = stableStringify(value);
    if (json === meta.synced[key]) delete pending[key];
    // また変わったら、時刻を付け直す
    else if (pending[key]?.json !== json) pending[key] = { at: now, json };
  }
  // 消えたもの（サーバーにはあるのに、手元にない）
  for (const key of Object.keys(meta.synced)) {
    if (!seen.has(key) && pending[key]?.json !== null) pending[key] = { at: now, json: null };
  }
  // 一度未送信になって、手元からもなくなり、サーバーにもないもの（作ってすぐ消した）は送らない
  for (const key of Object.keys(pending)) {
    if (!seen.has(key) && !(key in meta.synced)) delete pending[key];
  }
  return { ...meta, pending };
}

/** サーバーに送る行 */
export function buildPush(meta: SyncMeta, records: Map<string, unknown>, userId: string): (RemoteRow & { user_id: string })[] {
  return Object.entries(meta.pending).map(([key, { at }]) => {
    const { kind, id } = splitKey(key);
    const value = records.get(key);
    return {
      user_id: userId,
      kind,
      id,
      data: value === undefined ? {} : value,
      deleted: value === undefined,
      updated_at: at,
    };
  });
}

/**
 * 送った行がサーバーに受け入れられたら、そろえた中身を更新し、その後に変わっていなければ未送信から外す。
 * accepted に入っていない行は、サーバーにもっと新しい変更があった（あとで取り寄せて反映する）
 */
export function markPushed(meta: SyncMeta, pushed: RemoteRow[], accepted: Set<string>): SyncMeta {
  const synced = { ...meta.synced };
  const pending = { ...meta.pending };
  for (const row of pushed) {
    const key = recordKey(row.kind, row.id);
    if (!accepted.has(key)) continue;
    if (row.deleted) delete synced[key];
    else synced[key] = stableStringify(row.data);
    // 送ったあとにまた変わっていなければ、未送信から外す
    if (pending[key]?.at === row.updated_at) delete pending[key];
  }
  return { ...meta, synced, pending };
}

/** 手元に反映する変更（キー → 新しい中身。null は削除） */
export type RemoteChanges = Map<string, unknown | null>;

/**
 * サーバーから届いた行を受け取る。
 * こちらにもっと新しい未送信の変更があれば、その行は反映しない（あとでこちらの変更を送る）。
 * preferServer = true のとき（このアカウントで初めてそろえるとき）は、同じ記録ならサーバーの中身を優先する
 */
export function applyPull(
  meta: SyncMeta,
  rows: RemoteRow[],
  options: { preferServer?: boolean } = {},
): { meta: SyncMeta; changes: RemoteChanges } {
  const synced = { ...meta.synced };
  const pending = { ...meta.pending };
  const changes: RemoteChanges = new Map();
  let cursor = meta.cursor;
  for (const row of rows) {
    if (row.server_updated_at && (cursor === null || row.server_updated_at > cursor)) cursor = row.server_updated_at;
    const key = recordKey(row.kind, row.id);
    // もう受け取った中身（重ねて受け取り直した行など）は、何もしない
    const json = row.deleted ? null : stableStringify(row.data);
    if (json === (synced[key] ?? null)) continue;
    const local = pending[key];
    // 時刻の書き方がサーバーと違う（Z と +00:00 など）ので、数値にして比べる
    if (!options.preferServer && local !== undefined && Date.parse(local.at) > Date.parse(row.updated_at)) continue;
    delete pending[key];
    if (row.deleted) {
      delete synced[key];
      changes.set(key, null);
    } else {
      synced[key] = json!;
      changes.set(key, row.data);
    }
  }
  return { meta: { ...meta, synced, pending, cursor }, changes };
}

/** 届いた変更を、タスクなどの一覧に当てはめる（変更がなければ同じ配列を返す） */
export function applyList<T extends { id: string }>(list: T[], kind: RecordKind, changes: RemoteChanges, normalize: (v: unknown) => T): T[] {
  let result = list;
  let touched = false;
  const ids = new Set(list.map((item) => item.id));
  const updated = list.map((item) => {
    const key = recordKey(kind, item.id);
    if (!changes.has(key)) return item;
    touched = true;
    const value = changes.get(key);
    return value === null ? null : normalize(value);
  });
  const added: T[] = [];
  for (const [key, value] of changes) {
    const { kind: k, id } = splitKey(key);
    if (k !== kind || ids.has(id) || value === null) continue;
    touched = true;
    added.push(normalize(value));
  }
  if (touched) result = [...updated.filter((item): item is T => item !== null), ...added];
  return result;
}

/** 届いた変更を、今の（最新の）データに当てはめる */
export function applyChanges(data: SyncData, changes: RemoteChanges): SyncData {
  if (changes.size === 0) return data;
  const planSettingsKey = recordKey('setting', 'planSettings');
  const planKey = recordKey('setting', 'plan');
  const planValue = changes.get(planKey) as { plan?: DailyPlan | null } | null | undefined;
  return {
    tasks: applyList(data.tasks, 'task', changes, (v) => normalizeTask(v as Task)),
    projects: applyList(data.projects, 'project', changes, (v) => v as Project),
    routines: applyList(data.routines, 'routine', changes, (v) => v as Routine),
    planSettings: changes.has(planSettingsKey) && changes.get(planSettingsKey) !== null ? changes.get(planSettingsKey) : data.planSettings,
    plan: changes.has(planKey) ? (planValue?.plan ?? null) : data.plan,
  };
}
