import Constants from 'expo-constants';

import { aiPlanner, isAiPlannerConfigured } from './planners/ai';
import { localPlanner } from './planners/local';
import { Project, Task } from './tasks';

export { PlanError } from './planError';

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

export type PlanItem = {
  taskId: string;
  estimateMinutes: number;
  reason: string;
  /** タスクに見積もり時間がなく、仮の時間で計算したとき true */
  estimateIsDefault?: boolean;
  /** 大きいタスクを区切って入れたときの、タスク全体の見積もり時間（estimateMinutes は今日進める分） */
  totalMinutes?: number;
};

/** 大きいタスクを区切ってプランに入れるときの条件（設定画面で変えられる） */
export type SplitSettings = {
  enabled: boolean;
  /** 見積もりがこの長さ以上のタスクだけ区切る（分） */
  minTaskMinutes: number;
  /** 1回に進める時間（分） */
  chunkMinutes: number;
};

export const defaultSplitSettings: SplitSettings = { enabled: true, minTaskMinutes: 60, chunkMinutes: 30 };

export const splitThresholdOptions = [
  { label: '1時間以上', minutes: 60 },
  { label: '2時間以上', minutes: 120 },
];

export const chunkOptions = [
  { label: '30分', minutes: 30 },
  { label: '1時間', minutes: 60 },
];

/** プランの見積もり時間の表示（区切ったときは「30分だけ（全体 約4時間）」） */
export function formatPlanItemTime(item: PlanItem): string {
  if (item.totalMinutes) return `${formatMinutes(item.estimateMinutes)}だけ（全体 約${formatMinutes(item.totalMinutes)}）`;
  return `約${formatMinutes(item.estimateMinutes)}${item.estimateIsDefault ? '（仮）' : ''}`;
}

export type PlannerKind = 'local' | 'ai';

export type DailyPlan = {
  date: string;
  availableMinutes: number;
  energy: Energy;
  comment: string;
  /** 採用したタスクだけを、取り組む順に保存する */
  items: PlanItem[];
  /** どの方式で作ったプランか（古いデータにはない） */
  planner?: PlannerKind;
  createdAt: string;
};

export type PlanUsage = {
  date: string;
  count: number;
};

export type PlanInput = {
  date: string;
  availableMinutes: number;
  energy: Energy;
  tasks: Task[];
  projects: Project[];
  split: SplitSettings;
};

export type PlanProposal = {
  comment: string;
  items: PlanItem[];
};

/**
 * プランの作り方。今は端末内のルールで作る local と、サーバー経由で Claude に頼む ai がある。
 * 新しい方式を足すときは、この形の関数を planners/ に作って getPlanner に登録する
 */
export type Planner = {
  kind: PlannerKind;
  /** 1日に作れる回数（null は無制限）。AI はお金がかかるので回数を絞る */
  dailyLimit: number | null;
  /** 使える状態か（AI なら接続先が設定済みか） */
  isReady: () => boolean;
  propose: (input: PlanInput) => Promise<PlanProposal>;
};

const planners: Record<PlannerKind, Planner> = {
  local: { kind: 'local', dailyLimit: null, isReady: () => true, propose: localPlanner },
  ai: { kind: 'ai', dailyLimit: 3, isReady: isAiPlannerConfigured, propose: aiPlanner },
};

// app.json の expo.extra.planner で切り替える（"local" または "ai"、未設定なら local）
export function getPlanner(): Planner {
  const kind = Constants.expoConfig?.extra?.planner;
  return kind === 'ai' ? planners.ai : planners.local;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
