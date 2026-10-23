import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { formatDueDate, today } from '@/lib/date';
import { formatMinutes } from '@/lib/plan';
import { isOverdue, Task } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

type Props = {
  task: Task;
  /** タスク名の下に出す補足（「今日」画面でのプランの理由など） */
  note?: string;
  /** 選択モード中か。選択モードではタップで選択を切り替える */
  selecting?: boolean;
  selected?: boolean;
  /** 長押し（選択モードに入る）・選択モード中のタップで呼ばれる */
  onToggleSelect?: () => void;
};

export function TaskItem({ task, note, selecting = false, selected = false, onToggleSelect }: Props) {
  const theme = useTheme();
  const { toggleDone, projects } = useTasks();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const date = today();
  const done = task.status === 'done';
  const overdue = isOverdue(task, date);
  const planned = !done && task.plannedDate === date;
  const longPressed = useRef(false);

  return (
    <Pressable
      onPressIn={() => {
        longPressed.current = false;
      }}
      onPress={() => {
        // 長押しのあと指を離したときはタップとして扱わない（選択モードに入った直後に選択が外れないように）
        if (longPressed.current) return;
        if (selecting) onToggleSelect?.();
        else router.push({ pathname: '/task/[id]', params: { id: task.id } });
      }}
      onLongPress={() => {
        longPressed.current = true;
        onToggleSelect?.();
      }}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? theme.primarySoft : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {selecting ? (
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={26}
          color={selected ? theme.primary : theme.subText}
        />
      ) : (
        <Pressable onPress={() => toggleDone(task.id)} hitSlop={12} accessibilityLabel="完了を切り替え">
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={done ? theme.primary : theme.subText}
          />
        </Pressable>
      )}
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
        {(project || ((task.dueDate || planned || task.estimateMinutes !== null) && !done)) && (
          <View style={styles.meta}>
            {project && (
              <View style={styles.project}>
                <View style={[styles.dot, { backgroundColor: project.color }]} />
                <Text style={[styles.metaText, { color: theme.subText }]} numberOfLines={1}>
                  {project.name}
                </Text>
              </View>
            )}
            {task.dueDate && !done && (
              <Text style={[styles.metaText, { color: overdue ? theme.danger : theme.subText }]}>
                <Ionicons name="calendar-outline" size={12} /> {formatDueDate(task.dueDate)}
                {overdue ? '（期限切れ）' : ''}
              </Text>
            )}
            {task.estimateMinutes !== null && !done && (
              <Text style={[styles.metaText, { color: theme.subText }]}>
                <Ionicons name="time-outline" size={12} /> {formatMinutes(task.estimateMinutes)}
              </Text>
            )}
            {planned && (
              <Text style={[styles.metaText, { color: theme.primary }]}>
                <Ionicons name="sunny-outline" size={12} /> 今日やる
              </Text>
            )}
          </View>
        )}
        {note && !done && <Text style={[styles.note, { color: theme.subText }]}>{note}</Text>}
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
    flexWrap: 'wrap',
    gap: 12,
  },
  project: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 140,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
});
