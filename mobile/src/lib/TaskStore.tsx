import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { BackupData } from './backup';
import { defaultReminderSettings, ReminderSettings } from './notifications';
import { DailyPlan, PlanUsage } from './plan';
import { createProject, createTask, NewTask, normalizeTask, Project, Task } from './tasks';

const TASKS_KEY = 'plano.tasks.v1';
const PROJECTS_KEY = 'plano.projects.v1';
const PLAN_KEY = 'plano.plan.v1';
const PLAN_USAGE_KEY = 'plano.planUsage.v1';
const REMINDERS_KEY = 'plano.reminders.v1';
const ONBOARDED_KEY = 'plano.onboarded.v1';

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
  /** 一括操作（選択モード用） */
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
  /** 初回のチュートリアルを見終わったか */
  onboarded: boolean;
  setOnboarded: (onboarded: boolean) => void;
};

const TaskStoreContext = createContext<TaskStore | null>(null);

// タスクとプロジェクトをスマホ本体（AsyncStorage）に保存する。ログイン・同期は Phase 1 の後半で Supabase に置き換える
export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [reminders, setReminders] = useState<ReminderSettings>(defaultReminderSettings);
  const [onboarded, setOnboarded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([TASKS_KEY, PROJECTS_KEY, PLAN_KEY, PLAN_USAGE_KEY, REMINDERS_KEY, ONBOARDED_KEY])
      .then(([[, tasksJson], [, projectsJson], [, planJson], [, usageJson], [, remindersJson], [, onboardedJson]]) => {
        if (tasksJson) setTasks((JSON.parse(tasksJson) as Task[]).map(normalizeTask));
        if (projectsJson) setProjects(JSON.parse(projectsJson));
        if (planJson) setPlan(JSON.parse(planJson));
        if (usageJson) setPlanUsage(JSON.parse(usageJson));
        if (remindersJson) setReminders({ ...defaultReminderSettings, ...JSON.parse(remindersJson) });
        if (onboardedJson) setOnboarded(JSON.parse(onboardedJson) === true);
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
    AsyncStorage.setItem(ONBOARDED_KEY, JSON.stringify(onboarded)).catch(() => {});
  }, [onboarded, loaded]);

  const addTask = useCallback((input: NewTask) => {
    if (!input.title.trim()) return;
    setTasks((prev) => [...prev, createTask(input)]);
  }, []);

  const updateTask = useCallback((id: string, changes: Partial<Omit<Task, 'id'>>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }, []);

  const toggleDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? t.status === 'todo'
            ? { ...t, status: 'done', completedAt: new Date().toISOString() }
            : { ...t, status: 'todo', completedAt: null }
          : t,
      ),
    );
  }, []);

  const postponeTask = useCallback((id: string, toDate: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, plannedDate: toDate, postponeCount: t.postponeCount + 1 } : t)),
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
    setTasks((prev) =>
      prev.map((t) => (set.has(t.id) && t.status === 'todo' ? { ...t, status: 'done', completedAt: now } : t)),
    );
  }, []);

  const removeTasks = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setTasks((prev) => prev.filter((t) => !set.has(t.id)));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
  }, []);

  const replaceAll = useCallback((data: BackupData) => {
    setTasks(data.tasks);
    setProjects(data.projects);
    setReminders(data.reminders);
    setPlan(null);
  }, []);

  const clearAll = useCallback(() => {
    setTasks([]);
    setProjects([]);
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
  }, []);

  // 採用したプランのタスクを「今日やる」にする。手動で「今日やる」にしたタスクはそのまま残す
  const acceptPlan = useCallback((accepted: DailyPlan) => {
    const ids = new Set(accepted.items.map((i) => i.taskId));
    setPlan(accepted);
    setTasks((prev) =>
      prev.map((t) => (ids.has(t.id) && t.status === 'todo' ? { ...t, plannedDate: accepted.date } : t)),
    );
  }, []);

  const recordPlanRequest = useCallback((date: string) => {
    setPlanUsage((prev) => (prev?.date === date ? { date, count: prev.count + 1 } : { date, count: 1 }));
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
      onboarded,
      setOnboarded,
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
      onboarded,
      setOnboarded,
    ],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTasks(): TaskStore {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error('useTasks は TaskStoreProvider の中で使ってください');
  return store;
}
