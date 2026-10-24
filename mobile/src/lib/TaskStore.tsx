import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { BackupData } from './backup';
import { defaultReminderSettings, ReminderSettings } from './notifications';
import { DailyPlan, defaultSplitSettings, PlanUsage, SplitSettings } from './plan';
import { today } from './date';
import { addNextOccurrences, createOccurrence, firstOccurrence, RepeatRule, Routine } from './routines';
import { applyList, recordKey, RemoteChanges } from './sync/records';
import { createProject, createTask, newId, NewTask, normalizeTask, Project, Task } from './tasks';

const TASKS_KEY = 'plano.tasks.v1';
const PROJECTS_KEY = 'plano.projects.v1';
const PLAN_KEY = 'plano.plan.v1';
const PLAN_USAGE_KEY = 'plano.planUsage.v1';
const REMINDERS_KEY = 'plano.reminders.v1';
const ONBOARDED_KEY = 'plano.onboarded.v1';
const PLAN_SETTINGS_KEY = 'plano.planSettings.v1';
const ROUTINES_KEY = 'plano.routines.v1';

export type PlanSettings = { split: SplitSettings };
export const defaultPlanSettings: PlanSettings = { split: defaultSplitSettings };

type TaskStore = {
  tasks: Task[];
  projects: Project[];
  loaded: boolean;
  addTask: (input: NewTask) => void;
  updateTask: (id: string, changes: Partial<Omit<Task, 'id'>>) => void;
  toggleDone: (id: string) => void;
  /** 「今日やる」を別の日に移す。先送りの回数も数える */
  postponeTask: (id: string, toDate: string) => void;
  removeTask: (id: string) => void;
  /** ルーティン（繰り返しタスク） */
  routines: Routine[];
  /** ルーティンを作り、最初の回のタスクを足す（firstDate がなければルールに合う今日以降の最初の日） */
  addRoutine: (input: Omit<Routine, 'id' | 'createdAt'>, firstDate: string | null, plannedToday: boolean) => void;
  /** 今あるタスクをルーティンの1回目にする */
  makeRoutine: (taskId: string, rule: RepeatRule) => void;
  /** ルーティン全体を変える。次の回（未完了の回）にも反映し、ルールが変わったら予定日を決め直す */
  updateRoutine: (id: string, changes: Partial<Omit<Routine, 'id' | 'createdAt'>>) => void;
  /** この回だけ飛ばして、次の回を作る */
  skipOccurrence: (taskId: string) => void;
  /** ルーティンをやめる。未完了の回は単発のタスクとして残す */
  endRoutine: (id: string) => void;
  /** ルーティンごと削除。未完了の回も消す（達成した記録は残る） */
  removeRoutine: (id: string) => void;
  /** 一括操作（選択モード用）。ルーティンの回の削除は「この回だけ削除」になる */
  updateTasks: (ids: string[], changes: Partial<Omit<Task, 'id'>>) => void;
  completeTasks: (ids: string[]) => void;
  removeTasks: (ids: string[]) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  /** 読み込んだバックアップで、タスク・プロジェクト・通知の設定を置き換える */
  replaceAll: (data: BackupData) => void;
  addProject: (name: string, color: string) => Project | null;
  updateProject: (id: string, changes: Partial<Pick<Project, 'name' | 'color'>>) => void;
  removeProject: (id: string) => void;
  /** 最後に採用したプラン */
  plan: DailyPlan | null;
  planUsage: PlanUsage | null;
  acceptPlan: (plan: DailyPlan) => void;
  recordPlanRequest: (date: string) => void;
  reminders: ReminderSettings;
  setReminders: (reminders: ReminderSettings) => void;
  /** 自動プランの設定（大きいタスクの区切り方など） */
  planSettings: PlanSettings;
  setPlanSettings: (settings: PlanSettings) => void;
  /** 同期でサーバーから届いた変更を当てはめる */
  applyRemoteChanges: (changes: RemoteChanges) => void;
  /** 初回のチュートリアルを見終わったか */
  onboarded: boolean;
  setOnboarded: (onboarded: boolean) => void;
};

