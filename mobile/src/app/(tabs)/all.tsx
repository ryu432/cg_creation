import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddTaskBar } from '@/components/AddTaskBar';
import { TaskList } from '@/components/TaskList';
import { useTheme } from '@/constants/theme';
import { sortTasks } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export default function AllTasksScreen() {
  const theme = useTheme();
  const { tasks } = useTasks();
  const [showDone, setShowDone] = useState(false);
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const visible = sortTasks(showDone ? tasks : tasks.filter((t) => t.status === 'todo'));

  return (
    <TaskList
      tasks={visible}
      emptyMessage={'タスクはまだありません。\n思いついたことを上の欄に書いてみましょう。'}
      header={
        <View style={styles.header}>
          <AddTaskBar placeholder="タスクを追加" />
          {doneCount > 0 && (
            <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={8}>
              <Text style={[styles.toggle, { color: theme.subText }]}>
                {showDone ? '完了したタスクを隠す' : `完了したタスクを表示（${doneCount}）`}
              </Text>
            </Pressable>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
    marginBottom: 6,
  },
  toggle: {
    fontSize: 13,
    textAlign: 'right',
  },
});
