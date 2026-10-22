import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { formatDueDate, today } from '@/lib/date';
import { isOverdue, Task } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export function TaskItem({ task }: { task: Task }) {
  const theme = useTheme();
  const { toggleDone } = useTasks();
  const date = today();
  const done = task.status === 'done';
  const overdue = isOverdue(task, date);
  const planned = !done && task.plannedDate === date;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Pressable onPress={() => toggleDone(task.id)} hitSlop={12} accessibilityLabel="完了を切り替え">
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={done ? theme.primary : theme.subText}
        />
      </Pressable>
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: done ? theme.subText : theme.text },
            done && styles.doneTitle,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {(task.dueDate || planned) && !done && (
          <View style={styles.meta}>
            {task.dueDate && (
              <Text style={[styles.metaText, { color: overdue ? theme.danger : theme.subText }]}>
                <Ionicons name="calendar-outline" size={12} /> {formatDueDate(task.dueDate)}
                {overdue ? '（期限切れ）' : ''}
              </Text>
            )}
            {planned && (
              <Text style={[styles.metaText, { color: theme.primary }]}>
                <Ionicons name="sunny-outline" size={12} /> 今日やる
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
  },
});
