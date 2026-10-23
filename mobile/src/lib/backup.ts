import { defaultReminderSettings, ReminderSettings } from './notifications';
import { normalizeTask, Project, Task } from './tasks';

// データの書き出し・読み込み（バックアップ、別のアプリへの引っ越し用）。
// 中身は JSON の文字列なので、共有機能でメモや LINE などに送り、貼り付けて読み込める

export type BackupData = {
  tasks: Task[];
  projects: Project[];
  reminders: ReminderSettings;
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

// 貼り付けられた文字列を検証して読み込む。形式が違えば BackupError
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new BackupError('書き出したデータの形式ではありません。全部をそのまま貼り付けてください。');
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

  return { tasks: tasks.map(normalizeTask), projects, reminders };
}
