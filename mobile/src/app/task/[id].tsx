import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TaskForm } from '@/components/TaskForm';
import { useTheme } from '@/constants/theme';
import { today } from '@/lib/date';
import { useTasks } from '@/lib/TaskStore';

// タスクの編集。「保存」を押したときだけ変更を反映する
export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { tasks, updateTask, removeTask } = useTasks();
  const task = tasks.find((t) => t.id === id);
  const date = today();

  // 編集を始めたときの内容を下書きの初期値として固定する
  const [initial] = useState(() =>
    task
      ? {
          title: task.title,
          dueDate: task.dueDate,
          estimateMinutes: task.estimateMinutes,
          projectId: task.projectId,
          plannedToday: task.plannedDate === date,
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

  return (
    <TaskForm
      initial={initial}
      submitLabel="保存"
      onSubmit={(draft) =>
        updateTask(task.id, {
          title: draft.title,
          dueDate: draft.dueDate,
          estimateMinutes: draft.estimateMinutes,
          projectId: draft.projectId,
          // 「今日やる」をオフにしたときだけ外す（明日などに予定しているものはそのまま）
          plannedDate: draft.plannedToday ? date : task.plannedDate === date ? null : task.plannedDate,
        })
      }
      onDelete={() => removeTask(task.id)}
    />
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
