import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { TaskList } from '@/components/TaskList';
import { useTheme } from '@/constants/theme';
import { sortTasks } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export default function AllTasksScreen() {
  const theme = useTheme();
  const { tasks, projects } = useTasks();
  const [showDone, setShowDone] = useState(false);
  // null は「すべて」
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const selectedProject = projects.find((p) => p.id === projectFilter);

  const inProject = selectedProject ? tasks.filter((t) => t.projectId === selectedProject.id) : tasks;
  const doneCount = inProject.filter((t) => t.status === 'done').length;
  const visible = sortTasks(showDone ? inProject : inProject.filter((t) => t.status === 'todo'));

  return (
    <TaskList
      tasks={visible}
      addParams={selectedProject ? { projectId: selectedProject.id } : {}}
      emptyMessage={
        selectedProject
          ? `「${selectedProject.name}」のタスクはまだありません。`
          : 'タスクはまだありません。\n右下の＋から、思いついたことを追加してみましょう。'
      }
      header={
        <View style={styles.header}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filterScroll}
          >
            <Chip label="すべて" selected={!selectedProject} onPress={() => setProjectFilter(null)} />
            {projects.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                dotColor={p.color}
                selected={selectedProject?.id === p.id}
                onPress={() => setProjectFilter(p.id)}
                onLongPress={() => router.push({ pathname: '/project/edit', params: { id: p.id } })}
              />
            ))}
            <Chip label="＋ プロジェクト" onPress={() => router.push('/project/edit')} />
          </ScrollView>

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
  // 横スクロールのチップを画面の端まで広げる
  filterScroll: {
    marginHorizontal: -16,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
  },
  toggle: {
    fontSize: 13,
    textAlign: 'right',
  },
});
