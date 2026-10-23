import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { TimeEditor } from '@/components/TimeEditor';
import { useTheme } from '@/constants/theme';
import { ensureNotificationPermission, formatTime, notificationsSupported, ReminderSettings } from '@/lib/notifications';
import { useTasks } from '@/lib/TaskStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const { tasks, projects, clearCompleted, clearAll, reminders, setReminders } = useTasks();
  const [editingTime, setEditingTime] = useState<keyof ReminderSettings | null>(null);
  const canNotify = notificationsSupported();

  const toggleReminder = async (key: keyof ReminderSettings, on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      Alert.alert('通知が許可されていません', 'スマホの設定アプリから、Expo Go（Plano）の通知を許可してください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setReminders({ ...reminders, [key]: { ...reminders[key], enabled: on } });
  };
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const doneCount = tasks.length - todoCount;

  const confirmClearCompleted = () => {
    Alert.alert('完了したタスクを削除', `${doneCount}件の完了したタスクを削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: clearCompleted },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert('すべてのデータを削除', 'すべてのタスクとプロジェクトを削除します。元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'すべて削除', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Section title="タスク">
        <Row label="未完了" value={`${todoCount}件`} />
        <Row label="完了" value={`${doneCount}件`} />
      </Section>

      <Section title="通知">
        {(
          [
            { key: 'morning', label: '朝のプラン', sub: '今日のプランを作るお知らせ' },
            { key: 'evening', label: '夜の振り返り', sub: 'やり残しを振り返るお知らせ' },
          ] as const
        ).map(({ key, label, sub }) => (
          <View key={key}>
            <View style={styles.row}>
              <View style={styles.reminderLabel}>
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.sub, { color: theme.subText }]}>{sub}</Text>
              </View>
              <Pressable
                onPress={() => setEditingTime((v) => (v === key ? null : key))}
                hitSlop={8}
                accessibilityLabel={`${label}の時刻を変える`}
              >
                <Text style={[styles.time, { color: canNotify && reminders[key].enabled ? theme.primary : theme.subText }]}>
                  {formatTime(reminders[key])}
                </Text>
              </Pressable>
              <Switch
                value={canNotify && reminders[key].enabled}
                disabled={!canNotify}
                onValueChange={(on) => toggleReminder(key, on)}
                trackColor={{ true: theme.primary, false: theme.border }}
              />
            </View>
            {editingTime === key && (
              <TimeEditor
                hour={reminders[key].hour}
                minute={reminders[key].minute}
                onChange={(time) => setReminders({ ...reminders, [key]: { ...reminders[key], ...time } })}
              />
            )}
          </View>
        ))}
        {!canNotify && (
          <Text style={[styles.sub, styles.notice, { color: theme.subText }]}>
            Expo Go では通知を使えません。Plano 専用のアプリで使えるようになります（時刻の設定は保存されます）。
          </Text>
        )}
      </Section>

      <Section title="プロジェクト">
        {projects.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/project/edit', params: { id: p.id } })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.projectName}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            <View style={styles.projectName}>
              <Text style={[styles.value, { color: theme.subText }]}>
                {tasks.filter((t) => t.projectId === p.id && t.status === 'todo').length}件
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.subText} />
            </View>
          </Pressable>
        ))}
        <ActionRow label="＋ プロジェクトを追加" onPress={() => router.push('/project/edit')} />
      </Section>

      <Section title="データ">
        <ActionRow label="完了したタスクを削除" onPress={confirmClearCompleted} disabled={doneCount === 0} />
        <ActionRow label="すべてのデータを削除" onPress={confirmClearAll} disabled={tasks.length === 0} danger />
      </Section>

      <Section title="このアプリについて">
        <Row label="バージョン" value={Constants.expoConfig?.version ?? '-'} />
      </Section>

      <Text style={[styles.note, { color: theme.subText }]}>
        タスクはこのスマホの中に保存されています。ログインと端末間の同期は今後追加予定です。
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.subText }]}>{value}</Text>
    </View>
  );
}

function ActionRow(props: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.row, { opacity: props.disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.label, { color: props.danger ? theme.danger : theme.primary }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  reminderLabel: {
    flex: 1,
    gap: 2,
  },
  sub: {
    fontSize: 12,
  },
  notice: {
    lineHeight: 18,
    paddingBottom: 14,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  projectName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 4,
  },
});
