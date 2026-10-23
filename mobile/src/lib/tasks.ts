import { toDateString } from './date';

export type TaskStatus = 'todo' | 'done';

export type Task = {
  id: string;
  title: string;
  /** 期限（YYYY-MM-DD） */
  dueDate: string | null;
  /** 「今日やる」に入れた日（YYYY-MM-DD）。AIのプラン提案が入るまでは手動で選ぶ */
  plannedDate: string | null;
  projectId: string | null;
  /** 見積もり時間（分）。任意 */
  estimateMinutes: number | null;
  /** 振り返りで「明日に回す」を選んだ回数 */
  postponeCount: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
};

export type NewTask = {
  title: string;
  dueDate?: string | null;
  plannedDate?: string | null;
  projectId?: string | null;
  estimateMinutes?: number | null;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

// プロジェクトの色（ライト / ダークどちらでも見やすい、彩度低めの色）
export const projectColors = ['#F28C4B', '#E07A8B', '#9B8AD6', '#5B9BD5', '#4FAE9B', '#C9A94B'];

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createProject(name: string, color: string): Project {
  return { id: newId(), name: name.trim(), color, createdAt: new Date().toISOString() };
}

export function createTask(input: NewTask): Task {
  return {
    id: newId(),
    title: input.title.trim(),
    dueDate: input.dueDate ?? null,
    plannedDate: input.plannedDate ?? null,
    projectId: input.projectId ?? null,
    estimateMinutes: input.estimateMinutes ?? null,
    postponeCount: 0,
    status: 'todo',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

// 古いバージョンで保存されたタスクに、後から増えた項目を補う
export function normalizeTask(task: Task): Task {
  return {
    ...task,
    projectId: task.projectId ?? null,
    estimateMinutes: task.estimateMinutes ?? null,
    postponeCount: task.postponeCount ?? 0,
  };
}

export const estimateOptions = [
  { label: '15分', minutes: 15 },
  { label: '30分', minutes: 30 },
  { label: '1時間', minutes: 60 },
  { label: '2時間', minutes: 120 },
  { label: '半日', minutes: 240 },
];

export function isOverdue(task: Task, date: string): boolean {
  return task.status === 'todo' && task.dueDate !== null && task.dueDate < date;
}

/**
 * 「今日」画面に出すタスク。
 * 未完了: 今日やると決めたもの、期限が今日以前のもの
 * 完了: 今日完了したもの
 */
export function isTodayTask(task: Task, date: string): boolean {
  if (task.status === 'done') {
    return task.completedAt !== null && toDateString(new Date(task.completedAt)) === date;
  }
  return task.plannedDate === date || (task.dueDate !== null && task.dueDate <= date);
}

/** この回数以上先送りしたタスクには、分けるか見直すよう声をかける */
export const POSTPONE_WARNING_COUNT = 3;

/**
 * 振り返りの対象になる、やり残したタスク。
 * 今日以前に「今日やる」にしたもの、期限が今日以前のもので、まだ終わっていないもの
 */
export function isLeftoverTask(task: Task, date: string): boolean {
  if (task.status !== 'todo') return false;
  return (task.plannedDate !== null && task.plannedDate <= date) || (task.dueDate !== null && task.dueDate <= date);
}

/** 前の日までに「今日やる」にしたまま終わらなかったタスク（今日の画面には出ないので拾い上げる） */
export function isMissedPlannedTask(task: Task, date: string): boolean {
  return task.status === 'todo' && task.plannedDate !== null && task.plannedDate < date;
}

// 未完了 → 完了の順。未完了は期限が近い順（期限なしは最後）、同じなら作成順
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    if (a.status === 'done') return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
