import { addDays, formatDueDate } from '../date';
import type { Energy, PlanInput, PlanItem, PlanProposal } from '../plan';
import type { Task } from '../tasks';

// 端末内のルールでプランを作る（無料・オフラインで動く）

/** 見積もり時間が設定されていないタスクは、この時間で計算する */
export const DEFAULT_ESTIMATE_MINUTES = 30;

// 体力・気分ごとの、選ぶ件数の上限、「使える時間」のうち埋める割合、1件あたりの長さの上限（分）
const ENERGY_RULES: Record<Energy, { maxItems: number; fillRatio: number; maxTaskMinutes: number | null }> = {
  low: { maxItems: 3, fillRatio: 0.75, maxTaskMinutes: 60 },
  normal: { maxItems: 5, fillRatio: 1, maxTaskMinutes: null },
  high: { maxItems: 6, fillRatio: 1, maxTaskMinutes: null },
};

// 優先度の段階（小さいほど先に選ぶ）
const Tier = {
  Overdue: 0,
  DueToday: 1,
  PlannedToday: 2,
  DueTomorrow: 3,
  DueThisWeek: 4,
  Other: 5,
} as const;
type Tier = (typeof Tier)[keyof typeof Tier];

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function tierOf(task: Task, date: string): Tier {
  if (task.dueDate !== null && task.dueDate < date) return Tier.Overdue;
  if (task.dueDate === date) return Tier.DueToday;
  if (task.plannedDate === date) return Tier.PlannedToday;
  if (task.dueDate === addDays(date, 1)) return Tier.DueTomorrow;
  if (task.dueDate !== null && task.dueDate <= addDays(date, 7)) return Tier.DueThisWeek;
  return Tier.Other;
}

function reasonFor(task: Task, tier: Tier, date: string): string {
  switch (tier) {
    case Tier.Overdue:
      return `期限が${daysBetween(task.dueDate!, date)}日過ぎています`;
    case Tier.DueToday:
      return '今日が期限です';
    case Tier.PlannedToday:
      return '「今日やる」に入れたタスクです';
    case Tier.DueTomorrow:
      return '明日が期限です。今日進めておくと安心です';
    case Tier.DueThisWeek:
      return `${formatDueDate(task.dueDate!)}が期限です`;
    case Tier.Other: {
      const age = daysBetween(task.createdAt.slice(0, 10), date);
      return age >= 7 ? `${age}日前から残っています` : '時間に余裕があるので進めておきましょう';
    }
  }
}

function commentFor(energy: Energy, hasOverdue: boolean, items: PlanItem[]): string {
  if (items.length === 0) return '';
  const first = hasOverdue ? '期限切れのタスクから片付けましょう。' : '';
  const second =
    energy === 'low'
      ? '今日は無理せず、少なめにしました。'
      : energy === 'high'
        ? '調子がいい日なので、多めに入れました。'
        : '無理のない量にしました。';
  return first + second;
}

export async function localPlanner(input: PlanInput): Promise<PlanProposal> {
  const { date, availableMinutes, energy } = input;
  const rule = ENERGY_RULES[energy];
  const budget = availableMinutes * rule.fillRatio;

  // 優先度の段階 → 期限が早い順 → 古くから残っている順
  const candidates = input.tasks
    .filter((t) => t.status === 'todo')
    .map((task) => ({ task, tier: tierOf(task, date) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999') ||
        a.task.createdAt.localeCompare(b.task.createdAt),
    );

  const items: PlanItem[] = [];
  let total = 0;
  for (const { task, tier } of candidates) {
    if (items.length >= rule.maxItems) break;
    const estimate = task.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES;
    // 期限切れ・今日が期限のものは、時間を少し超えても入れる（合計が多いことは画面で知らせる）
    const mustDo = tier === Tier.Overdue || tier === Tier.DueToday;
    if (!mustDo) {
      if (rule.maxTaskMinutes !== null && estimate > rule.maxTaskMinutes) continue;
      if (items.length > 0 && total + estimate > budget) continue;
    }
    items.push({
      taskId: task.id,
      estimateMinutes: estimate,
      reason: reasonFor(task, tier, date),
      estimateIsDefault: task.estimateMinutes === null,
    });
    total += estimate;
  }

  const hasOverdue = candidates.some((c) => c.tier === Tier.Overdue);
  return { comment: commentFor(energy, hasOverdue, items), items };
}
