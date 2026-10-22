import { StyleSheet, Text, View } from 'react-native';

import { AddTaskBar } from '@/components/AddTaskBar';
import { TaskList } from '@/components/TaskList';
import { useTheme } from '@/constants/theme';
import { today } from '@/lib/date';
import { isTodayTask, sortTasks } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export default function TodayScreen() {
  const theme = useTheme();
  const { tasks } = useTasks();
  const date = today();
  const todayTasks = sortTasks(tasks.filter((t) => isTodayTask(t, date)));
  const doneCount = todayTasks.filter((t) => t.status === 'done').length;

  const [, m, d] = date.split('-').map(Number);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date().getDay()];

  return (
    <TaskList
      tasks={todayTasks}
      emptyMessage={'今日やることはまだありません。\n上の欄から追加するか、「すべて」から選びましょう。'}
      header={
        <View style={styles.header}>
          <View style={styles.summary}>
            <Text style={[styles.date, { color: theme.text }]}>
              {m}月{d}日({weekday})
            </Text>
            {todayTasks.length > 0 && (
              <Text style={[styles.progress, { color: theme.primary }]}>
                {doneCount} / {todayTasks.length} 完了
              </Text>
            )}
          </View>
          <AddTaskBar placeholder="今日やることを追加" defaults={{ plannedDate: date }} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
    marginBottom: 6,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
});
