import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TaskList } from '@/components/TaskList';
import { useTheme } from '@/constants/theme';
import { today } from '@/lib/date';
import { formatPlanItemTime } from '@/lib/plan';
import { isMissedPlannedTask, isTodayTask, sortTasks, Task } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

export default function TodayScreen() {
  const theme = useTheme();
  const { tasks, plan } = useTasks();
  const date = today();
  const todayPlan = plan?.date === date ? plan : null;
  const planOrder = new Map(todayPlan?.items.map((item, i) => [item.taskId, i]) ?? []);

  // プランのタスクを提案された順に先頭へ。それ以外は通常の並び順
  // （sort は安定ソートなので、プラン外のタスクは sortTasks の順のまま残る）
  const rank = (t: Task) => [t.status === 'todo' ? 0 : 1, planOrder.get(t.id) ?? Number.MAX_SAFE_INTEGER];
  const todayTasks = sortTasks(tasks.filter((t) => isTodayTask(t, date))).sort((a, b) => {
    const [as, ai] = rank(a);
    const [bs, bi] = rank(b);
    return as - bs || ai - bi;
  });
  const doneCount = todayTasks.filter((t) => t.status === 'done').length;
  const hasTodo = tasks.some((t) => t.status === 'todo');

  // 振り返りのカード: 前の日までのやり残しがあるとき、または18時以降で今日のタスクが残っているとき
  const EVENING_HOUR = 18;
  const missedCount = tasks.filter((t) => isMissedPlannedTask(t, date)).length;
  const todayTodoCount = todayTasks.length - doneCount;
  const isEvening = new Date().getHours() >= EVENING_HOUR;
  const review =
    missedCount > 0
      ? { title: 'やり残しがあります', sub: `前の日までの「今日やる」が${missedCount}件残っています` }
      : isEvening && todayTodoCount > 0
        ? { title: '今日を振り返る', sub: `残り${todayTodoCount}件をどうするか決めましょう` }
        : null;

  // タスク自体に見積もり時間があれば行の上の段に出るので、ここではプランの時間を出さない
  const noteFor = (task: Task) => {
    const item = todayPlan?.items.find((i) => i.taskId === task.id);
    if (!item) return undefined;
    // 区切ったときは常に「30分だけ（全体 約4時間）」を出す
    const time = item.totalMinutes || task.estimateMinutes === null ? formatPlanItemTime(item) : '';
    return [time, item.reason].filter(Boolean).join('・') || undefined;
  };

  const [, m, d] = date.split('-').map(Number);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date().getDay()];

  return (
    <TaskList
      tasks={todayTasks}
      noteFor={noteFor}
      addParams={{ today: '1' }}
      emptyMessage={'今日やることはまだありません。\nプランを作るか、右下の＋から追加しましょう。'}
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

          {review && (
            <Pressable
              onPress={() => router.push('/review')}
              style={({ pressed }) => [
                styles.reviewCard,
                { backgroundColor: theme.surface, borderColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="moon" size={20} color={theme.primary} />
              <View style={styles.planButtonBody}>
                <Text style={[styles.planButtonTitle, { color: theme.text }]}>{review.title}</Text>
                <Text style={[styles.reviewSub, { color: theme.subText }]}>{review.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subText} />
            </Pressable>
          )}

          {todayPlan ? (
            <View style={[styles.planCard, { backgroundColor: theme.primarySoft }]}>
              {todayPlan.comment !== '' && (
                <Text style={[styles.planComment, { color: theme.text }]}>{todayPlan.comment}</Text>
              )}
              <Pressable onPress={() => router.push('/plan')} hitSlop={8}>
                <Text style={[styles.planLink, { color: theme.primary }]}>プランを作り直す</Text>
              </Pressable>
            </View>
          ) : (
            hasTodo && (
              <Pressable
                onPress={() => router.push('/plan')}
                style={({ pressed }) => [styles.planButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="sunny" size={22} color={theme.onPrimary} />
                <View style={styles.planButtonBody}>
                  <Text style={[styles.planButtonTitle, { color: theme.onPrimary }]}>今日のプランを作る</Text>
                  <Text style={[styles.planButtonSub, { color: theme.onPrimary }]}>期限と時間から、今日やることを選びます</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.onPrimary} />
              </Pressable>
            )
          )}

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
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  planButtonBody: {
    flex: 1,
    gap: 2,
  },
  planButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planButtonSub: {
    fontSize: 13,
    opacity: 0.9,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  reviewSub: {
    fontSize: 13,
  },
  planCard: {
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  planComment: {
    fontSize: 15,
    lineHeight: 22,
  },
  planLink: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});
