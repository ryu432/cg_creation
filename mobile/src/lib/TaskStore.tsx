import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { createTask, NewTask, Task } from './tasks';

const STORAGE_KEY = 'plano.tasks.v1';

type TaskStore = {
  tasks: Task[];
  loaded: boolean;
  addTask: (input: NewTask) => void;
  updateTask: (id: string, changes: Partial<Omit<Task, 'id'>>) => void;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
};

const TaskStoreContext = createContext<TaskStore | null>(null);

// タスクをスマホ本体（AsyncStorage）に保存する。ログイン・同期は Phase 1 の後半で Supabase に置き換える
export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setTasks(JSON.parse(json));
      })
      .catch((e) => console.warn('タスクの読み込みに失敗しました', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    // 読み込み前に保存すると、空の配列で上書きしてしまう
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)).catch((e) =>
      console.warn('タスクの保存に失敗しました', e),
    );
  }, [tasks, loaded]);

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

  const clearAll = useCallback(() => setTasks([]), []);

  const value = useMemo(
    () => ({ tasks, loaded, addTask, updateTask, toggleDone, removeTask, clearCompleted, clearAll }),
    [tasks, loaded, addTask, updateTask, toggleDone, removeTask, clearCompleted, clearAll],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTasks(): TaskStore {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error('useTasks は TaskStoreProvider の中で使ってください');
  return store;
}
