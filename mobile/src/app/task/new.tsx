import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TaskDraft, TaskForm } from '@/components/TaskForm';
import { today } from '@/lib/date';
import { useTasks } from '@/lib/TaskStore';

// タスクの追加。「登録」を押すまで追加しない。繰り返しを選んだらルーティンとして登録する。
// today=1 なら「今日やる」、projectId があればそのプロジェクトを、はじめから選んだ状態にする
export default function TaskNewScreen() {
  const params = useLocalSearchParams<{ today?: string; projectId?: string }>();
  const { projects, addTask, addRoutine } = useTasks();
  const date = today();

  const [initial] = useState<TaskDraft>(() => ({
    title: '',
    note: '',
    repeat: null,
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
      onSubmit={(draft) => {
        if (draft.repeat) {
          addRoutine(
            {
              title: draft.title,
              note: draft.note,
              estimateMinutes: draft.estimateMinutes,
              projectId: draft.projectId,
              allowSplit: draft.allowSplit,
              rule: draft.repeat,
            },
            draft.dueDate,
            draft.plannedToday,
          );
          return;
        }
        addTask({
          title: draft.title,
          note: draft.note,
          dueDate: draft.dueDate,
          estimateMinutes: draft.estimateMinutes,
          projectId: draft.projectId,
          allowSplit: draft.allowSplit,
          plannedDate: draft.plannedToday ? date : null,
        });
      }}
    />
  );
}
