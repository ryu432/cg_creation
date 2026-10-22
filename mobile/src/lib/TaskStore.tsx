import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { createProject, createTask, NewTask, normalizeTask, Project, Task } from './tasks';

const TASKS_KEY = 'plano.tasks.v1';
const PROJECTS_KEY = 'plano.projects.v1';

type TaskStore = {
  tasks: Task[];
  projects: Project[];
  loaded: boolean;
  addTask: (input: NewTask) => void;
  updateTask: (id: string, changes: Partial<Omit<Task, 'id'>>) => void;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  addProject: (name: string, color: string) => Project | null;
  updateProject: (id: string, changes: Partial<Pick<Project, 'name' | 'color'>>) => void;
  removeProject: (id: string) => void;
};

const TaskStoreContext = createContext<TaskStore | null>(null);

// タスクとプロジェクトをスマホ本体（AsyncStorage）に保存する。ログイン・同期は Phase 1 の後半で Supabase に置き換える
export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([TASKS_KEY, PROJECTS_KEY])
      .then(([[, tasksJson], [, projectsJson]]) => {
        if (tasksJson) setTasks((JSON.parse(tasksJson) as Task[]).map(normalizeTask));
        if (projectsJson) setProjects(JSON.parse(projectsJson));
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

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
  }, []);

  const clearAll = useCallback(() => {
    setTasks([]);
    setProjects([]);
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

  const value = useMemo(
    () => ({
      tasks,
      projects,
      loaded,
      addTask,
      updateTask,
      toggleDone,
      removeTask,
      clearCompleted,
      clearAll,
      addProject,
      updateProject,
      removeProject,
    }),
    [
      tasks,
      projects,
      loaded,
      addTask,
      updateTask,
      toggleDone,
      removeTask,
      clearCompleted,
      clearAll,
      addProject,
      updateProject,
      removeProject,
    ],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTasks(): TaskStore {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error('useTasks は TaskStoreProvider の中で使ってください');
  return store;
}
