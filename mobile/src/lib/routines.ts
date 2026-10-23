import { addDays } from './date';
import { createTask, type Task } from './tasks';

// ルーティン（繰り返しタスク）。ルールだけを持ち、一覧には「次の1回」だけを普通のタスクとして出す。
// その回を達成（またはスキップ）すると、次の回のタスクを作る

/** 月末を表す特別な日（毎月のパターンで使う） */
export const LAST_DAY_OF_MONTH = 32;

export type RepeatRule =
  | { kind: 'interval'; days: number }
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'monthly'; days: number[] };

export type Routine = {
  id: string;
  title: string;
  /** 詳細（毎回のタスクに引き継ぐ） */
  note?: string;
  estimateMinutes: number | null;
  projectId: string | null;
  allowSplit: boolean;
  rule: RepeatRule;
  createdAt: string;
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function parse(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function weekdayOf(date: string): number {
  const { y, m, d } = parse(date);
  return new Date(y, m - 1, d).getDay();
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** その日がルールに合う日か（月にない日付は、その月の最終日として扱う） */
export function matchesRule(rule: RepeatRule, date: string): boolean {
  switch (rule.kind) {
    case 'interval':
      return true;
    case 'weekly':
      return rule.weekdays.includes(weekdayOf(date));
    case 'monthly': {
      const { y, m, d } = parse(date);
      const last = daysInMonth(y, m);
      return rule.days.some((day) => (day >= last ? d === last : d === day));
    }
  }
}

/** ルールとして成り立っているか（曜日・日付を1つ以上選んでいるか） */
export function isValidRule(rule: RepeatRule): boolean {
  switch (rule.kind) {
    case 'interval':
      return Number.isInteger(rule.days) && rule.days >= 1 && rule.days <= 365;
    case 'weekly':
      return rule.weekdays.length > 0;
    case 'monthly':
      return rule.days.length > 0;
  }
}

/** 最初の回の予定日：from（その日を含む）以降で、ルールに合う最初の日 */
export function firstOccurrence(rule: RepeatRule, from: string): string {
  if (rule.kind === 'interval') return from;
  let date = from;
  for (let i = 0; i < 400; i++) {
    if (matchesRule(rule, date)) return date;
    date = addDays(date, 1);
  }
  return from;
}

/**
 * 次の回の予定日。今の回の予定日より後で、今日以降の最初の日。
 * ○日ごと：予定日から○日ずつ進めて、今日以降になる日（遅れて達成しても、リズムは崩さない）
 */
export function nextOccurrence(rule: RepeatRule, occurrence: string, today: string): string {
  if (rule.kind === 'interval') {
    let date = addDays(occurrence, rule.days);
    while (date < today) date = addDays(date, rule.days);
    return date;
  }
  const start = addDays(occurrence, 1) > today ? addDays(occurrence, 1) : today;
  return firstOccurrence(rule, start);
}

/** 一覧などに出す短い説明（「2日ごと」「毎週 月・水・金」「毎月 1日・月末」） */
export function describeRule(rule: RepeatRule): string {
  switch (rule.kind) {
    case 'interval':
      return rule.days === 1 ? '毎日' : `${rule.days}日ごと`;
    case 'weekly':
      return rule.weekdays.length === 7
        ? '毎日'
        : `毎週 ${[...rule.weekdays].sort((a, b) => a - b).map((w) => WEEKDAY_LABELS[w]).join('・')}`;
    case 'monthly':
      return `毎月 ${[...rule.days]
        .sort((a, b) => a - b)
        .map((d) => (d === LAST_DAY_OF_MONTH ? '月末' : `${d}日`))
        .join('・')}`;
  }
}

export { WEEKDAY_LABELS };

/** ルーティンの1回分のタスクを作る（予定日を期限にする） */
export function createOccurrence(routine: Routine, date: string, plannedDate: string | null = null): Task {
  return createTask({
    title: routine.title,
    note: routine.note ?? '',
    dueDate: date,
    plannedDate,
    projectId: routine.projectId,
    estimateMinutes: routine.estimateMinutes,
    allowSplit: routine.allowSplit,
    routineId: routine.id,
  });
}

/**
 * 回を終えた（達成・スキップした）ルーティンについて、まだ次の回がなければ作って足す。
 * done: 終えた回の { ルーティンの id, 予定日 } の一覧
 */
export function addNextOccurrences(
  tasks: Task[],
  routines: Routine[],
  done: { routineId: string; date: string }[],
  today: string,
): Task[] {
  const result = [...tasks];
  for (const { routineId, date } of done) {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) continue;
    const hasPending = result.some((t) => t.routineId === routineId && t.status === 'todo');
    if (hasPending) continue;
    result.push(createOccurrence(routine, nextOccurrence(routine.rule, date, today)));
  }
  return result;
}
