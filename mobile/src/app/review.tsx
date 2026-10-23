import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Calendar } from '@/components/Calendar';
import { useTheme } from '@/constants/theme';
import { addDays, formatDueDate, today, toDateString } from '@/lib/date';
import { isLeftoverTask, isOverdue, POSTPONE_WARNING_COUNT, sortTasks, Task } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

// 夜の振り返り。やり残したタスクを、明日に回す・期限を変える・今日やるから外す・完了にする
export default function ReviewScreen() {
  const theme = useTheme();
  const { tasks, projects, updateTask, toggleDone, postponeTask, skipOccurrence } = useTasks();
  const date = today();
  const tomorrow = addDays(date, 1);

  // 画面を開いたときのやり残しを固定する（操作しても一覧から消えないように）
  const [taskIds] = useState(() => sortTasks(tasks.filter((t) => isLeftoverTask(t, date))).map((t) => t.id));
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [calendarFor, setCalendarFor] = useState<string | null>(null);
  // スキップしたルーティンの回は一覧から消えるので、結果を見せるために控えておく
  const [skipped, setSkipped] = useState<Record<string, Task>>({});

  const doneToday = tasks.filter(
    (t) => t.status === 'done' && t.completedAt !== null && toDateString(new Date(t.completedAt)) === date,
  ).length;
  const rows = taskIds.map((id) => tasks.find((t) => t.id === id) ?? skipped[id]).filter((t) => t !== undefined);
  const pending = rows.filter((t) => !outcomes[t.id]);

  const setOutcome = (id: string, label: string) => {
    setOutcomes((prev) => ({ ...prev, [id]: label }));
    setCalendarFor(null);
  };

  const postpone = (id: string) => {
    postponeTask(id, tomorrow);
    setOutcome(id, '明日に回しました');
  };

  const postponeAll = () => {
    for (const t of pending) postponeTask(t.id, tomorrow);
    setOutcomes((prev) => ({ ...prev, ...Object.fromEntries(pending.map((t) => [t.id, '明日に回しました'])) }));
    setCalendarFor(null);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={[styles.summary, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name="moon" size={18} color={theme.primary} />
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {doneToday > 0 ? `今日は${doneToday}件完了しました。おつかれさまでした！` : '今日もおつかれさまでした。'}
          {rows.length > 0 ? '\nやり残したタスクを、どうするか決めておきましょう。' : '\nやり残したタスクはありません🎉'}
        </Text>
      </View>

      {rows.map((task) => {
        const outcome = outcomes[task.id];
        const project = projects.find((p) => p.id === task.projectId);
        const overdue = isOverdue(task, date);
        const missed = task.plannedDate !== null && task.plannedDate < date;
        return (
          <View
            key={task.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: outcome ? 0.6 : 1 }]}
          >
            <Text style={[styles.title, { color: theme.text }]}>{task.title}</Text>
            <View style={styles.meta}>
              {project && <Text style={[styles.metaText, { color: theme.subText }]}>● {project.name}</Text>}
              {task.dueDate && (
                <Text style={[styles.metaText, { color: overdue ? theme.danger : theme.subText }]}>
                  期限 {formatDueDate(task.dueDate)}
                  {overdue ? '（期限切れ）' : ''}
                </Text>
              )}
              {missed && (
                <Text style={[styles.metaText, { color: theme.subText }]}>
                  {formatDueDate(task.plannedDate!)}にやる予定だったタスク
                </Text>
              )}
            </View>
            {task.postponeCount >= POSTPONE_WARNING_COUNT && !outcome && (
              <Text style={[styles.warning, { color: theme.danger }]}>
                {task.postponeCount}回先送りしています。小さく分けるか、見積もりを見直しましょう
              </Text>
            )}

            {outcome ? (
              <Text style={[styles.outcome, { color: theme.primary }]}>✓ {outcome}</Text>
            ) : (
              <View style={styles.actions}>
                <Action label="明日に回す" onPress={() => postpone(task.id)} primary />
                <Action
                  label="期限を変える"
                  onPress={() => setCalendarFor((v) => (v === task.id ? null : task.id))}
                />
                {task.plannedDate !== null && (
                  <Action
                    label="今日やるから外す"
                    onPress={() => {
                      updateTask(task.id, { plannedDate: null });
                      setOutcome(task.id, '「今日やる」から外しました');
                    }}
                  />
                )}
                <Action
                  label="完了にする"
                  onPress={() => {
                    toggleDone(task.id);
                    setOutcome(task.id, '完了にしました');
                  }}
                />
                {task.routineId && (
                  <Action
                    label="この回はスキップ"
                    onPress={() => {
                      setSkipped((prev) => ({ ...prev, [task.id]: task }));
                      skipOccurrence(task.id);
                      setOutcome(task.id, 'この回はスキップしました（次の回は作られます）');
                    }}
                  />
                )}
              </View>
            )}

            {calendarFor === task.id && !outcome && (
              <Calendar
                value={task.dueDate}
                onSelect={(d) => {
                  // 新しい期限に合わせて「今日やる」は外す（その日が近づけば今日の画面に出てくる）
                  updateTask(task.id, { dueDate: d, plannedDate: null });
                  setOutcome(task.id, `期限を${formatDueDate(d)}にしました`);
                }}
              />
            )}
          </View>
        );
      })}

      {pending.length > 1 && (
        <Pressable onPress={postponeAll} style={[styles.button, { borderColor: theme.primary }]}>
          <Text style={[styles.buttonText, { color: theme.primary }]}>残り{pending.length}件をまとめて明日に回す</Text>
        </Pressable>
      )}

      <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>振り返りを終える</Text>
      </Pressable>
    </ScrollView>
  );
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? theme.primary : theme.background,
          borderColor: primary ? theme.primary : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? theme.onPrimary : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaText: {
    fontSize: 12,
  },
  warning: {
    fontSize: 13,
    lineHeight: 18,
  },
  outcome: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
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
});