const TaskStoreContext = createContext<TaskStore | null>(null);

// タスクとプロジェクトをスマホ本体（AsyncStorage）に保存する。ログインしているときは SyncProvider がサーバーとそろえる
export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [reminders, setReminders] = useState<ReminderSettings>(defaultReminderSettings);
  const [planSettings, setPlanSettings] = useState<PlanSettings>(defaultPlanSettings);
  const [onboarded, setOnboarded] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loaded, setLoaded] = useState(false);
  // setTasks の中から最新のルーティンを参照するため
  const routinesRef = useRef<Routine[]>([]);
  routinesRef.current = routines;

  useEffect(() => {
    AsyncStorage.multiGet([TASKS_KEY, PROJECTS_KEY, PLAN_KEY, PLAN_USAGE_KEY, REMINDERS_KEY, ONBOARDED_KEY, PLAN_SETTINGS_KEY, ROUTINES_KEY])
      .then(([[, tasksJson], [, projectsJson], [, planJson], [, usageJson], [, remindersJson], [, onboardedJson], [, planSettingsJson], [, routinesJson]]) => {
        if (tasksJson) setTasks((JSON.parse(tasksJson) as Task[]).map(normalizeTask));
        if (projectsJson) setProjects(JSON.parse(projectsJson));
        if (planJson) setPlan(JSON.parse(planJson));
        if (usageJson) setPlanUsage(JSON.parse(usageJson));
        if (remindersJson) setReminders({ ...defaultReminderSettings, ...JSON.parse(remindersJson) });
        if (onboardedJson) setOnboarded(JSON.parse(onboardedJson) === true);
        if (routinesJson) setRoutines(JSON.parse(routinesJson));
        if (planSettingsJson) {
          const saved = JSON.parse(planSettingsJson);
          setPlanSettings({ split: { ...defaultSplitSettings, ...saved.split } });
        }
      })
      .catch((e) => console.warn('データの読み込みに失敗しました', e))
      .finally(() => setLoaded(true));
  }, []);

  // 読み込み前に保存すると、空の配列で上書きしてしまう
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks)).catch((e) =>
      console.warn('タスクの保存に失敗しました', e),
    );
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)).catch((e) =>
      console.warn('プロジェクトの保存に失敗しました', e),
    );
  }, [projects, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan)).catch((e) => console.warn('プランの保存に失敗しました', e));
  }, [plan, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PLAN_USAGE_KEY, JSON.stringify(planUsage)).catch((e) =>
      console.warn('利用回数の保存に失敗しました', e),
    );
  }, [planUsage, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch((e) =>
      console.warn('通知の設定の保存に失敗しました', e),
    );
  }, [reminders, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PLAN_SETTINGS_KEY, JSON.stringify(planSettings)).catch(() => {});
  }, [planSettings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines)).catch((e) =>
      console.warn('ルーティンの保存に失敗しました', e),
    );
  }, [routines, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ONBOARDED_KEY, JSON.stringify(onboarded)).catch(() => {});
  }, [onboarded, loaded]);

  const addTask = useCallback((input: NewTask) => {
    if (!input.title.trim()) return;
    setTasks((prev) => [...prev, createTask(input)]);
  }, []);

  const updateTask = useCallback((id: string, changes: Partial<Omit<Task, 'id'>>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }, []);

  // ルーティンの回を達成したら次の回を作る。達成を取り消したら、そのとき作った次の回を消す
  const toggleDone = useCallback((id: string) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;
      if (target.status === 'todo') {
        const next = prev.map((t) =>
          t.id === id ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() } : t,
        );
        return target.routineId && target.dueDate
          ? addNextOccurrences(next, routinesRef.current, [{ routineId: target.routineId, date: target.dueDate }], today())
          : next;
      }
      return prev
        .filter(
          (t) =>
            !(
              target.routineId &&
              t.routineId === target.routineId &&
              t.status === 'todo' &&
              t.dueDate !== null &&
              target.dueDate !== null &&
              t.dueDate > target.dueDate
            ),
        )
        .map((t) => (t.id === id ? { ...t, status: 'todo' as const, completedAt: null } : t));
    });
  }, []);

  const postponeTask = useCallback((id: string, toDate: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              plannedDate: toDate,
              postponeCount: t.postponeCount + 1,
              // ルーティンの回は、予定日（期限）ごとずらす
              dueDate: t.routineId ? toDate : t.dueDate,
            }
          : t,
      ),
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTasks = useCallback((ids: string[], changes: Partial<Omit<Task, 'id'>>) => {
    const set = new Set(ids);
    setTasks((prev) => prev.map((t) => (set.has(t.id) ? { ...t, ...changes } : t)));
  }, []);

  const completeTasks = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const now = new Date().toISOString();
    setTasks((prev) => {
      const done = prev
        .filter((t) => set.has(t.id) && t.status === 'todo' && t.routineId && t.dueDate)
        .map((t) => ({ routineId: t.routineId!, date: t.dueDate! }));
      const next = prev.map((t) =>
        set.has(t.id) && t.status === 'todo' ? { ...t, status: 'done' as const, completedAt: now } : t,
      );
      return addNextOccurrences(next, routinesRef.current, done, today());
    });
  }, []);

  const removeTasks = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setTasks((prev) => {
      const skipped = prev
        .filter((t) => set.has(t.id) && t.status === 'todo' && t.routineId && t.dueDate)
        .map((t) => ({ routineId: t.routineId!, date: t.dueDate! }));
      return addNextOccurrences(
        prev.filter((t) => !set.has(t.id)),
        routinesRef.current,
        skipped,
        today(),
      );
    });
  }, []);

  const addRoutine = useCallback(
    (input: Omit<Routine, 'id' | 'createdAt'>, firstDate: string | null, plannedToday: boolean) => {
      const routine: Routine = { ...input, title: input.title.trim(), id: newId(), createdAt: new Date().toISOString() };
      const date = firstDate ?? firstOccurrence(routine.rule, today());
      setRoutines((prev) => [...prev, routine]);
      setTasks((prev) => [...prev, createOccurrence(routine, date, plannedToday ? today() : null)]);
    },
    [],
  );

  const makeRoutine = useCallback((taskId: string, rule: RepeatRule) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const routine: Routine = {
        id: newId(),
        title: task.title,
        note: task.note,
        estimateMinutes: task.estimateMinutes,
        projectId: task.projectId,
        allowSplit: task.allowSplit,
        rule,
        createdAt: new Date().toISOString(),
      };
      setRoutines((r) => [...r, routine]);
      return prev.map((t) =>
        t.id === taskId ? { ...t, routineId: routine.id, dueDate: t.dueDate ?? firstOccurrence(rule, today()) } : t,
      );
    });
  }, []);

  const updateRoutine = useCallback((id: string, changes: Partial<Omit<Routine, 'id' | 'createdAt'>>) => {
    const current = routinesRef.current.find((r) => r.id === id);
    if (!current) return;
    const updated = { ...current, ...changes };
    const ruleChanged = changes.rule !== undefined && JSON.stringify(changes.rule) !== JSON.stringify(current.rule);
    setRoutines((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setTasks((prev) =>
      prev.map((t) =>
        t.routineId === id && t.status === 'todo'
          ? {
              ...t,
              title: updated.title,
              note: updated.note ?? t.note,
              estimateMinutes: updated.estimateMinutes,
              projectId: updated.projectId,
              allowSplit: updated.allowSplit,
              dueDate: ruleChanged ? firstOccurrence(updated.rule, today()) : t.dueDate,
            }
          : t,
      ),
    );
  }, []);

  const skipOccurrence = useCallback((taskId: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const rest = prev.filter((t) => t.id !== taskId);
      return task.routineId && task.dueDate
        ? addNextOccurrences(rest, routinesRef.current, [{ routineId: task.routineId, date: task.dueDate }], today())
        : rest;
    });
  }, []);

  const endRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setTasks((prev) => prev.map((t) => (t.routineId === id && t.status === 'todo' ? { ...t, routineId: null } : t)));
  }, []);

  const removeRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setTasks((prev) => prev.filter((t) => !(t.routineId === id && t.status === 'todo')));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
  }, []);

  const replaceAll = useCallback((data: BackupData) => {
    setTasks(data.tasks);
    setProjects(data.projects);
    setReminders(data.reminders);
    setRoutines(data.routines ?? []);
    if (data.planSettings) setPlanSettings(data.planSettings);
    setPlan(null);
  }, []);

  const clearAll = useCallback(() => {
    setTasks([]);
    setProjects([]);
    setRoutines([]);
    setPlan(null);
  }, []);

  const addProject = useCallback((name: string, color: string) => {
    if (!name.trim()) return null;
    const project = createProject(name, color);
    setProjects((prev) => [...prev, project]);
    return project;
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Pick<Project, 'name' | 'color'>>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }, []);

  // プロジェクトを消しても、中のタスクは「プロジェクトなし」として残す
  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTasks((prev) => prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
    setRoutines((prev) => prev.map((r) => (r.projectId === id ? { ...r, projectId: null } : r)));
  }, []);

  // 採用したプランのタスクを「今日やる」にし、プランに入っていない「今日やる」は外す（タスク自体は残る）
  const acceptPlan = useCallback((accepted: DailyPlan) => {
    const ids = new Set(accepted.items.map((i) => i.taskId));
    setPlan(accepted);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.status !== 'todo') return t;
        if (ids.has(t.id)) return { ...t, plannedDate: accepted.date };
        if (t.plannedDate === accepted.date) return { ...t, plannedDate: null };
        return t;
      }),
    );
  }, []);

  const recordPlanRequest = useCallback((date: string) => {
    setPlanUsage((prev) => (prev?.date === date ? { date, count: prev.count + 1 } : { date, count: 1 }));
  }, []);

  const applyRemoteChanges = useCallback((changes: RemoteChanges) => {
    setTasks((prev) => applyList(prev, 'task', changes, (v) => normalizeTask(v as Task)));
    setProjects((prev) => applyList(prev, 'project', changes, (v) => v as Project));
    setRoutines((prev) => applyList(prev, 'routine', changes, (v) => v as Routine));
    const settings = changes.get(recordKey('setting', 'planSettings')) as Partial<PlanSettings> | null | undefined;
    if (settings) setPlanSettings({ split: { ...defaultSplitSettings, ...settings.split } });
    const planKey = recordKey('setting', 'plan');
    if (changes.has(planKey)) setPlan((changes.get(planKey) as { plan?: DailyPlan | null } | null)?.plan ?? null);
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      projects,
      loaded,
      addTask,
      updateTask,
      toggleDone,
      postponeTask,
      removeTask,
      routines,
      addRoutine,
      makeRoutine,
      updateRoutine,
      skipOccurrence,
      endRoutine,
      removeRoutine,
      updateTasks,
      completeTasks,
      removeTasks,
      clearCompleted,
      clearAll,
      replaceAll,
      addProject,
      updateProject,
      removeProject,
      plan,
      planUsage,
      acceptPlan,
      recordPlanRequest,
      reminders,
      setReminders,
      planSettings,
      setPlanSettings,
      onboarded,
      setOnboarded,
      applyRemoteChanges,
    }),
    [
      tasks,
      projects,
      loaded,
      addTask,
      updateTask,
      toggleDone,
      postponeTask,
      removeTask,
      routines,
      addRoutine,
      makeRoutine,
      updateRoutine,
      skipOccurrence,
      endRoutine,
      removeRoutine,
      updateTasks,
      completeTasks,
      removeTasks,
      clearCompleted,
      clearAll,
      replaceAll,
      addProject,
      updateProject,
      removeProject,
      plan,
      planUsage,
      acceptPlan,
      recordPlanRequest,
      reminders,
      setReminders,
      planSettings,
      setPlanSettings,
      onboarded,
      setOnboarded,
      applyRemoteChanges,
    ],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTasks(): TaskStore {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error('useTasks は TaskStoreProvider の中で使ってください');
  return store;
}
