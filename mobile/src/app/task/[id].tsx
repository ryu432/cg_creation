import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { useTheme } from '@/constants/theme';
import { addDays, formatDueDate, today } from '@/lib/date';
import { formatMinutes } from '@/lib/plan';
import { estimateOptions } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { tasks, projects, updateTask, toggleDone, removeTask } = useTasks();
  const task = tasks.find((t) => t.id === id);
  const [title, setTitle] = useState(task?.title ?? '');

  if (!task) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.subText }}>タスクが見つかりませんでした。</Text>
      </View>
    );
  }

  const date = today();
  const done = task.status === 'done';
  const dueOptions: { label: string; value: string | null }[] = [
    { label: 'なし', value: null },
    { label: '今日', value: date },
    { label: '明日', value: addDays(date, 1) },
    { label: '1週間後', value: addDays(date, 7) },
  ];
  // 選択肢にない期限が入っているときは、それも選択肢として表示する
  if (task.dueDate && !dueOptions.some((o) => o.value === task.dueDate)) {
    dueOptions.push({ label: formatDueDate(task.dueDate), value: task.dueDate });
  }

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) updateTask(task.id, { title: trimmed });
    else setTitle(task.title);
  };

  const confirmRemove = () => {
    Alert.alert('タスクを削除', `「${task.title}」を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          removeTask(task.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        onSubmitEditing={saveTitle}
        multiline
        submitBehavior="blurAndSubmit"
        style={[styles.titleInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>期限</Text>
        <View style={styles.chips}>
          {dueOptions.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={task.dueDate === option.value}
              onPress={() => updateTask(task.id, { dueDate: option.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>見積もり時間（任意）</Text>
        <View style={styles.chips}>
          <Chip
            label="なし"
            selected={task.estimateMinutes === null}
            onPress={() => updateTask(task.id, { estimateMinutes: null })}
          />
          {estimateOptions.map((option) => (
            <Chip
              key={option.minutes}
              label={option.label}
              selected={task.estimateMinutes === option.minutes}
              onPress={() => updateTask(task.id, { estimateMinutes: option.minutes })}
            />
          ))}
          {/* 選択肢にない時間（AI の推定などで入った値）も表示する */}
          {task.estimateMinutes !== null && !estimateOptions.some((o) => o.minutes === task.estimateMinutes) && (
            <Chip label={formatMinutes(task.estimateMinutes)} selected onPress={() => {}} />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>プロジェクト</Text>
        <View style={styles.chips}>
          <Chip
            label="なし"
            selected={task.projectId === null}
            onPress={() => updateTask(task.id, { projectId: null })}
          />
          {projects.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              dotColor={p.color}
              selected={task.projectId === p.id}
              onPress={() => updateTask(task.id, { projectId: p.id })}
            />
          ))}
          <Chip
            label="＋ 新規"
            onPress={() => router.push({ pathname: '/project/edit', params: { assignTo: task.id } })}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.switchRow}>
          <Text style={[styles.rowText, { color: theme.text }]}>
            <Ionicons name="sunny-outline" size={16} color={theme.primary} /> 今日やる
          </Text>
          <Switch
            value={task.plannedDate === date}
            onValueChange={(on) => updateTask(task.id, { plannedDate: on ? date : null })}
            trackColor={{ true: theme.primary, false: theme.border }}
            disabled={done}
          />
        </View>
      </View>

      <Pressable
        onPress={() => toggleDone(task.id)}
        style={[styles.button, { backgroundColor: done ? theme.surface : theme.primary, borderColor: theme.primary }]}
      >
        <Text style={[styles.buttonText, { color: done ? theme.primary : theme.onPrimary }]}>
          {done ? '未完了に戻す' : '完了にする'}
        </Text>
      </Pressable>

      <Pressable onPress={confirmRemove} style={styles.removeButton} hitSlop={8}>
        <Text style={[styles.removeText, { color: theme.danger }]}>このタスクを削除</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    marginLeft: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 15,
  },
});
