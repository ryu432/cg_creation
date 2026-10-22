// プラン提案の入力チェック・プロンプト作成・結果の検証（Claude を呼ばない部分）

export type Energy = 'low' | 'normal' | 'high';

export type PlanTask = {
  id: string;
  title: string;
  dueDate: string | null;
  projectName: string | null;
  plannedToday: boolean;
  createdAt: string;
};

export type PlanRequest = {
  date: string;
  availableMinutes: number;
  energy: Energy;
  tasks: PlanTask[];
};

export type PlanItem = {
  taskId: string;
  estimateMinutes: number;
  reason: string;
};

export type PlanResult = {
  comment: string;
  items: PlanItem[];
};

const MAX_TASKS = 100;
const MAX_TITLE_LENGTH = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidRequestError extends Error {}

function asDate(value: unknown): string | null {
  return typeof value === 'string' && DATE_PATTERN.test(value) ? value : null;
}

// アプリから届いた JSON を検証して、必要な項目だけを取り出す
export function parsePlanRequest(body: unknown): PlanRequest {
  if (typeof body !== 'object' || body === null) throw new InvalidRequestError('body must be an object');
  const b = body as Record<string, unknown>;

  const date = asDate(b.date);
  if (!date) throw new InvalidRequestError('date must be YYYY-MM-DD');

  const availableMinutes = Number(b.availableMinutes);
  if (!Number.isInteger(availableMinutes) || availableMinutes < 15 || availableMinutes > 24 * 60) {
    throw new InvalidRequestError('availableMinutes must be an integer between 15 and 1440');
  }

  if (b.energy !== 'low' && b.energy !== 'normal' && b.energy !== 'high') {
    throw new InvalidRequestError('energy must be low, normal or high');
  }

  if (!Array.isArray(b.tasks) || b.tasks.length === 0) throw new InvalidRequestError('tasks must be a non-empty array');
  if (b.tasks.length > MAX_TASKS) throw new InvalidRequestError(`tasks must be ${MAX_TASKS} or fewer`);

  const tasks = b.tasks.map((raw, i): PlanTask => {
    const t = (raw ?? {}) as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id || typeof t.title !== 'string' || !t.title.trim()) {
      throw new InvalidRequestError(`tasks[${i}] needs id and title`);
    }
    return {
      id: t.id.slice(0, 64),
      title: t.title.trim().slice(0, MAX_TITLE_LENGTH),
      dueDate: asDate(t.dueDate),
      projectName: typeof t.projectName === 'string' ? t.projectName.slice(0, 50) : null,
      plannedToday: t.plannedToday === true,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt.slice(0, 10) : '',
    };
  });

  return { date, availableMinutes, energy: b.energy, tasks };
}

export const SYSTEM_PROMPT = `あなたはタスク管理アプリ「Plano」のプランナーです。
ユーザーの未完了タスクの一覧から、今日取り組むタスクを選んで提案します。

選び方:
- 合計の見積もり時間が「今日使える時間」を超えないようにする。迷ったら少なめにする（予定を詰め込みすぎると終わらず、やる気をなくすため）。
- 期限切れ・期限が今日や近いタスクを優先する。
- 体力・気分が「低い」日は、短くて軽いタスクを中心にする。「高い」日は重いタスクにも取り組める。
- ユーザーが「今日やる」に入れているタスクは、無理がない限り含める。
- 選ぶ数はふつう3〜5個。時間が少ない日はもっと少なくてよい。
- 一覧にないタスクを作らない。taskId は一覧の id をそのまま使う。

各タスクについて:
- estimateMinutes: タイトルから推定した所要時間（分、5分単位）。
- reason: なぜ今日それをやるのかを、日本語で40文字以内で具体的に書く（例:「金曜締切。今日進めないと間に合いません」）。

comment: 今日のプラン全体についての一言を、日本語で60文字以内で、やさしく前向きに書く。

items は取り組む順番に並べる。`;

const ENERGY_LABEL: Record<Energy, string> = { low: '低い', normal: '普通', high: '高い' };

export function buildUserMessage(req: PlanRequest): string {
  const lines = req.tasks.map((t) =>
    JSON.stringify({
      id: t.id,
      title: t.title,
      due: t.dueDate,
      project: t.projectName,
      plannedToday: t.plannedToday,
      created: t.createdAt,
    }),
  );
  return [
    `今日: ${req.date}`,
    `今日使える時間: ${req.availableMinutes}分`,
    `体力・気分: ${ENERGY_LABEL[req.energy]}`,
    '',
    '未完了タスク（1行に1件）:',
    ...lines,
  ].join('\n');
}

export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    comment: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          estimateMinutes: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['taskId', 'estimateMinutes', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['comment', 'items'],
  additionalProperties: false,
};

// Claude の出力を検証する。一覧にないタスク・重複は捨て、数値は範囲内に収める
export function sanitizePlan(raw: unknown, req: PlanRequest): PlanResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const knownIds = new Set(req.tasks.map((t) => t.id));
  const seen = new Set<string>();
  const items: PlanItem[] = [];

  for (const value of Array.isArray(r.items) ? r.items : []) {
    const item = (value ?? {}) as Record<string, unknown>;
    const taskId = typeof item.taskId === 'string' ? item.taskId : '';
    if (!knownIds.has(taskId) || seen.has(taskId)) continue;
    seen.add(taskId);
    const minutes = Math.round(Number(item.estimateMinutes));
    items.push({
      taskId,
      estimateMinutes: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 480) : 30,
      reason: typeof item.reason === 'string' ? item.reason.trim().slice(0, 80) : '',
    });
    if (items.length >= 10) break;
  }

  return {
    comment: typeof r.comment === 'string' ? r.comment.trim().slice(0, 120) : '',
    items,
  };
}
