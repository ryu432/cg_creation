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
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
};

export type NewTask = {
  title: string;
  dueDate?: string | null;
  plannedDate?: string | null;
  projectId?: string | null;
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
    status: 'todo',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

// 古いバージョンで保存されたタスクに、後から増えた項目を補う
export function normalizeTask(task: Task): Task {
  return { ...task, projectId: task.projectId ?? null };
}

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
