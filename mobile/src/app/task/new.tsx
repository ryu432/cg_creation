import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TaskForm } from '@/components/TaskForm';
import { today } from '@/lib/date';
import { useTasks } from '@/lib/TaskStore';

// タスクの追加。「登録」を押すまで追加しない。
// today=1 なら「今日やる」、projectId があればそのプロジェクトを、はじめから選んだ状態にする
export default function TaskNewScreen() {
  const params = useLocalSearchParams<{ today?: string; projectId?: string }>();
  const { projects, addTask } = useTasks();
  const date = today();

  const [initial] = useState(() => ({
    title: '',
    dueDate: null,
    estimateMinutes: null,
    projectId: projects.some((p) => p.id === params.projectId) ? params.projectId! : null,
    plannedToday: params.today === '1',
    allowSplit: true,
  }));

  return (
    <TaskForm
      initial={initial}
      submitLabel="登録"
      onSubmit={(draft) =>
        addTask({
          title: draft.title,
          dueDate: draft.dueDate,
          estimateMinutes: draft.estimateMinutes,
          projectId: draft.projectId,
          allowSplit: draft.allowSplit,
          plannedDate: draft.plannedToday ? date : null,
        })
      }
    />
  );
}
