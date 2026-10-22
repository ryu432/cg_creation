import Constants from 'expo-constants';

import { Project, Task } from './tasks';

export type Energy = 'low' | 'normal' | 'high';

export const availableTimeOptions = [
  { label: '30分', minutes: 30 },
  { label: '1時間', minutes: 60 },
  { label: '2時間', minutes: 120 },
  { label: '半日', minutes: 240 },
  { label: '1日', minutes: 480 },
];

export const energyOptions: { label: string; value: Energy }[] = [
  { label: '😫 低い', value: 'low' },
  { label: '🙂 普通', value: 'normal' },
  { label: '💪 高い', value: 'high' },
];

/** 無料プランで1日に使える AI プラン提案の回数 */
export const DAILY_PLAN_LIMIT = 3;

export type PlanItem = {
  taskId: string;
  estimateMinutes: number;
  reason: string;
};

export type DailyPlan = {
  date: string;
  availableMinutes: number;
  energy: Energy;
  comment: string;
  /** 採用したタスクだけを、取り組む順に保存する */
  items: PlanItem[];
  createdAt: string;
};

export type PlanUsage = {
  date: string;
  count: number;
};

export class PlanError extends Error {}

function planApiUrl(): string | null {
  const url = Constants.expoConfig?.extra?.planApiUrl;
  return typeof url === 'string' && url ? url : null;
}

export function isPlanApiConfigured(): boolean {
  return planApiUrl() !== null;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

// 未完了タスクをサーバー（Supabase Edge Function）に送り、Claude にプランを提案してもらう
export async function requestPlan(params: {
  date: string;
  availableMinutes: number;
  energy: Energy;
  tasks: Task[];
  projects: Project[];
}): Promise<{ comment: string; items: PlanItem[] }> {
  const url = planApiUrl();
  if (!url) throw new PlanError('AI の接続先がまだ設定されていません。');

  const todo = params.tasks.filter((t) => t.status === 'todo').slice(0, 100);
  const body = {
    date: params.date,
    availableMinutes: params.availableMinutes,
    energy: params.energy,
    tasks: todo.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      projectName: params.projects.find((p) => p.id === t.projectId)?.name ?? null,
      plannedToday: t.plannedDate === params.date,
      createdAt: t.createdAt,
    })),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PlanError('通信できませんでした。電波の状態を確認してください。');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data.message === 'string' ? data.message : null;
    throw new PlanError(message ?? `提案の作成に失敗しました（${response.status}）`);
  }
  if (!data || !Array.isArray(data.items)) throw new PlanError('AI の回答を読み取れませんでした。');
  return { comment: typeof data.comment === 'string' ? data.comment : '', items: data.items };
}
