import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { useTheme } from '@/constants/theme';
import { today } from '@/lib/date';
import { availableTimeOptions, Energy, energyOptions, formatMinutes, getPlanner, PlanError, PlanItem } from '@/lib/plan';
import { useTasks } from '@/lib/TaskStore';

type Proposal = { comment: string; items: (PlanItem & { accepted: boolean })[] };

export default function PlanScreen() {
  const theme = useTheme();
  const { tasks, projects, plan, planUsage, acceptPlan, recordPlanRequest } = useTasks();
  const date = today();
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const planner = getPlanner();
  const usedToday = planUsage?.date === date ? planUsage.count : 0;
  // 回数制限があるのは AI のときだけ（null は無制限）
  const remaining = planner.dailyLimit === null ? null : Math.max(planner.dailyLimit - usedToday, 0);

  const [availableMinutes, setAvailableMinutes] = useState(plan?.availableMinutes ?? 120);
  const [energy, setEnergy] = useState<Energy>(plan?.date === date ? plan.energy : 'normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const configured = planner.isReady();
  const canRequest = configured && todoCount > 0 && remaining !== 0 && !loading;

  const submit = async () => {
    if (!canRequest) return;
    setLoading(true);
    setError(null);
    try {
      const result = await planner.propose({ date, availableMinutes, energy, tasks, projects });
      if (planner.dailyLimit !== null) recordPlanRequest(date);
      setProposal({ comment: result.comment, items: result.items.map((i) => ({ ...i, accepted: true })) });
    } catch (e) {
      setError(e instanceof PlanError ? e.message : '提案の作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (taskId: string) => {
    setProposal((p) =>
      p && { ...p, items: p.items.map((i) => (i.taskId === taskId ? { ...i, accepted: !i.accepted } : i)) },
    );
  };

  const start = () => {
    if (!proposal) return;
    acceptPlan({
      date,
      availableMinutes,
      energy,
      comment: proposal.comment,
      items: proposal.items.filter((i) => i.accepted).map(({ accepted: _, ...item }) => item),
      planner: planner.kind,
      createdAt: new Date().toISOString(),
    });
    router.back();
  };

  if (proposal) {
    const accepted = proposal.items.filter((i) => i.accepted);
    const total = accepted.reduce((sum, i) => sum + i.estimateMinutes, 0);
    const over = total > availableMinutes;

    return (
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        {proposal.comment !== '' && (
          <View style={[styles.comment, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="sunny" size={18} color={theme.primary} />
            <Text style={[styles.commentText, { color: theme.text }]}>{proposal.comment}</Text>
          </View>
        )}

        {proposal.items.length === 0 ? (
          <Text style={[styles.hint, { color: theme.subText }]}>今日のおすすめは見つかりませんでした。</Text>
        ) : (
          proposal.items.map((item, index) => {
            const task = tasks.find((t) => t.id === item.taskId);
            const project = projects.find((p) => p.id === task?.projectId);
            return (
              <Pressable
                key={item.taskId}
                onPress={() => toggle(item.taskId)}
                style={[
                  styles.item,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: item.accepted ? 1 : 0.5 },
                ]}
              >
                <Ionicons
                  name={item.accepted ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={item.accepted ? theme.primary : theme.subText}
                />
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>
                    {index + 1}. {task?.title ?? '（削除されたタスク）'}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.subText }]}>
                    約{formatMinutes(item.estimateMinutes)}
                    {project ? `・${project.name}` : ''}
                  </Text>
                  {item.reason !== '' && (
                    <Text style={[styles.reason, { color: theme.text }]}>└ {item.reason}</Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={[styles.total, { color: over ? theme.danger : theme.subText }]}>
          合計 約{formatMinutes(total)} / 使える時間 {formatMinutes(availableMinutes)}
          {over ? '（少し多めです）' : ''}
        </Text>

        <Pressable
          onPress={start}
          disabled={accepted.length === 0}
          style={[styles.button, { backgroundColor: theme.primary, opacity: accepted.length === 0 ? 0.4 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>このプランで始める（{accepted.length}件）</Text>
        </Pressable>
        <Pressable onPress={() => setProposal(null)} style={styles.linkButton} hitSlop={8}>
          <Text style={[styles.link, { color: theme.primary }]}>
            条件を変えて作り直す{remaining === null ? '' : `（残り${remaining}回）`}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>今日使える時間</Text>
        <View style={styles.chips}>
          {availableTimeOptions.map((o) => (
            <Chip
              key={o.minutes}
              label={o.label}
              selected={availableMinutes === o.minutes}
              onPress={() => setAvailableMinutes(o.minutes)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>体力・気分</Text>
        <View style={styles.chips}>
          {energyOptions.map((o) => (
            <Chip key={o.value} label={o.label} selected={energy === o.value} onPress={() => setEnergy(o.value)} />
          ))}
        </View>
      </View>

      <Pressable
        onPress={submit}
        disabled={!canRequest}
        style={[styles.button, { backgroundColor: theme.primary, opacity: canRequest ? 1 : 0.4 }]}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.onPrimary} />
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>考え中…</Text>
          </View>
        ) : (
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>プランを提案してもらう</Text>
        )}
      </Pressable>

      {error && <Text style={[styles.hint, { color: theme.danger }]}>{error}</Text>}
      <Text style={[styles.hint, { color: theme.subText }]}>
        {!configured
          ? 'AI の接続先がまだ設定されていません。'
          : todoCount === 0
            ? '未完了のタスクがありません。先にタスクを追加しましょう。'
            : remaining === 0
              ? `今日の提案は${planner.dailyLimit}回使い切りました。また明日どうぞ。`
              : planner.kind === 'ai'
                ? `未完了の${todoCount}件から AI が選びます（今日はあと${remaining}回）。`
                : `未完了の${todoCount}件から、期限と時間をもとに選びます。`}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
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
  button: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  comment: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  commentText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
  },
  reason: {
    fontSize: 14,
    lineHeight: 20,
  },
  total: {
    fontSize: 13,
    textAlign: 'right',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  link: {
    fontSize: 15,
  },
});
