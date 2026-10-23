import Constants from 'expo-constants';

import type { PlanInput, PlanProposal } from '../plan';
import { PlanError } from '../planError';

// AI（Claude）でプランを作る。サーバー（supabase/functions/plan）経由で呼ぶので、
// 使うには app.json の expo.extra に planner: "ai" と planApiUrl を設定する
function planApiUrl(): string | null {
  const url = Constants.expoConfig?.extra?.planApiUrl;
  return typeof url === 'string' && url ? url : null;
}

export function isAiPlannerConfigured(): boolean {
  return planApiUrl() !== null;
}

export async function aiPlanner(input: PlanInput): Promise<PlanProposal> {
  const url = planApiUrl();
  if (!url) throw new PlanError('AI の接続先がまだ設定されていません。');

  const todo = input.tasks.filter((t) => t.status === 'todo').slice(0, 100);
  const body = {
    date: input.date,
    availableMinutes: input.availableMinutes,
    energy: input.energy,
    tasks: todo.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      projectName: input.projects.find((p) => p.id === t.projectId)?.name ?? null,
      plannedToday: t.plannedDate === input.date,
      estimateMinutes: t.estimateMinutes,
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
