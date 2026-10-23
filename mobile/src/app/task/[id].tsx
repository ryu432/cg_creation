import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TaskDraft, TaskForm } from '@/components/TaskForm';
import { useTheme } from '@/constants/theme';
import { choose, confirm } from '@/lib/confirm';
import { today } from '@/lib/date';
import { useTasks } from '@/lib/TaskStore';

// タスクの編集。「保存」を押したときだけ変更を反映する。
// ルーティンの回なら、Googleカレンダーの繰り返し予定のように「この回だけ／次の回以降も」を選べる
export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { tasks, routines, updateTask, removeTask, makeRoutine, updateRoutine, endRoutine, skipOccurrence, removeRoutine } =
    useTasks();
  const task = tasks.find((t) => t.id === id);
  const routine = task?.routineId ? routines.find((r) => r.id === task.routineId) : undefined;
  const date = today();

  // 編集を始めたときの内容を下書きの初期値として固定する
  const [initial] = useState<TaskDraft | null>(() =>
    task
      ? {
          title: task.title,
          note: task.note,
          repeat: routine?.rule ?? null,
          dueDate: task.dueDate,
          estimateMinutes: task.estimateMinutes,
          projectId: task.projectId,
          plannedToday: task.plannedDate === date,
          allowSplit: task.allowSplit,
        }
      : null,
  );

  if (!task || !initial) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.subText }}>タスクが見つかりませんでした。</Text>
      </View>
    );
  }

  // この回（このタスク）にだけ反映する内容
  const occurrenceChanges = (draft: TaskDraft) => ({
    title: draft.title,
    note: draft.note,
    dueDate: draft.dueDate,
    estimateMinutes: draft.estimateMinutes,
    projectId: draft.projectId,
    allowSplit: draft.allowSplit,
    // 「今日やる」をオフにしたときだけ外す（明日などに予定しているものはそのまま）
    plannedDate: draft.plannedToday ? date : task.plannedDate === date ? null : task.plannedDate,
  });

  // ルーティン（ひな形）に反映する内容
  const templateChanges = (draft: TaskDraft) => ({
    title: draft.title,
    note: draft.note,
    estimateMinutes: draft.estimateMinutes,
    projectId: draft.projectId,
    allowSplit: draft.allowSplit,
  });

  const save = async (draft: TaskDraft): Promise<boolean> => {
    // 単発 → ルーティンにする
    if (!routine) {
      updateTask(task.id, occurrenceChanges(draft));
      if (draft.repeat) makeRoutine(task.id, draft.repeat);
      return true;
    }
    // ルーティン → 繰り返しをやめる（この回は単発のタスクとして残す）
    if (!draft.repeat) {
      endRoutine(routine.id);
      updateTask(task.id, occurrenceChanges(draft));
      return true;
    }
    // 繰り返し方を変えたときは、ルーティン全体の変更（次の予定日も決め直す）
    if (JSON.stringify(draft.repeat) !== JSON.stringify(routine.rule)) {
      updateRoutine(routine.id, { ...templateChanges(draft), rule: draft.repeat });
      if (draft.dueDate !== initial.dueDate) updateTask(task.id, { dueDate: draft.dueDate });
      updateTask(task.id, { plannedDate: occurrenceChanges(draft).plannedDate });
      return true;
    }
    // 名前・詳細などを変えたときは、この回だけか次の回以降もかを選ぶ
    const template = templateChanges(draft);
    const templateChanged = JSON.stringify(template) !== JSON.stringify(templateChanges(initial));
    if (!templateChanged) {
      updateTask(task.id, occurrenceChanges(draft));
      return true;
    }
    const scope = await choose('変更の反映先', 'このルーティンの変更を、どこまで反映しますか？', [
      { label: 'この回だけ', value: 'one' },
      { label: '次の回以降も', value: 'all' },
    ]);
    if (!scope) return false;
    if (scope === 'all') updateRoutine(routine.id, template);
    updateTask(task.id, occurrenceChanges(draft));
    return true;
  };

  const remove = async (): Promise<boolean> => {
    if (!routine) {
      if (!(await confirm('タスクを削除', `「${task.title}」を削除します。`, '削除', true))) return false;
      removeTask(task.id);
      return true;
    }
    const choice = await choose('ルーティンの削除', `「${task.title}」（${task.dueDate ?? ''}の回）をどうしますか？`, [
      { label: 'この回だけ削除', value: 'one' },
      { label: 'ルーティンごと削除', value: 'all', destructive: true },
    ]);
    if (choice === 'one') skipOccurrence(task.id);
    else if (choice === 'all') removeRoutine(routine.id);
    return choice !== null;
  };

  return <TaskForm initial={initial} submitLabel="保存" onSubmit={save} onDelete={remove} />;
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
