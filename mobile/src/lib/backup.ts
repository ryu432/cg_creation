import { defaultReminderSettings, ReminderSettings } from './notifications';
import { defaultSplitSettings, SplitSettings } from './plan';
import { normalizeTask, Project, Task } from './tasks';

// データの書き出し・読み込み（バックアップ、別のアプリへの引っ越し用）。
// 中身は JSON の文字列なので、共有機能でメモや LINE などに送り、貼り付けて読み込める

export type BackupData = {
  tasks: Task[];
  projects: Project[];
  reminders: ReminderSettings;
  /** 古い書き出しデータにはない */
  planSettings?: { split: SplitSettings };
};

const FORMAT = 'plano-backup';
const VERSION = 1;

export function exportBackup(data: BackupData): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), ...data });
}

export class BackupError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 共有先のアプリやコピーで付いた余計なものを取り除く。
// 先頭・末尾の題名などの文字（最初の { から最後の } までを使う）、見えない文字、全角や飾りの引用符、
// メモアプリが折り返しで入れる改行（書き出した文字には改行が入らないので、消しても中身は変わらない）
function cleanPastedText(text: string): string {
  const normalized = text
    .replace(/[\r\n\t]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u201C\u201D\u201E\u201F\u2033\uFF02]/g, '"');
  const start = normalized.indexOf('{');
  const end = normalized.lastIndexOf('}');
  return start >= 0 && end > start ? normalized.slice(start, end + 1) : normalized.trim();
}

// 貼り付けられた文字列を検証して読み込む。形式が違えば BackupError
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(cleanPastedText(text));
  } catch {
    throw new BackupError(
      '読み込めませんでした。書き出したデータを、最初の「{"format"」から最後の「}」まで全部コピーして貼り付けてください。',
    );
  }
  if (!isObject(raw) || raw.format !== FORMAT) {
    throw new BackupError('Plano のデータではないようです。');
  }
  if (typeof raw.version !== 'number' || raw.version > VERSION) {
    throw new BackupError('新しいバージョンの Plano で書き出したデータです。アプリを更新してから読み込んでください。');
  }
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.projects)) {
    throw new BackupError('データが壊れているようです。');
  }

  const tasks = raw.tasks.filter(
    (t): t is Task => isObject(t) && typeof t.id === 'string' && typeof t.title === 'string',
  );
  const projects = raw.projects.filter(
    (p): p is Project => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string',
  );
  const reminders = isObject(raw.reminders)
    ? { ...defaultReminderSettings, ...(raw.reminders as Partial<ReminderSettings>) }
    : defaultReminderSettings;

  const planSettings =
    isObject(raw.planSettings) && isObject(raw.planSettings.split)
      ? { split: { ...defaultSplitSettings, ...(raw.planSettings.split as Partial<SplitSettings>) } }
      : undefined;

  return { tasks: tasks.map(normalizeTask), projects, reminders, planSettings };
}
